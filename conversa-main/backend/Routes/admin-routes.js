const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser.js");
const requireAdmin = require("../middleware/requireAdmin.js");

const {
  listApplications,
  getApplicationDetail,
  approveApplication,
  rejectApplication,
  resendActivationInvite,
} = require("../Controllers/admin-controller.js");

// All admin routes require a valid JWT (fetchuser) AND ADMIN role (requireAdmin)
const adminGuard = [fetchuser, requireAdmin];

// GET /admin/applications          – list applications with filter/search/pagination
router.get("/applications", adminGuard, listApplications);

// GET /admin/applications/:applicationId  – full application detail
router.get("/applications/:applicationId", adminGuard, getApplicationDetail);

// PATCH /admin/applications/:applicationId/approve  – approve a PENDING application
router.patch("/applications/:applicationId/approve", adminGuard, approveApplication);

// PATCH /admin/applications/:applicationId/reject   – reject a PENDING application
router.patch("/applications/:applicationId/reject", adminGuard, rejectApplication);

// POST /admin/applications/:applicationId/send-activation-invite – resend invitation
router.post("/applications/:applicationId/send-activation-invite", adminGuard, resendActivationInvite);

module.exports = router;
