const sequelize = require("./config/database");
require("./models");

async function sync() {
  try {
    await sequelize.sync({ force: true });
    console.log("All tables synced successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to sync tables:", error);
    process.exit(1);
  }
}

sync();
