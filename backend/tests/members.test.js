const request = require("supertest");
const { app, sequelize, setupDatabase, seedTestData } = require("./setup");
const { Member } = require("../models");

beforeAll(async () => {
  await setupDatabase();
  await seedTestData();
});

afterAll(async () => {
  await sequelize.close();
});

describe("Members API", () => {
  describe("POST /api/members", () => {
    it("should create a new member on a valid policy", async () => {
      const res = await request(app).post("/api/members").send({
        member_no: "MEM-100",
        full_name: "Alice Johnson",
        dob: "1992-08-20",
        policy_id: 1,
      });

      expect(res.status).toBe(201);
      expect(res.body.member_no).toBe("MEM-100");
      expect(res.body.full_name).toBe("Alice Johnson");
      expect(res.body.policy_id).toBe(1);
    });

    it("should reject duplicate member_no", async () => {
      const res = await request(app).post("/api/members").send({
        member_no: "MEM-001",
        full_name: "Duplicate",
        dob: "1990-01-01",
        policy_id: 1,
      });

      expect(res.status).toBe(400);
    });

    it("should reject missing required fields", async () => {
      const res = await request(app).post("/api/members").send({
        full_name: "No Member No",
        dob: "1990-01-01",
      });

      expect(res.status).toBe(400);
    });

    it("should reject invalid date format for dob", async () => {
      const res = await request(app).post("/api/members").send({
        member_no: "MEM-200",
        full_name: "Bad Date",
        dob: "not-a-date",
        policy_id: 1,
      });

      expect(res.status).toBe(400);
    });

    it("should reject when policy_id is missing", async () => {
      const res = await request(app).post("/api/members").send({
        member_no: "MEM-300",
        full_name: "No Policy",
        dob: "1990-01-01",
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/members", () => {
    it("should return all members with their policies", async () => {
      const res = await request(app).get("/api/members");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toHaveProperty("Policy");
    });
  });
});

describe("Policies API", () => {
  describe("GET /api/policies", () => {
    it("should return all policies", async () => {
      const res = await request(app).get("/api/policies");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);
    });
  });

  describe("GET /api/policies/:id", () => {
    it("should return a policy with coverage rules", async () => {
      const res = await request(app).get("/api/policies/1");
      expect(res.status).toBe(200);
      expect(res.body.plan_name).toBe("Standard Health 2025");
      expect(res.body.Coverages).toBeDefined();
      expect(res.body.Coverages.length).toBeGreaterThan(0);
      expect(res.body.Coverages[0]).toHaveProperty("Service");
    });

    it("should return 404 for non-existent policy", async () => {
      const res = await request(app).get("/api/policies/99999");
      expect(res.status).toBe(404);
    });
  });
});

describe("Services API", () => {
  describe("GET /api/services", () => {
    it("should return all service codes", async () => {
      const res = await request(app).get("/api/services");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(8);
      expect(res.body[0]).toHaveProperty("code");
      expect(res.body[0]).toHaveProperty("name");
    });
  });
});
