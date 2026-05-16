const request = require("supertest");
const { app, sequelize, setupDatabase, seedTestData, cleanClaims } = require("./setup");

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

describe("Dispute Lifecycle", () => {
  let claimId;

  beforeEach(async () => {
    const claim = await request(app).post("/api/claims").send({
      member_id: 1,
      policy_id: 1,
      service_date: "2025-06-15",
      provider_name: "Dr. Smith",
      diagnosis_code: "J06.9",
      line_items: [
        { service_code: "GP_VISIT", description: "Visit", billed_amount: 600 },
        { service_code: "XRAY", description: "X-Ray", billed_amount: 400 },
      ],
    });
    claimId = claim.body.id;
    await request(app).post(`/api/claims/${claimId}/adjudicate`);
  });

  describe("POST /api/claims/:id/disputes", () => {
    it("should create a dispute for an adjudicated claim", async () => {
      const res = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "I disagree with the denial" });

      expect(res.status).toBe(201);
      expect(res.body.dispute).toHaveProperty("id");
      expect(res.body.dispute.reason).toBe("I disagree with the denial");
      expect(res.body.dispute.status).toBe("OPEN");
    });

    it("should set claim status to DISPUTED after filing", async () => {
      await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Incorrect denial" });

      const claim = await request(app).get(`/api/claims/${claimId}`);
      expect(claim.body.status).toBe("DISPUTED");
    });

    it("should not allow dispute on a non-adjudicated claim", async () => {
      const newClaim = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-07-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 200 }],
      });

      const res = await request(app)
        .post(`/api/claims/${newClaim.body.id}/disputes`)
        .send({ reason: "Too early" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("not been adjudicated");
    });

    it("should fail with validation error when reason is empty", async () => {
      const res = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "" });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent claim", async () => {
      const res = await request(app)
        .post("/api/claims/99999/disputes")
        .send({ reason: "Dispute for ghost" });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/disputes/:id — UPHELD", () => {
    it("should resolve dispute as UPHELD and restore original claim status", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "I disagree" });

      const res = await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "UPHELD", resolution_notes: "Original decision correct" });

      expect(res.status).toBe(200);
      expect(res.body.dispute.status).toBe("RESOLVED_UPHELD");
      expect(res.body.dispute.resolution_notes).toBe("Original decision correct");

      // Claim status should revert based on line items
      const claim = await request(app).get(`/api/claims/${claimId}`);
      expect(["APPROVED", "PARTIALLY_APPROVED", "DENIED"]).toContain(claim.body.status);
    });
  });

  describe("PATCH /api/disputes/:id — OVERTURNED", () => {
    it("should resolve dispute as OVERTURNED and reset claim for re-adjudication", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Wrong coverage applied" });

      const res = await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "OVERTURNED", resolution_notes: "Need re-review" });

      expect(res.status).toBe(200);
      expect(res.body.dispute.status).toBe("RESOLVED_OVERTURNED");

      // Claim should be back to UNDER_REVIEW
      const claim = await request(app).get(`/api/claims/${claimId}`);
      expect(claim.body.status).toBe("UNDER_REVIEW");

      // Line items should be reset to PENDING
      expect(claim.body.LineItems.every((li) => li.status === "PENDING")).toBe(true);
      expect(claim.body.LineItems.every((li) => li.approved_amount === null)).toBe(true);
    });

    it("should allow re-adjudication after OVERTURNED dispute", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Wrong" });

      await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "OVERTURNED", resolution_notes: "Redo" });

      // Re-adjudicate
      const res = await request(app).post(`/api/claims/${claimId}/adjudicate`);
      expect(res.status).toBe(200);
      expect(["APPROVED", "PARTIALLY_APPROVED", "DENIED"]).toContain(res.body.claim.status);
    });
  });

  describe("PATCH /api/disputes/:id — Validation", () => {
    it("should not allow resolving an already resolved dispute", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Dispute" });

      await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "UPHELD", resolution_notes: "Done" });

      const res = await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "OVERTURNED", resolution_notes: "Try again" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("already been resolved");
    });

    it("should fail when resolution is invalid", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Dispute" });

      const res = await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "INVALID", resolution_notes: "Notes" });

      expect(res.status).toBe(400);
    });

    it("should fail when resolution_notes are missing", async () => {
      const dispute = await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "Dispute" });

      const res = await request(app)
        .patch(`/api/disputes/${dispute.body.dispute.id}`)
        .send({ resolution: "UPHELD" });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent dispute", async () => {
      const res = await request(app)
        .patch("/api/disputes/99999")
        .send({ resolution: "UPHELD", resolution_notes: "Notes" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/claims/:id/disputes", () => {
    it("should return all disputes for a claim", async () => {
      await request(app)
        .post(`/api/claims/${claimId}/disputes`)
        .send({ reason: "First dispute" });

      // Resolve first, then file another
      const claim = await request(app).get(`/api/claims/${claimId}`);
      // The claim is now DISPUTED, adjudicate won't work - but we can still list disputes

      const res = await request(app).get(`/api/claims/${claimId}/disputes`);
      expect(res.status).toBe(200);
      expect(res.body.disputes).toHaveLength(1);
      expect(res.body.disputes[0].reason).toBe("First dispute");
    });

    it("should return empty array when no disputes exist", async () => {
      const res = await request(app).get(`/api/claims/${claimId}/disputes`);
      expect(res.status).toBe(200);
      expect(res.body.disputes).toHaveLength(0);
    });

    it("should return 404 for non-existent claim", async () => {
      const res = await request(app).get("/api/claims/99999/disputes");
      expect(res.status).toBe(404);
    });
  });
});
