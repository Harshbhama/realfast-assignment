const { User } = require("../models");

exports.createUser = (data) => {
  return User.create(data);
};

exports.getAllUsers = () => {
  return User.findAll();
};

exports.getUserById = (id) => {
  return User.findByPk(id);
};

exports.updateUser = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  return user.update(data);
};

exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) return null;
  await user.destroy();
  return true;
};
