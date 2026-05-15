const sequelize = require("./config/database");
const { Service, Policy, Coverage } = require("./models");

async function seed() {
  try {
    await sequelize.query("PRAGMA foreign_keys = ON;");

    const services = await Service.bulkCreate([
      { code: "GP_VISIT", name: "General Practitioner Visit" },
      { code: "SPECIALIST_VISIT", name: "Specialist Visit" },
      { code: "DENTAL_CLEANING", name: "Dental Cleaning" },
      { code: "DENTAL_FILLING", name: "Dental Filling" },
      { code: "MRI", name: "MRI Scan" },
      { code: "XRAY", name: "X-Ray" },
      { code: "BLOOD_TEST", name: "Blood Test" },
      { code: "PHYSIOTHERAPY", name: "Physiotherapy Session" },
    ]);
    console.log(`Seeded ${services.length} services.`);

    const policies = await Policy.bulkCreate([
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
    console.log(`Seeded ${policies.length} policies.`);

    const coverages = await Coverage.bulkCreate([
      // Policy 1 — Standard Health
      { policy_id: 1, service_code: "GP_VISIT", coverage_percentage: 80.00, annual_limit: 2000.00 },
      { policy_id: 1, service_code: "SPECIALIST_VISIT", coverage_percentage: 60.00, annual_limit: 3000.00 },
      { policy_id: 1, service_code: "MRI", coverage_percentage: 70.00, annual_limit: 5000.00 },
      { policy_id: 1, service_code: "XRAY", coverage_percentage: 80.00, annual_limit: 1000.00 },
      { policy_id: 1, service_code: "BLOOD_TEST", coverage_percentage: 70.00, annual_limit: 1000.00 },
      { policy_id: 1, service_code: "PHYSIOTHERAPY", coverage_percentage: 50.00, annual_limit: 1500.00 },

      // Policy 2 — Premium Health
      { policy_id: 2, service_code: "GP_VISIT", coverage_percentage: 90.00, annual_limit: 5000.00 },
      { policy_id: 2, service_code: "SPECIALIST_VISIT", coverage_percentage: 80.00, annual_limit: 5000.00 },
      { policy_id: 2, service_code: "MRI", coverage_percentage: 85.00, annual_limit: 10000.00 },
      { policy_id: 2, service_code: "XRAY", coverage_percentage: 90.00, annual_limit: 2000.00 },
      { policy_id: 2, service_code: "BLOOD_TEST", coverage_percentage: 85.00, annual_limit: 2000.00 },
      { policy_id: 2, service_code: "PHYSIOTHERAPY", coverage_percentage: 70.00, annual_limit: 3000.00 },
      { policy_id: 2, service_code: "DENTAL_CLEANING", coverage_percentage: 80.00, annual_limit: 500.00 },
      { policy_id: 2, service_code: "DENTAL_FILLING", coverage_percentage: 70.00, annual_limit: 1000.00 },

      // Policy 3 — Basic Dental
      { policy_id: 3, service_code: "DENTAL_CLEANING", coverage_percentage: 100.00, annual_limit: 300.00 },
      { policy_id: 3, service_code: "DENTAL_FILLING", coverage_percentage: 80.00, annual_limit: 500.00 },
      { policy_id: 3, service_code: "XRAY", coverage_percentage: 70.00, annual_limit: 400.00 },
    ]);
    console.log(`Seeded ${coverages.length} coverages.`);

    console.log("Seed complete.");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
