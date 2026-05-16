const claimProcessingService = require("../services/claimProcessingService");

exports.getAllPolicies = async (req, res) => {
  try {
    const policies = await claimProcessingService.getAllPolicies();
    res.json(policies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPolicyById = async (req, res) => {
  try {
    const policy = await claimProcessingService.getPolicyById(req.params.id);
    if (!policy) return res.status(404).json({ error: "Policy not found" });
    res.json(policy);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createMember = async (req, res) => {
  try {
    const member = await claimProcessingService.createMember(req.body);
    res.status(201).json(member);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await claimProcessingService.getAllServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAllClaims = async (req, res) => {
  try {
    const claims = await claimProcessingService.getAllClaims();
    res.json(claims);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createClaim = async (req, res) => {
  try {
    const claim = await claimProcessingService.createClaim(req.body);
    res.status(201).json(claim);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.adjudicateClaim = async (req, res) => {
  try {
    const result = await claimProcessingService.adjudicateClaim(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.getDisputesByClaimId = async (req, res) => {
  try {
    const disputes = await claimProcessingService.getDisputesByClaimId(req.params.id);
    res.json({ disputes });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.createDispute = async (req, res) => {
  try {
    const dispute = await claimProcessingService.createDispute(req.params.id, req.body.reason);
    res.status(201).json({ dispute });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};

exports.resolveDispute = async (req, res) => {
  try {
    const dispute = await claimProcessingService.resolveDispute(req.params.id, req.body.resolution, req.body.resolution_notes);
    res.json({ dispute });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
};
