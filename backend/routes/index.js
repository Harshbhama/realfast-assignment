const express = require("express");
const router = express.Router();

router.use("/", require("./claimProcessingRoutes"));

module.exports = router;
