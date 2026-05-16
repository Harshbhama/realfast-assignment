const express = require("express");
const router = express.Router();
const claimProcessingController = require("../controllers/claimProcessingController");
const validate = require("../middleware/validate");
const { createMemberSchema, createClaimSchema, createDisputeSchema, resolveDisputeSchema } = require("../validators/claimProcessingValidator");

router.get("/policies", claimProcessingController.getAllPolicies);
router.get("/policies/:id", claimProcessingController.getPolicyById);
router.get("/services", claimProcessingController.getAllServices);
router.post("/members", validate(createMemberSchema), claimProcessingController.createMember);
router.get("/claims", claimProcessingController.getAllClaims);
router.post("/claims", validate(createClaimSchema), claimProcessingController.createClaim);
router.post("/claims/:id/adjudicate", claimProcessingController.adjudicateClaim);
router.get("/claims/:id/disputes", claimProcessingController.getDisputesByClaimId);
router.post("/claims/:id/disputes", validate(createDisputeSchema), claimProcessingController.createDispute);
router.patch("/disputes/:id", validate(resolveDisputeSchema), claimProcessingController.resolveDispute);

module.exports = router;
