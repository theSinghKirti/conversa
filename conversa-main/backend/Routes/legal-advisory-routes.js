const express = require("express");
const router = express.Router();

const { analyzeQuery } = require("../Controllers/legal-advisory-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

// POST /api/legal-advisory/analyze — requires authentication
router.post("/analyze", fetchuser, analyzeQuery);

module.exports = router;
