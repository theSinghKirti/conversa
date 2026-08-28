const crypto = require("crypto");
const MembershipApplication = require("../Models/MembershipApplication.js");
const User = require("../Models/User.js");
const sendActivationInvite = require("../utils/sendActivationInvite.js");

/* ─── helpers ─────────────────────────────────────────────────────────────── */

/**
 * Generate a unique Member ID such as "MEM-8K4P2Q".
 * Uses 6 cryptographically random uppercase alphanumeric characters.
 */
const generateMemberId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `MEM-${suffix}`;
};

/**
 * Pick a unique memberId with a single collision-retry.
 */
const getUniqueMemberId = async () => {
  let id = generateMemberId();
  const collision = await MembershipApplication.findOne({ memberId: id });
  if (collision) id = generateMemberId();
  return id;
};

/**
 * Build a safe search filter that prevents NoSQL operator injection.
 * The search term is treated as a literal regex (no operators).
 */
const buildSearchFilter = (search) => {
  if (!search || typeof search !== "string") return {};
  // Escape special regex characters from user input
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "i");
  return {
    $or: [
      { applicationId: { $regex: re } },
      { name: { $regex: re } },
      { email: { $regex: re } },
      { phone: { $regex: re } },
    ],
  };
};

/* ─── controllers ─────────────────────────────────────────────────────────── */

/**
 * GET /admin/applications
 *
 * Query params:
 *   status  – filter by status (default PENDING)
 *   search  – search applicationId, name, email, phone
 *   page    – page number (default 1)
 *   limit   – page size (default 20, max 50)
 *   sort    – "oldest" to sort oldest-first; default newest-first
 */
const listApplications = async (req, res) => {
  try {
    const VALID_STATUSES = [
      "PENDING",
      "APPROVED_PENDING_VERIFICATION",
      "ACTIVE",
      "REJECTED",
      "SUSPENDED",
    ];

    const { status = "PENDING", search, sort } = req.query;

    // Validate status
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    // Validate and clamp pagination
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    const skip = (page - 1) * limit;

    const sortOrder = sort === "oldest" ? 1 : -1;

    // Build query
    const filter = { status, ...buildSearchFilter(search) };

    const [applications, total] = await Promise.all([
      MembershipApplication.find(filter)
        .select(
          "applicationId name email phone city state occupation status createdAt"
        )
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      MembershipApplication.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listApplications error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * GET /admin/applications/:applicationId
 *
 * Returns full application detail for admin review.
 */
const getApplicationDetail = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await MembershipApplication.findOne({ applicationId })
      .select(
        "-__v -_id"
      )
      .populate("reviewedBy", "name email")
      .lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found.",
      });
    }

    return res.status(200).json({ success: true, application });
  } catch (error) {
    console.error("getApplicationDetail error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * PATCH /admin/applications/:applicationId/approve
 *
 * Atomically transitions a PENDING application to APPROVED_PENDING_VERIFICATION.
 * Generates a unique Member ID. Does NOT create a User, bot, Conversation or JWT.
 */
const approveApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const adminId = req.user.id;

    // Generate a unique member ID before the update
    const memberId = await getUniqueMemberId();
    const reviewedAt = new Date();

    // Atomic update: only succeeds if status is still PENDING.
    // If two admins hit this simultaneously, one will find no document
    // and receive the 409 response below.
    const updated = await MembershipApplication.findOneAndUpdate(
      { applicationId, status: "PENDING" },
      {
        $set: {
          status: "APPROVED_PENDING_VERIFICATION",
          memberId,
          reviewedAt,
          reviewedBy: adminId,
        },
      },
      { new: true }
    );

    if (!updated) {
      // Either not found, or already reviewed – distinguish the two
      const existing = await MembershipApplication.findOne({ applicationId }).select(
        "status"
      );
      if (!existing) {
        return res.status(404).json({ success: false, error: "Application not found." });
      }
      return res.status(409).json({
        success: false,
        error: "This application has already been reviewed.",
        status: existing.status,
      });
    }

    // Attempt to send the invitation email. Failure does not reverse database approval.
    let emailSent = false;
    let emailWarning = undefined;
    try {
      const emailResult = await sendActivationInvite(updated);
      if (emailResult.success) {
        updated.activationInviteStatus = "SENT";
        updated.activationInviteSentAt = new Date();
        updated.activationInviteError = undefined;
        emailSent = true;
      } else {
        updated.activationInviteStatus = "FAILED";
        updated.activationInviteError = emailResult.error;
        emailWarning = emailResult.error;
      }
    } catch (emailErr) {
      updated.activationInviteStatus = "FAILED";
      updated.activationInviteError = emailErr.message.slice(0, 100);
      emailWarning = "Failed to send activation email";
    }
    await updated.save();

    return res.status(200).json({
      success: true,
      message: emailSent
        ? "Application approved successfully."
        : `Application approved successfully, but invitation email failed to send: ${emailWarning}`,
      application: {
        applicationId: updated.applicationId,
        memberId: updated.memberId,
        name: updated.name,
        email: updated.email,
        status: updated.status,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error("approveApplication error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * PATCH /admin/applications/:applicationId/reject
 *
 * Atomically transitions a PENDING application to REJECTED.
 * Requires a reason. Does NOT delete the application.
 */
const rejectApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const adminId = req.user.id;
    const { reason } = req.body;

    // Validate rejection reason
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: "A rejection reason is required.",
      });
    }
    if (reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: "Rejection reason must not exceed 500 characters.",
      });
    }

    const reviewedAt = new Date();

    const updated = await MembershipApplication.findOneAndUpdate(
      { applicationId, status: "PENDING" },
      {
        $set: {
          status: "REJECTED",
          rejectionReason: reason.trim(),
          reviewedAt,
          reviewedBy: adminId,
        },
      },
      { new: true }
    ).select("applicationId status rejectionReason reviewedAt");

    if (!updated) {
      const existing = await MembershipApplication.findOne({ applicationId }).select(
        "status"
      );
      if (!existing) {
        return res.status(404).json({ success: false, error: "Application not found." });
      }
      return res.status(409).json({
        success: false,
        error: "This application has already been reviewed.",
        status: existing.status,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Application rejected.",
      application: {
        applicationId: updated.applicationId,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error("rejectApplication error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * POST /admin/applications/:applicationId/send-activation-invite
 *
 * Resends the activation invitation email. Applies a 60-second cooldown.
 * Only allowed for APPROVED_PENDING_VERIFICATION status.
 */
const resendActivationInvite = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await MembershipApplication.findOne({ applicationId });
    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found." });
    }

    if (application.status !== "APPROVED_PENDING_VERIFICATION") {
      return res.status(409).json({
        success: false,
        error: "Activation invitation is only available for approved applications pending verification.",
      });
    }

    // Cooldown check: 60 seconds
    const now = new Date();
    if (
      application.activationInviteSentAt &&
      now - application.activationInviteSentAt < 60 * 1000
    ) {
      return res.status(429).json({
        success: false,
        error: "Please wait 60 seconds before resending another invitation.",
      });
    }

    // Try sending email
    const emailResult = await sendActivationInvite(application);
    if (emailResult.success) {
      application.activationInviteStatus = "SENT";
      application.activationInviteSentAt = now;
      application.activationInviteError = undefined;
      await application.save();

      return res.status(200).json({
        success: true,
        message: "Activation invitation sent successfully.",
        invitation: {
          status: application.activationInviteStatus,
          sentAt: application.activationInviteSentAt,
        },
      });
    } else {
      application.activationInviteStatus = "FAILED";
      application.activationInviteError = emailResult.error;
      await application.save();

      return res.status(500).json({
        success: false,
        error: `Failed to resend invitation: ${emailResult.error}`,
      });
    }
  } catch (error) {
    console.error("resendActivationInvite error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/**
 * GET /admin/users
 *
 * Query params:
 *   search – search name, email, memberId
 *   page   – page number (default 1)
 *   limit  – page size (default 20, max 50)
 *
 * Returns registered users sorted newest first, selecting ONLY safe non-sensitive fields.
 */
const listUsers = async (req, res) => {
  try {
    const { search } = req.query;

    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };

    if (search && typeof search === "string" && search.trim() !== "") {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "i");
      filter.$or = [
        { name: { $regex: re } },
        { email: { $regex: re } },
        { memberId: { $regex: re } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(
          "_id name email role isOnline isEmailVerified accountStatus isBot createdAt memberId about profilePic lastSeen"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("listUsers error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch user directory list",
    });
  }
};

/**
 * GET /admin/stats
 *
 * Aggregate Admin Dashboard Overview statistics from MongoDB:
 * - pendingApplications: MembershipApplication count with status "PENDING"
 * - approvedApplications: MembershipApplication count with status "APPROVED_PENDING_VERIFICATION"
 * - activeMembers: User count with role "MEMBER", isDeleted false, accountStatus "ACTIVE", isBot false
 * - rejectedApplications: MembershipApplication count with status "REJECTED"
 * - inboxPosts: CommunityPost count with status "ACTIVE"
 * - failedActivations: MembershipApplication count with activationInviteStatus "FAILED"
 * - failedActivationsAvailable: true
 */
const getStats = async (req, res) => {
  try {
    const { CommunityPost } = require("../Models/CommunityPost.js");

    const [
      pendingApplications,
      approvedApplications,
      activeMembers,
      rejectedApplications,
      inboxPosts,
      failedActivations,
    ] = await Promise.all([
      MembershipApplication.countDocuments({ status: "PENDING" }),
      MembershipApplication.countDocuments({ status: "APPROVED_PENDING_VERIFICATION" }),
      User.countDocuments({ role: "MEMBER", isDeleted: { $ne: true }, accountStatus: "ACTIVE", isBot: { $ne: true } }),
      MembershipApplication.countDocuments({ status: "REJECTED" }),
      CommunityPost.countDocuments({ status: "ACTIVE" }),
      MembershipApplication.countDocuments({ activationInviteStatus: "FAILED" }),
    ]);

    const statsData = {
      pendingApplications,
      approvedApplications,
      activeMembers,
      rejectedApplications,
      inboxPosts,
      failedActivations,
      failedActivationsAvailable: true,
    };

    return res.status(200).json({
      success: true,
      data: statsData,
      ...statsData,
    });
  } catch (error) {
    console.error("getStats error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch dashboard statistics",
    });
  }
};

/**
 * GET /admin/emergency-messages
 * Returns list of saved emergency broadcasts sorted newest first.
 */
const listEmergencyBroadcasts = async (req, res) => {
  try {
    const EmergencyBroadcast = require("../Models/EmergencyBroadcast.js");
    const broadcasts = await EmergencyBroadcast.find()
      .sort({ createdAt: -1 })
      .limit(50);
    return res.status(200).json({
      success: true,
      broadcasts,
    });
  } catch (error) {
    console.error("listEmergencyBroadcasts error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch emergency broadcasts history",
    });
  }
};

/**
 * POST /admin/emergency-messages
 * Creates and saves a new emergency broadcast.
 */
const createEmergencyBroadcast = async (req, res) => {
  try {
    const EmergencyBroadcast = require("../Models/EmergencyBroadcast.js");
    const { getIo } = require("../socket/index.js");

    const { title, message, severity = "CRITICAL", targetGroup = "All Active Members" } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: "Alert title is required",
      });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message content is required",
      });
    }

    const validSeverities = ["CRITICAL", "WARNING", "INFO"];
    const normalizedSeverity = validSeverities.includes(severity?.toUpperCase())
      ? severity.toUpperCase()
      : "CRITICAL";

    const broadcast = await EmergencyBroadcast.create({
      title: title.trim(),
      message: message.trim(),
      severity: normalizedSeverity,
      targetGroup: targetGroup?.trim() || "All Active Members",
      createdBy: req.user.id,
      senderName: req.user.name || "Security Admin",
    });

    // Re-use Socket.IO to emit emergency broadcast event to all connected sockets
    try {
      const io = getIo();
      if (io) {
        io.emit("emergency-broadcast", broadcast);
      }
    } catch (socketErr) {
      console.warn("Socket broadcast emit warning:", socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Emergency broadcast sent successfully",
      broadcast,
    });
  } catch (error) {
    console.error("createEmergencyBroadcast error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to dispatch emergency broadcast alert",
    });
  }
};

/**
 * DELETE /admin/emergency-messages/:id
 * Removes an emergency broadcast record.
 */
const deleteEmergencyBroadcast = async (req, res) => {
  try {
    const EmergencyBroadcast = require("../Models/EmergencyBroadcast.js");
    const { id } = req.params;

    const deleted = await EmergencyBroadcast.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Emergency broadcast record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Emergency broadcast deleted successfully",
    });
  } catch (error) {
    console.error("deleteEmergencyBroadcast error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Failed to delete emergency broadcast record",
    });
  }
};

module.exports = {
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
};
