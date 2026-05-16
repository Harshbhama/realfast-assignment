const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { Policy, Member, Service, Claim, LineItem, Coverage, Dispute } = require("../models");

exports.getAllPolicies = () => {
  return Policy.findAll();
};

exports.getPolicyById = (id) => {
  return Policy.findByPk(id, { include: [{ model: Coverage, include: [Service] }] });
};

exports.getAllMembers = () => {
  return Member.findAll({ include: [Policy] });
};

exports.createMember = (data) => {
  return Member.create(data);
};

exports.getAllServices = () => {
  return Service.findAll();
};

exports.getAllClaims = () => {
  return Claim.findAll({ include: [LineItem, Member, Policy] });
};

exports.getClaimById = (id) => {
  return Claim.findByPk(id, { include: [LineItem, Member, Policy] });
};

exports.createClaim = async (data) => {
  const { line_items, ...claimData } = data;

  const result = await sequelize.transaction(async (t) => {
    const claim = await Claim.create(claimData, { transaction: t });

    const lineItemRows = line_items.map((item) => ({
      ...item,
      claim_id: claim.id,
    }));
    await LineItem.bulkCreate(lineItemRows, { transaction: t });

    return Claim.findByPk(claim.id, {
      include: [LineItem],
      transaction: t,
    });
  });

  return result;
};

exports.getDisputesByClaimId = async (claimId) => {
  const claim = await Claim.findByPk(claimId);
  if (!claim) {
    const error = new Error("Claim not found.");
    error.status = 404;
    throw error;
  }

  return Dispute.findAll({ where: { claim_id: claimId }, order: [["id", "ASC"]] });
};

exports.createDispute = async (claimId, reason) => {
  const claim = await Claim.findByPk(claimId);
  if (!claim) {
    const error = new Error("Claim not found.");
    error.status = 404;
    throw error;
  }

  if (["SUBMITTED", "UNDER_REVIEW"].includes(claim.status)) {
    const error = new Error("Claim has not been adjudicated yet. Cannot dispute.");
    error.status = 400;
    throw error;
  }

  const dispute = await Dispute.create({
    claim_id: claim.id,
    reason,
  });

  await claim.update({ status: "DISPUTED" });

  return dispute;
};

exports.resolveDispute = async (disputeId, resolution, resolutionNotes) => {
  const dispute = await Dispute.findByPk(disputeId);
  if (!dispute) {
    const error = new Error("Dispute not found.");
    error.status = 404;
    throw error;
  }

  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    const error = new Error(`Dispute has already been resolved with status: ${dispute.status}.`);
    error.status = 400;
    throw error;
  }

  const claim = await Claim.findByPk(dispute.claim_id, { include: [LineItem] });

  if (resolution === "UPHELD") {
    await dispute.update({
      status: "RESOLVED_UPHELD",
      resolution_notes: resolutionNotes,
    });

    // Derive claim status from line items
    const statuses = claim.LineItems.map((li) => li.status);
    let claimStatus;
    if (statuses.every((s) => s === "APPROVED")) {
      claimStatus = "APPROVED";
    } else if (statuses.every((s) => s === "DENIED")) {
      claimStatus = "DENIED";
    } else {
      claimStatus = "PARTIALLY_APPROVED";
    }
    await claim.update({ status: claimStatus });
  } else {
    await dispute.update({
      status: "RESOLVED_OVERTURNED",
      resolution_notes: resolutionNotes,
    });

    await claim.update({ status: "UNDER_REVIEW" });

    await LineItem.update(
      { status: "PENDING", approved_amount: null, denial_reason: null },
      { where: { claim_id: claim.id } }
    );
  }

  return dispute.reload();
};

exports.adjudicateClaim = async (claimId) => {
  const claim = await Claim.findByPk(claimId, { include: [LineItem] });
  if (!claim) {
    throw new Error("Claim not found.");
  }

  if (!["SUBMITTED", "UNDER_REVIEW"].includes(claim.status)) {
    throw new Error(`Claim has already been adjudicated with status: ${claim.status}.`);
  }

  const policy = await Policy.findByPk(claim.policy_id);

  await claim.update({ status: "UNDER_REVIEW" });

  const lineItems = await LineItem.findAll({
    where: { claim_id: claim.id },
    order: [["id", "ASC"]],
  });

  // Query deductible from PAST claims ONCE before the loop
  const [deductibleFromDb] = await sequelize.query(
    `SELECT COALESCE(SUM(li.billed_amount - li.approved_amount), 0) AS deductible_met
     FROM LineItems li
     JOIN Claims c ON li.claim_id = c.id
     WHERE c.member_id = :memberId
       AND c.id != :currentClaimId
       AND li.status = 'APPROVED'
       AND c.service_date BETWEEN :effectiveFrom AND :effectiveTo`,
    {
      replacements: {
        memberId: claim.member_id,
        currentClaimId: claim.id,
        effectiveFrom: policy.effective_from,
        effectiveTo: policy.effective_to,
      },
      type: QueryTypes.SELECT,
    }
  );
  let runningDeductibleMet = parseFloat(deductibleFromDb.deductible_met);

  // Query annual limit usage from PAST claims ONCE, grouped by service_code
  const annualUsageFromDb = await sequelize.query(
    `SELECT li.service_code, COALESCE(SUM(li.approved_amount), 0) AS used_amount
     FROM LineItems li
     JOIN Claims c ON li.claim_id = c.id
     WHERE c.member_id = :memberId
       AND c.id != :currentClaimId
       AND li.status = 'APPROVED'
       AND c.service_date BETWEEN :effectiveFrom AND :effectiveTo
     GROUP BY li.service_code`,
    {
      replacements: {
        memberId: claim.member_id,
        currentClaimId: claim.id,
        effectiveFrom: policy.effective_from,
        effectiveTo: policy.effective_to,
      },
      type: QueryTypes.SELECT,
    }
  );

  // In-memory running totals for annual limit per service_code
  const runningAnnualUsed = {};
  for (const row of annualUsageFromDb) {
    runningAnnualUsed[row.service_code] = parseFloat(row.used_amount);
  }

  const deductibleAmount = parseFloat(policy.deductible_amount);

  // Response-only tracking per line item
  const lineItemResults = [];

  for (const lineItem of lineItems) {
    const billedAmount = parseFloat(lineItem.billed_amount);
    let deductibleAppliedThisItem = 0;
    let coveragePercentageValue = null;

    // Check 1: Policy active?
    if (policy.status !== "ACTIVE") {
      await lineItem.update({
        approved_amount: 0,
        status: "DENIED",
        denial_reason: `Policy ${policy.policy_number} is ${policy.status}. No coverage available.`,
      });
      lineItemResults.push({
        id: lineItem.id,
        service_code: lineItem.service_code,
        description: lineItem.description,
        billed_amount: billedAmount,
        approved_amount: 0,
        deductible_applied: 0,
        coverage_percentage: null,
        status: "DENIED",
        denial_reason: `Policy ${policy.policy_number} is ${policy.status}. No coverage available.`,
      });
      continue;
    }

    // Check 2: Service date within policy period?
    const serviceDate = claim.service_date;
    if (serviceDate < policy.effective_from || serviceDate > policy.effective_to) {
      await lineItem.update({
        approved_amount: 0,
        status: "DENIED",
        denial_reason: `Service date ${serviceDate} is outside policy period (${policy.effective_from} to ${policy.effective_to}).`,
      });
      lineItemResults.push({
        id: lineItem.id,
        service_code: lineItem.service_code,
        description: lineItem.description,
        billed_amount: billedAmount,
        approved_amount: 0,
        deductible_applied: 0,
        coverage_percentage: null,
        status: "DENIED",
        denial_reason: `Service date ${serviceDate} is outside policy period (${policy.effective_from} to ${policy.effective_to}).`,
      });
      continue;
    }

    // Check 3: Coverage rule exists?
    const coverage = await Coverage.findOne({
      where: { policy_id: claim.policy_id, service_code: lineItem.service_code },
    });
    if (!coverage) {
      await lineItem.update({
        approved_amount: 0,
        status: "DENIED",
        denial_reason: `Service ${lineItem.service_code} is not covered under ${policy.plan_name}.`,
      });
      lineItemResults.push({
        id: lineItem.id,
        service_code: lineItem.service_code,
        description: lineItem.description,
        billed_amount: billedAmount,
        approved_amount: 0,
        deductible_applied: 0,
        coverage_percentage: null,
        status: "DENIED",
        denial_reason: `Service ${lineItem.service_code} is not covered under ${policy.plan_name}.`,
      });
      continue;
    }

    coveragePercentageValue = parseFloat(coverage.coverage_percentage);

    // Check 4: Annual limit exhausted? (use in-memory running total)
    const annualLimit = coverage.annual_limit ? parseFloat(coverage.annual_limit) : null;
    const usedAmount = runningAnnualUsed[lineItem.service_code] || 0;
    let remainingLimit = annualLimit !== null ? annualLimit - usedAmount : Infinity;

    if (annualLimit !== null && remainingLimit <= 0) {
      await lineItem.update({
        approved_amount: 0,
        status: "DENIED",
        denial_reason: `Annual limit of $${annualLimit.toFixed(2)} for ${lineItem.service_code} has been fully exhausted for this policy period.`,
      });
      lineItemResults.push({
        id: lineItem.id,
        service_code: lineItem.service_code,
        description: lineItem.description,
        billed_amount: billedAmount,
        approved_amount: 0,
        deductible_applied: 0,
        coverage_percentage: coveragePercentageValue,
        status: "DENIED",
        denial_reason: `Annual limit of $${annualLimit.toFixed(2)} for ${lineItem.service_code} has been fully exhausted for this policy period.`,
      });
      continue;
    }

    // Check 5 & 6: Calculate and apply deductible (using in-memory running total)
    let deductibleRemaining = deductibleAmount - runningDeductibleMet;
    if (deductibleRemaining < 0) deductibleRemaining = 0;

    let amountAfterDeductible;

    if (deductibleRemaining >= billedAmount) {
      deductibleAppliedThisItem = billedAmount;
      runningDeductibleMet += deductibleAppliedThisItem;
      const denialReason = `Deductible not yet met. $${billedAmount.toFixed(2)} applied to $${deductibleAmount.toFixed(2)} annual deductible. $${(deductibleRemaining - billedAmount).toFixed(2)} remaining.`;
      await lineItem.update({
        approved_amount: 0,
        status: "APPROVED",
        denial_reason: denialReason,
      });
      lineItemResults.push({
        id: lineItem.id,
        service_code: lineItem.service_code,
        description: lineItem.description,
        billed_amount: billedAmount,
        approved_amount: 0,
        deductible_applied: parseFloat(deductibleAppliedThisItem.toFixed(2)),
        coverage_percentage: coveragePercentageValue,
        status: "APPROVED",
        denial_reason: denialReason,
      });
      continue;
    } else if (deductibleRemaining > 0) {
      deductibleAppliedThisItem = deductibleRemaining;
      amountAfterDeductible = billedAmount - deductibleRemaining;
      runningDeductibleMet += deductibleAppliedThisItem;
    } else {
      amountAfterDeductible = billedAmount;
    }

    // Check 7: Apply coverage percentage
    const coveredAmount = amountAfterDeductible * (coveragePercentageValue / 100);

    // Check 8: Apply annual limit cap
    const payable = annualLimit !== null ? Math.min(coveredAmount, remainingLimit) : coveredAmount;
    const approvedAmount = parseFloat(payable.toFixed(2));

    // Update running annual usage
    runningAnnualUsed[lineItem.service_code] = (runningAnnualUsed[lineItem.service_code] || 0) + approvedAmount;

    let denialReason = null;
    if (annualLimit !== null && payable < coveredAmount) {
      denialReason = `Annual limit for ${lineItem.service_code} is $${annualLimit.toFixed(2)}. $${usedAmount.toFixed(2)} already used. Only $${remainingLimit.toFixed(2)} remaining, applied to this claim.`;
    } else if (deductibleAppliedThisItem > 0) {
      denialReason = `$${deductibleAppliedThisItem.toFixed(2)} applied to remaining deductible. $${amountAfterDeductible.toFixed(2)} covered at ${coveragePercentageValue}%. Approved: $${payable.toFixed(2)}.`;
    }

    await lineItem.update({
      approved_amount: approvedAmount,
      status: "APPROVED",
      denial_reason: denialReason,
    });

    lineItemResults.push({
      id: lineItem.id,
      service_code: lineItem.service_code,
      description: lineItem.description,
      billed_amount: billedAmount,
      approved_amount: approvedAmount,
      deductible_applied: parseFloat(deductibleAppliedThisItem.toFixed(2)),
      coverage_percentage: coveragePercentageValue,
      status: "APPROVED",
      denial_reason: denialReason,
    });
  }

  // Derive claim status
  const statuses = lineItemResults.map((li) => li.status);
  let claimStatus;
  if (statuses.includes("NEEDS_REVIEW")) {
    claimStatus = "UNDER_REVIEW";
  } else if (statuses.every((s) => s === "APPROVED")) {
    claimStatus = "APPROVED";
  } else if (statuses.every((s) => s === "DENIED")) {
    claimStatus = "DENIED";
  } else {
    claimStatus = "PARTIALLY_APPROVED";
  }

  await claim.update({ status: claimStatus });

  // Build summary
  const totalBilled = parseFloat(lineItemResults.reduce((sum, li) => sum + li.billed_amount, 0).toFixed(2));
  const totalApproved = parseFloat(lineItemResults.reduce((sum, li) => sum + li.approved_amount, 0).toFixed(2));
  const totalDeductibleApplied = parseFloat(lineItemResults.reduce((sum, li) => sum + li.deductible_applied, 0).toFixed(2));
  const totalMemberResponsibility = parseFloat((totalBilled - totalApproved).toFixed(2));

  return {
    claim: {
      id: claim.id,
      status: claimStatus,
      member_id: claim.member_id,
      policy_id: claim.policy_id,
      service_date: claim.service_date,
      provider_name: claim.provider_name,
      diagnosis_code: claim.diagnosis_code,
      summary: {
        total_billed: totalBilled,
        total_approved: totalApproved,
        total_deductible_applied: totalDeductibleApplied,
        total_member_responsibility: totalMemberResponsibility,
      },
      line_items: lineItemResults,
    },
  };
};
