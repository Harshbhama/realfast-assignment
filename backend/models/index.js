const Service = require("./Service");
const Policy = require("./Policy");
const Coverage = require("./Coverage");
const Member = require("./Member");
const Claim = require("./Claim");
const LineItem = require("./LineItem");
const Dispute = require("./Dispute");

// Policy ↔ Coverage ↔ Service
Policy.hasMany(Coverage, { foreignKey: "policy_id", onDelete: "CASCADE" });
Coverage.belongsTo(Policy, { foreignKey: "policy_id" });
Service.hasMany(Coverage, { foreignKey: "service_code", onDelete: "CASCADE" });
Coverage.belongsTo(Service, { foreignKey: "service_code" });

// Policy ↔ Member
Policy.hasMany(Member, { foreignKey: "policy_id", onDelete: "CASCADE" });
Member.belongsTo(Policy, { foreignKey: "policy_id" });

// Member ↔ Claim, Policy ↔ Claim
Member.hasMany(Claim, { foreignKey: "member_id", onDelete: "CASCADE" });
Claim.belongsTo(Member, { foreignKey: "member_id" });
Policy.hasMany(Claim, { foreignKey: "policy_id", onDelete: "CASCADE" });
Claim.belongsTo(Policy, { foreignKey: "policy_id" });

// Claim ↔ LineItem ↔ Service
Claim.hasMany(LineItem, { foreignKey: "claim_id", onDelete: "CASCADE" });
LineItem.belongsTo(Claim, { foreignKey: "claim_id" });
Service.hasMany(LineItem, { foreignKey: "service_code", onDelete: "CASCADE" });
LineItem.belongsTo(Service, { foreignKey: "service_code" });

// Claim ↔ Dispute
Claim.hasMany(Dispute, { foreignKey: "claim_id", onDelete: "CASCADE" });
Dispute.belongsTo(Claim, { foreignKey: "claim_id" });

module.exports = { Service, Policy, Coverage, Member, Claim, LineItem, Dispute };
