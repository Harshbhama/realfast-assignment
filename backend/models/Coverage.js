const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Coverage = sequelize.define("Coverage", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  policy_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  service_code: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  coverage_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  annual_limit: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
  indexes: [
    {
      unique: true,
      fields: ["policy_id", "service_code"],
    },
  ],
});

module.exports = Coverage;
