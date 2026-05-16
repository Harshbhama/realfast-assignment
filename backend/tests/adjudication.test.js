const request = require("supertest");
const { app, sequelize, setupDatabase, seedTestData, cleanClaims } = require("./setup");
const { Policy } = require("../models");

beforeAll(async () => {
  await setupDatabase();
  await seedTestData();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await cleanClaims();
});

describe("POST /api/claims/:id/adjudicate", () => {
  describe("Basic adjudication flow", () => {
    it("should approve a claim with a single covered line item", async () => {
      // Billed: $600 GP_VISIT, Policy 1: deductible $500, coverage 80%, limit $2000
      // After deductible: $600 - $500 = $100, covered at 80% = $80
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Office visit", billed_amount: 600 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe("APPROVED");
      expect(res.body.claim.line_items[0].approved_amount).toBe(80);
      expect(res.body.claim.summary.total_billed).toBe(600);
      expect(res.body.claim.summary.total_approved).toBe(80);
      expect(res.body.claim.summary.total_deductible_applied).toBe(500);
      expect(res.body.claim.summary.total_member_responsibility).toBe(520);
    });

    it("should deny all line items when policy is inactive", async () => {
      await Policy.update({ status: "EXPIRED" }, { where: { id: 1 } });

      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Office visit", billed_amount: 200 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe("DENIED");
      expect(res.body.claim.line_items[0].status).toBe("DENIED");
      expect(res.body.claim.line_items[0].denial_reason).toContain("EXPIRED");

      await Policy.update({ status: "ACTIVE" }, { where: { id: 1 } });
    });

    it("should deny when service date is outside policy period", async () => {
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2026-03-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Office visit", billed_amount: 200 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe("DENIED");
      expect(res.body.claim.line_items[0].denial_reason).toContain("outside policy period");
    });

    it("should deny when service is not covered by policy", async () => {
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "K02.1",
        line_items: [{ service_code: "DENTAL_CLEANING", description: "Cleaning", billed_amount: 150 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.status).toBe(200);
      expect(res.body.claim.status).toBe("DENIED");
      expect(res.body.claim.line_items[0].denial_reason).toContain("not covered");
    });

    it("should not allow adjudicating an already adjudicated claim", async () => {
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 200 }],
      });

      await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already been adjudicated");
    });
  });

  describe("Deductible calculations", () => {
    it("should apply full billed amount to deductible when deductible not met", async () => {
      // Policy 1: deductible $500. Billed $300 < deductible, so all goes to deductible
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 300 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.body.claim.line_items[0].approved_amount).toBe(0);
      expect(res.body.claim.line_items[0].deductible_applied).toBe(300);
      expect(res.body.claim.line_items[0].status).toBe("APPROVED");
      expect(res.body.claim.summary.total_deductible_applied).toBe(300);
    });

    it("should split deductible across line items within the same claim", async () => {
      // Policy 1: deductible $500
      // Line 1: GP_VISIT $300 → all to deductible ($300 applied, $200 remaining)
      // Line 2: XRAY $400 → $200 to deductible, $200 remaining covered at 80% = $160
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [
          { service_code: "GP_VISIT", description: "Visit", billed_amount: 300 },
          { service_code: "XRAY", description: "X-Ray scan", billed_amount: 400 },
        ],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      const items = res.body.claim.line_items;

      expect(items[0].deductible_applied).toBe(300);
      expect(items[0].approved_amount).toBe(0);

      expect(items[1].deductible_applied).toBe(200);
      expect(items[1].approved_amount).toBe(160); // (400-200) * 0.80

      expect(res.body.claim.summary.total_deductible_applied).toBe(500);
      expect(res.body.claim.summary.total_approved).toBe(160);
    });

    it("should track deductible across multiple claims for the same member", async () => {
      // First claim uses $500 deductible fully
      const claim1 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-03-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 600 }],
      });
      await request(app).post(`/api/claims/${claim1.body.id}/adjudicate`);

      // Second claim - deductible already met, full coverage applies
      const claim2 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Jones",
        diagnosis_code: "M54.5",
        line_items: [{ service_code: "GP_VISIT", description: "Follow-up", billed_amount: 200 }],
      });

      const res = await request(app).post(`/api/claims/${claim2.body.id}/adjudicate`);
      expect(res.body.claim.line_items[0].deductible_applied).toBe(0);
      expect(res.body.claim.line_items[0].approved_amount).toBe(160); // 200 * 0.80
      expect(res.body.claim.summary.total_deductible_applied).toBe(0);
    });

    it("should apply partial deductible from prior claims correctly", async () => {
      // First claim: billed $300 GP_VISIT, deductible $500 → $300 applied, $200 remaining
      const claim1 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-02-10",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 300 }],
      });
      await request(app).post(`/api/claims/${claim1.body.id}/adjudicate`);

      // Second claim: billed $400 GP_VISIT, only $200 deductible remaining
      // After deductible: $400 - $200 = $200, covered at 80% = $160
      const claim2 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-04-20",
        provider_name: "Dr. Jones",
        diagnosis_code: "M54.5",
        line_items: [{ service_code: "GP_VISIT", description: "Follow-up", billed_amount: 400 }],
      });

      const res = await request(app).post(`/api/claims/${claim2.body.id}/adjudicate`);
      expect(res.body.claim.line_items[0].deductible_applied).toBe(200);
      expect(res.body.claim.line_items[0].approved_amount).toBe(160); // (400-200) * 0.80
    });
  });

  describe("Coverage percentage", () => {
    it("should apply correct coverage percentage per service code", async () => {
      // Policy 2: deductible $1000. Billed $1200 GP_VISIT (90%), $800 MRI (85%)
      // Line 1: $1200 GP_VISIT → $1000 deductible, $200 * 90% = $180
      // Line 2: $800 MRI → no deductible remaining, $800 * 85% = $680
      const claim = await request(app).post("/api/claims").send({
        member_id: 2,
        policy_id: 2,
        service_date: "2025-06-15",
        provider_name: "Dr. Brown",
        diagnosis_code: "R51",
        line_items: [
          { service_code: "GP_VISIT", description: "Consultation", billed_amount: 1200 },
          { service_code: "MRI", description: "Brain MRI", billed_amount: 800 },
        ],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      const items = res.body.claim.line_items;

      expect(items[0].coverage_percentage).toBe(90);
      expect(items[0].approved_amount).toBe(180); // (1200-1000) * 0.90
      expect(items[1].coverage_percentage).toBe(85);
      expect(items[1].approved_amount).toBe(680); // 800 * 0.85
    });
  });

  describe("Annual limit", () => {
    it("should deny when annual limit is fully exhausted", async () => {
      // Policy 1: XRAY annual limit $1000, coverage 80%, deductible $500
      // Claim 1: XRAY $2000 → deductible $500, (2000-500)*80% = $1200, capped at $1000
      const claim1 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-02-15",
        provider_name: "Dr. Rad",
        diagnosis_code: "S52.0",
        line_items: [{ service_code: "XRAY", description: "Arm X-Ray", billed_amount: 2000 }],
      });
      const adj1 = await request(app).post(`/api/claims/${claim1.body.id}/adjudicate`);
      expect(adj1.body.claim.line_items[0].approved_amount).toBe(1000); // capped at annual limit

      // Claim 2: XRAY $500 → annual limit fully exhausted
      const claim2 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-05-15",
        provider_name: "Dr. Rad",
        diagnosis_code: "S52.0",
        line_items: [{ service_code: "XRAY", description: "Follow-up X-Ray", billed_amount: 500 }],
      });

      const res = await request(app).post(`/api/claims/${claim2.body.id}/adjudicate`);
      expect(res.body.claim.status).toBe("DENIED");
      expect(res.body.claim.line_items[0].status).toBe("DENIED");
      expect(res.body.claim.line_items[0].denial_reason).toContain("exhausted");
    });

    it("should cap approved amount at remaining annual limit", async () => {
      // Policy 1: XRAY limit $1000, coverage 80%, deductible $500
      // Claim 1: XRAY $1000 → deductible $500, (1000-500)*80% = $400 approved
      const claim1 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-02-15",
        provider_name: "Dr. Rad",
        diagnosis_code: "S52.0",
        line_items: [{ service_code: "XRAY", description: "X-Ray", billed_amount: 1000 }],
      });
      const adj1 = await request(app).post(`/api/claims/${claim1.body.id}/adjudicate`);
      expect(adj1.body.claim.line_items[0].approved_amount).toBe(400);

      // Claim 2: XRAY $1000 → deductible already met, 1000*80%=$800, but only $600 remaining limit
      const claim2 = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-05-15",
        provider_name: "Dr. Rad",
        diagnosis_code: "S52.0",
        line_items: [{ service_code: "XRAY", description: "X-Ray 2", billed_amount: 1000 }],
      });

      const res = await request(app).post(`/api/claims/${claim2.body.id}/adjudicate`);
      expect(res.body.claim.line_items[0].approved_amount).toBe(600);
      expect(res.body.claim.line_items[0].denial_reason).toContain("remaining");
    });

    it("should track annual limit across line items within the same claim", async () => {
      // Policy 1: XRAY limit $1000, coverage 80%, deductible $500
      // Line 1: XRAY $800 → deductible $500, (800-500)*80% = $240
      // Line 2: XRAY $1200 → no deductible, 1200*80% = $960, but only $760 remaining ($1000-$240)
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Rad",
        diagnosis_code: "S52.0",
        line_items: [
          { service_code: "XRAY", description: "X-Ray 1", billed_amount: 800 },
          { service_code: "XRAY", description: "X-Ray 2", billed_amount: 1200 },
        ],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      const items = res.body.claim.line_items;

      expect(items[0].approved_amount).toBe(240); // (800-500)*0.80
      expect(items[1].approved_amount).toBe(760); // capped at 1000-240 remaining
    });
  });

  describe("Mixed status claims", () => {
    it("should produce PARTIALLY_APPROVED when some items denied and some approved", async () => {
      // DENTAL_CLEANING is not covered under Policy 1, GP_VISIT is covered
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "K02.1",
        line_items: [
          { service_code: "GP_VISIT", description: "Visit", billed_amount: 600 },
          { service_code: "DENTAL_CLEANING", description: "Cleaning", billed_amount: 150 },
        ],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.body.claim.status).toBe("PARTIALLY_APPROVED");
      expect(res.body.claim.line_items[0].status).toBe("APPROVED");
      expect(res.body.claim.line_items[1].status).toBe("DENIED");
    });
  });

  describe("Response format", () => {
    it("should return proper summary and line item structure", async () => {
      const claim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 700 }],
      });

      const res = await request(app).post(`/api/claims/${claim.body.id}/adjudicate`);
      expect(res.body.claim).toHaveProperty("id");
      expect(res.body.claim).toHaveProperty("status");
      expect(res.body.claim).toHaveProperty("summary");
      expect(res.body.claim.summary).toHaveProperty("total_billed");
      expect(res.body.claim.summary).toHaveProperty("total_approved");
      expect(res.body.claim.summary).toHaveProperty("total_deductible_applied");
      expect(res.body.claim.summary).toHaveProperty("total_member_responsibility");

      const li = res.body.claim.line_items[0];
      expect(li).toHaveProperty("id");
      expect(li).toHaveProperty("service_code");
      expect(li).toHaveProperty("billed_amount");
      expect(li).toHaveProperty("approved_amount");
      expect(li).toHaveProperty("deductible_applied");
      expect(li).toHaveProperty("coverage_percentage");
      expect(li).toHaveProperty("status");
    });
  });
});
