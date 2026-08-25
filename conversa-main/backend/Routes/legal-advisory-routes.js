const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser.js");
const requireAdmin = require("../middleware/requireAdmin.js");
const { analyzeQuery, getDataHealth } = require("../Controllers/legal-advisory-controller.js");

const adminGuard = [fetchuser, requireAdmin];

// POST /api/legal-advisory/analyze — requires authentication
router.post("/analyze", fetchuser, analyzeQuery);

// GET /api/legal-advisory/health/data — admin-only database health diagnostic
router.get("/health/data", adminGuard, getDataHealth);

module.exports = router;
