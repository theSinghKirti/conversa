const express = require("express");
const router = express.Router();

const { submitApplication } = require("../Controllers/application-controller.js");

// POST /application/apply  – public endpoint, no authentication required
router.post("/apply", submitApplication);

module.exports = router;
