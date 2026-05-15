const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Member = sequelize.define("Member", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  member_no: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dob: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  policy_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  createdAt: "created_at",
  updatedAt: "updated_at",
});

module.exports = Member;
