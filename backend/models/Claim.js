const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Claim = sequelize.define("Claim", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  policy_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  service_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  provider_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  diagnosis_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "SUBMITTED",
    validate: {
      isIn: [["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "DENIED", "PAID", "DISPUTED"]],
    },
  },
  submitted_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Claim;
