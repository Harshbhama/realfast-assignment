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

describe("Claims API", () => {
  describe("POST /api/claims", () => {
    it("should create a claim with line items", async () => {
      const res = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [
          { service_code: "GP_VISIT", description: "Office visit", billed_amount: 150 },
          { service_code: "BLOOD_TEST", description: "CBC panel", billed_amount: 75 },
        ],
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.status).toBe("SUBMITTED");
      expect(res.body.LineItems).toHaveLength(2);
      expect(res.body.LineItems[0].status).toBe("PENDING");
    });

    it("should reject claim without line items", async () => {
      const res = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [],
      });

      expect(res.status).toBe(400);
    });

    it("should reject claim missing required fields", async () => {
      const res = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
      });

      expect(res.status).toBe(400);
    });

    it("should reject claim with invalid billed_amount", async () => {
      const res = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [
          { service_code: "GP_VISIT", description: "Visit", billed_amount: -100 },
        ],
      });

      expect(res.status).toBe(400);
    });

    it("should reject claim with invalid date format", async () => {
      const res = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "not-a-date",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [
          { service_code: "GP_VISIT", description: "Visit", billed_amount: 100 },
        ],
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/claims", () => {
    it("should return all claims with includes", async () => {
      await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 200 }],
      });

      const res = await request(app).get("/api/claims");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty("LineItems");
      expect(res.body[0]).toHaveProperty("Member");
      expect(res.body[0]).toHaveProperty("Policy");
    });

    it("should return empty array when no claims exist", async () => {
      const res = await request(app).get("/api/claims");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/claims/:id", () => {
    it("should return a single claim with details", async () => {
      const created = await request(app).post("/api/claims").send({
        member_id: 1,
        policy_id: 1,
        service_date: "2025-06-15",
        provider_name: "Dr. Smith",
        diagnosis_code: "J06.9",
        line_items: [{ service_code: "GP_VISIT", description: "Visit", billed_amount: 200 }],
      });

      const res = await request(app).get(`/api/claims/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.provider_name).toBe("Dr. Smith");
      expect(res.body.LineItems).toHaveLength(1);
    });

    it("should return 404 for non-existent claim", async () => {
      const res = await request(app).get("/api/claims/99999");
      expect(res.status).toBe(404);
    });
  });
});
