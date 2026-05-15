const express = require("express");
const sequelize = require("./config/database");
require("./models");
const routes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", routes);

sequelize.sync()
.then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error("Failed to start:", err);
});
