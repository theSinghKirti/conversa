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
  listUsers,
  getStats,
  listEmergencyBroadcasts,
  createEmergencyBroadcast,
  deleteEmergencyBroadcast,
  listSecurityLogs,
} = require("../Controllers/admin-controller.js");

// All admin routes require a valid JWT (fetchuser) AND ADMIN role (requireAdmin)
const adminGuard = [fetchuser, requireAdmin];

// GET /admin/security-logs         – list security event logs
router.get("/security-logs", adminGuard, listSecurityLogs);

// GET /admin/emergency-messages   – list emergency broadcasts
router.get("/emergency-messages", adminGuard, listEmergencyBroadcasts);

// POST /admin/emergency-messages  – dispatch emergency broadcast
router.post("/emergency-messages", adminGuard, createEmergencyBroadcast);

// DELETE /admin/emergency-messages/:id – delete emergency broadcast record
router.delete("/emergency-messages/:id", adminGuard, deleteEmergencyBroadcast);

// GET /admin/stats                 – aggregate admin summary statistics
router.get("/stats", adminGuard, getStats);

// GET /admin/users                 – list registered users
router.get("/users", adminGuard, listUsers);

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
