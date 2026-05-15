const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Policy = sequelize.define("Policy", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  policy_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  plan_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  deductible_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  effective_from: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  effective_to: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [["ACTIVE", "EXPIRED", "CANCELLED"]],
    },
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Policy;
