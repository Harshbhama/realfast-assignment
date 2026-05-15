const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Dispute = sequelize.define("Dispute", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  claim_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "OPEN",
    validate: {
      isIn: [["OPEN", "UNDER_REVIEW", "RESOLVED_UPHELD", "RESOLVED_OVERTURNED"]],
    },
  },
  resolution_notes: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Dispute;
