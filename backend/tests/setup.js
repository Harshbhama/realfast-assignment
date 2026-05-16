const express = require("express");
const sequelize = require("../config/database");
require("../models");
const routes = require("../routes");
const { Service, Policy, Coverage, Member, Claim, LineItem, Dispute } = require("../models");

const app = express();
app.use(express.json());
app.use("/api", routes);

async function setupDatabase() {
  await sequelize.query("PRAGMA foreign_keys = ON;");
  await sequelize.sync({ force: true });
}

async function seedTestData() {
  await Service.bulkCreate([
    { code: "GP_VISIT", name: "General Practitioner Visit" },
    { code: "SPECIALIST_VISIT", name: "Specialist Visit" },
    { code: "DENTAL_CLEANING", name: "Dental Cleaning" },
    { code: "DENTAL_FILLING", name: "Dental Filling" },
    { code: "MRI", name: "MRI Scan" },
    { code: "XRAY", name: "X-Ray" },
    { code: "BLOOD_TEST", name: "Blood Test" },
    { code: "PHYSIOTHERAPY", name: "Physiotherapy Session" },
  ]);

  await Policy.bulkCreate([
    {
      policy_number: "POL-2025-0001",
      plan_name: "Standard Health 2025",
      deductible_amount: 500.00,
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      status: "ACTIVE",
    },
    {
      policy_number: "POL-2025-0002",
      plan_name: "Premium Health 2025",
      deductible_amount: 1000.00,
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      status: "ACTIVE",
    },
    {
      policy_number: "POL-2025-0003",
      plan_name: "Basic Dental 2025",
      deductible_amount: 200.00,
      effective_from: "2025-01-01",
      effective_to: "2025-12-31",
      status: "ACTIVE",
    },
  ]);

  await Coverage.bulkCreate([
    { policy_id: 1, service_code: "GP_VISIT", coverage_percentage: 80.00, annual_limit: 2000.00 },
    { policy_id: 1, service_code: "SPECIALIST_VISIT", coverage_percentage: 60.00, annual_limit: 3000.00 },
    { policy_id: 1, service_code: "MRI", coverage_percentage: 70.00, annual_limit: 5000.00 },
    { policy_id: 1, service_code: "XRAY", coverage_percentage: 80.00, annual_limit: 1000.00 },
    { policy_id: 1, service_code: "BLOOD_TEST", coverage_percentage: 70.00, annual_limit: 1000.00 },
    { policy_id: 1, service_code: "PHYSIOTHERAPY", coverage_percentage: 50.00, annual_limit: 1500.00 },
    { policy_id: 2, service_code: "GP_VISIT", coverage_percentage: 90.00, annual_limit: 5000.00 },
    { policy_id: 2, service_code: "SPECIALIST_VISIT", coverage_percentage: 80.00, annual_limit: 5000.00 },
    { policy_id: 2, service_code: "MRI", coverage_percentage: 85.00, annual_limit: 10000.00 },
    { policy_id: 2, service_code: "XRAY", coverage_percentage: 90.00, annual_limit: 2000.00 },
    { policy_id: 2, service_code: "BLOOD_TEST", coverage_percentage: 85.00, annual_limit: 2000.00 },
    { policy_id: 2, service_code: "PHYSIOTHERAPY", coverage_percentage: 70.00, annual_limit: 3000.00 },
    { policy_id: 2, service_code: "DENTAL_CLEANING", coverage_percentage: 80.00, annual_limit: 500.00 },
    { policy_id: 2, service_code: "DENTAL_FILLING", coverage_percentage: 70.00, annual_limit: 1000.00 },
    { policy_id: 3, service_code: "DENTAL_CLEANING", coverage_percentage: 100.00, annual_limit: 300.00 },
    { policy_id: 3, service_code: "DENTAL_FILLING", coverage_percentage: 80.00, annual_limit: 500.00 },
    { policy_id: 3, service_code: "XRAY", coverage_percentage: 70.00, annual_limit: 400.00 },
  ]);

  await Member.create({
    member_no: "MEM-001",
    full_name: "John Doe",
    dob: "1990-05-15",
    policy_id: 1,
  });

  await Member.create({
    member_no: "MEM-002",
    full_name: "Jane Smith",
    dob: "1985-03-22",
    policy_id: 2,
  });
}

async function cleanClaims() {
  await Dispute.destroy({ where: {} });
  await LineItem.destroy({ where: {} });
  await Claim.destroy({ where: {} });
}

module.exports = { app, sequelize, setupDatabase, seedTestData, cleanClaims };
