const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const MembershipApplication = require("../Models/MembershipApplication.js");
const User = require("../Models/User.js");
const Conversation = require("../Models/Conversation.js");
const { JWT_SECRET } = require("../secrets.js");
const { transporter, logSafeSmtpError, EMAIL } = require("../utils/emailTransporter.js");

/**
 * Generate a 6-digit numeric OTP.
 */
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * POST /activation/request-otp
 *
 * Public endpoint to request a 6-digit activation OTP.
 */
const requestActivationOtp = async (req, res) => {
  try {
    const { memberId, email } = req.body;

    if (!memberId || !email) {
      return res.status(400).json({
        success: false,
        error: "Member ID and registered email are required.",
      });
    }

    const normalisedMemberId = memberId.trim().toUpperCase();
    const normalisedEmail = email.trim().toLowerCase();

    // Find the application matching both memberId and email
    const application = await MembershipApplication.findOne({
      memberId: normalisedMemberId,
      email: normalisedEmail,
    });

    if (!application) {
      // Security: do not leak whether memberId/email is valid or mismatch
      return res.status(400).json({
        success: false,
        error: "Invalid Member ID or email address.",
      });
    }

    // Check status
    if (application.status === "ACTIVE") {
      return res.status(409).json({
        success: false,
        error: "This membership is already active.",
      });
    }

    if (application.status === "REJECTED" || application.status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        error: `Activation is blocked because this application is ${application.status.toLowerCase()}.`,
      });
    }

    if (application.status !== "APPROVED_PENDING_VERIFICATION") {
      return res.status(400).json({
        success: false,
        error: "This application has not been approved for activation.",
      });
    }

    // Cooldown check: 60 seconds
    const now = new Date();
    if (
      application.activationOtpRequestedAt &&
      now - application.activationOtpRequestedAt < 60 * 1000
    ) {
      return res.status(429).json({
        success: false,
        error: "Please wait 60 seconds before requesting another OTP.",
      });
    }

    // Generate 6-digit OTP
    const rawOtp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    // Save details to database
    application.activationOtpHash = hashedOtp;
    application.activationOtpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    application.activationOtpRequestedAt = now;
    application.activationOtpAttempts = 0;
    await application.save();

    // Send email with OTP
    const mailOptions = {
      from: `"Conversa Community" <${EMAIL}>`,
      to: application.email,
      subject: `Your Membership Activation Code – ${rawOtp}`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Activation OTP</title>
</head>
<body style="font-family:sans-serif; background-color:#f3f4f6; padding:20px;">
  <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border-radius:8px; padding:30px; border:1px solid #e5e7eb;">
    <h2 style="color:#6366f1; margin-top:0;">Activate Member Account</h2>
    <p>Please use the verification code below to activate your account. This code is valid for 5 minutes.</p>
    <div style="background-color:#f5f3ff; border:2px dashed #8b5cf6; border-radius:6px; padding:15px; text-align:center; margin:20px 0;">
      <span style="font-size:32px; font-weight:bold; letter-spacing:4px; color:#6366f1;">${rawOtp}</span>
    </div>
    <p style="color:#6b7280; font-size:12px; text-align:center;">Do not share this code with anyone.</p>
  </div>
</body>
</html>`,
    };

    try {
      // Mock sending email in development/test environment or for mock emails
      if (process.env.NODE_ENV !== "production" || application.email.endsWith("@example.com")) {
        console.log(`\n==================================================`);
        console.log(`[DEV/TEST ONLY] ACTIVATION OTP FOR ${application.email}: ${rawOtp}`);
        console.log(`==================================================\n`);
      } else {
        await transporter.sendMail(mailOptions);
      }
    } catch (mailErr) {
      // Fallback to console print if SMTP fails for non-production domains
      if (process.env.NODE_ENV !== "production" || application.email.endsWith("@example.com")) {
        console.log(`\n==================================================`);
        console.log(`[DEV/TEST ONLY] ACTIVATION OTP FOR ${application.email}: ${rawOtp} (SMTP failed)`);
        console.log(`==================================================\n`);
      } else {
        logSafeSmtpError("requestActivationOtp", mailErr);
        return res.status(500).json({
          success: false,
          error: "Failed to deliver activation OTP. System SMTP service might be temporarily unavailable or misconfigured.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "An activation OTP has been sent to your registered email.",
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error("requestActivationOtp error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

/**
 * POST /activation/verify-otp
 *
 * Verifies the 6-digit OTP and creates the User account.
 */
const verifyActivationOtp = async (req, res) => {
  try {
    const { memberId, email, otp } = req.body;

    if (!memberId || !email || !otp) {
      return res.status(400).json({
        success: false,
        error: "Member ID, email and OTP code are required.",
      });
    }

    const normalisedMemberId = memberId.trim().toUpperCase();
    const normalisedEmail = email.trim().toLowerCase();

    // Find the application matching both memberId and email
    const application = await MembershipApplication.findOne({
      memberId: normalisedMemberId,
      email: normalisedEmail,
    });

    if (!application) {
      return res.status(400).json({
        success: false,
        error: "Invalid Member ID or email address.",
      });
    }

    // Verify application status is still pending verification
    if (application.status === "ACTIVE") {
      return res.status(409).json({
        success: false,
        error: "This membership is already active.",
      });
    }

    if (application.status !== "APPROVED_PENDING_VERIFICATION") {
      return res.status(400).json({
        success: false,
        error: "This application has not been approved for activation.",
      });
    }

    // Verify OTP attempt limit
    if (application.activationOtpAttempts >= 5) {
      return res.status(400).json({
        success: false,
        error: "Maximum verification attempts exceeded. Please request a new OTP.",
      });
    }

    // Verify OTP presence and expiry
    if (!application.activationOtpHash || !application.activationOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        error: "No OTP request found. Please request a new OTP.",
      });
    }

    if (application.activationOtpExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Please request a new one.",
      });
    }

    // Verify code match
    const isValidOtp = await bcrypt.compare(otp.toString().trim(), application.activationOtpHash);

    if (!isValidOtp) {
      // Increment attempt count atomically
      application.activationOtpAttempts += 1;
      await application.save();

      const remaining = 5 - application.activationOtpAttempts;
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Invalid OTP. You have ${remaining} attempts remaining.`
          : "Invalid OTP. Maximum verification attempts exceeded. Please request a new OTP.",
      });
    }

    // ── Create User & Transition Status (Consistency/Rollback Logic) ───

    // Check if conflicting User already exists
    const conflict = await User.findOne({
      $or: [
        { email: normalisedEmail },
        { memberId: normalisedMemberId },
        { membershipApplication: application._id },
      ],
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        error: "An account has already been registered with these member details.",
      });
    }

    // Create the User account
    let newUser;
    try {
      newUser = await User.create({
        name: application.name,
        email: normalisedEmail,
        memberId: normalisedMemberId,
        role: "MEMBER",
        accountStatus: "ACTIVE",
        authMethod: "OTP_ONLY",
        isEmailVerified: true,
        membershipApplication: application._id,
        profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(application.name)}&background=random&bold=true`,
        about: "Hello! I am a verified community member.",
        phone: application.phone || "",
        city: application.city || "",
        state: application.state || "",
        occupation: application.occupation || "",
        organisation: application.organisation || "",
        education: application.education || "",
        bloodGroup: application.bloodGroup || "",
        communityDetails: application.communityDetails || "",
      });
    } catch (createErr) {
      // Handle MongoDB unique index conflicts safely
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "An account has already been registered with these member details.",
        });
      }
      throw createErr;
    }

    // Transition the application to ACTIVE.
    // Use findOneAndUpdate with status filter to prevent race conditions.
    const updatedApplication = await MembershipApplication.findOneAndUpdate(
      { _id: application._id, status: "APPROVED_PENDING_VERIFICATION" },
      {
        $set: {
          status: "ACTIVE",
          activatedAt: new Date(),
          activatedUser: newUser._id,
          activationOtpHash: null,
          activationOtpExpiresAt: null,
          activationOtpAttempts: 0,
        },
      },
      { new: true }
    );

    if (!updatedApplication) {
      // Compensating action: another concurrent thread finished first and updated status.
      // Rollback User creation to guarantee 1-to-1 consistency.
      await User.findByIdAndDelete(newUser._id);
      return res.status(409).json({
        success: false,
        error: "This membership is already active.",
      });
    }

    // ── Create AI bot + initial conversation ────────────────────────────────
    // Each member gets their own dedicated AI bot instance so conversations
    // are isolated. We also create the initial bot conversation so the sidebar
    // chatbot button works immediately after activation.
    let botUser = null;
    try {
      botUser = await User.create({
        name: "AI Chatbot",
        email: normalisedEmail + "bot",
        password: "AI_CHATBOT_SECURE_DUMMY_PASSWORD",
        authMethod: "OTP_ONLY",
        about: "I am an AI Chatbot to help you",
        profilePic:
          "https://play-lh.googleusercontent.com/Oe0NgYQ63TGGEr7ViA2fGA-yAB7w2zhMofDBR3opTGVvsCFibD8pecWUjHBF_VnVKNdJ",
        isBot: true,
        isEmailVerified: true, // system accounts do not need email verification
      });

      await Conversation.create({
        members: [newUser._id, botUser._id],
        unreadCounts: [
          { userId: newUser._id, count: 0 },
          { userId: botUser._id, count: 0 },
        ],
      });
    } catch (botErr) {
      // Bot creation is best-effort. Log the error but do NOT fail activation —
      // the member account has already been created and the application transitioned.
      console.error("verifyActivationOtp: failed to create AI bot/conversation:", botErr.message);
    }

    // Generate JWT token matching the expected authentication contract
    const data = {
      user: {
        id: newUser.id,
      },
    };

    const authtoken = jwt.sign(data, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      success: true,
      message: "Your membership has been activated successfully.",
      authtoken,
      user: {
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        memberId: newUser.memberId,
        role: newUser.role,
        accountStatus: newUser.accountStatus,
        isEmailVerified: newUser.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("verifyActivationOtp error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = {
  requestActivationOtp,
  verifyActivationOtp,
};
