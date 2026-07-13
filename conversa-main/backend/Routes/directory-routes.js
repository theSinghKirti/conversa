const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser.js");
const requireActiveAccount = require("../middleware/requireActiveAccount.js");

const {
  listMembers,
  getMemberDetail,
  getMyPrivacySettings,
  updateMyPrivacySettings,
} = require("../Controllers/directory-controller.js");

// All directory endpoints require valid JWT and active membership
const directoryGuard = [fetchuser, requireActiveAccount];

// GET /directory/members          – Search, filter, and paginate members
router.get("/members", directoryGuard, listMembers);

// GET /directory/members/:memberId – Single member details with visibility settings applied
router.get("/members/:memberId", directoryGuard, getMemberDetail);

// GET /directory/me/privacy        – Retrieve personal directory settings
router.get("/me/privacy", directoryGuard, getMyPrivacySettings);

// PATCH /directory/me/privacy      – Update personal directory settings
router.patch("/me/privacy", directoryGuard, updateMyPrivacySettings);

module.exports = router;
