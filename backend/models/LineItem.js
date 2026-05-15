const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LineItem = sequelize.define("LineItem", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  claim_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  service_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  billed_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  approved_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "PENDING",
    validate: {
      isIn: [["PENDING", "APPROVED", "DENIED", "NEEDS_REVIEW"]],
    },
  },
  denial_reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = LineItem;
