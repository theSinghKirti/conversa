const mongoose = require("mongoose");

// Valid Indian blood groups
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// Allowed application statuses
const APPLICATION_STATUSES = [
  "PENDING",
  "APPROVED_PENDING_VERIFICATION",
  "ACTIVE",
  "REJECTED",
  "SUSPENDED",
];

const MembershipApplicationSchema = new mongoose.Schema(
  {
    // Generated only by the backend – never accepted from the client
    applicationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Assigned only on approval – never accepted from the client
    memberId: {
      type: String,
      trim: true,
      default: undefined,
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [80, "Name must not exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    // Accepts 10-digit Indian mobile numbers with optional +91 / 0 prefix
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^(\+91[\s-]?|0)?[6-9]\d{9}$/,
        "Please provide a valid Indian phone number",
      ],
    },

    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },

    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },

    occupation: {
      type: String,
      required: [true, "Occupation is required"],
      trim: true,
    },

    organisation: {
      type: String,
      trim: true,
      default: "",
    },

    education: {
      type: String,
      trim: true,
      default: "",
    },

    bloodGroup: {
      type: String,
      trim: true,
      enum: {
        values: BLOOD_GROUPS,
        message: `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}`,
      },
      default: undefined, // optional – do not store empty string
    },

    communityDetails: {
      type: String,
      trim: true,
      maxlength: [500, "Community details must not exceed 500 characters"],
      default: "",
    },

    // Applicant must explicitly agree – the API rejects false values
    consentAccepted: {
      type: Boolean,
      required: [true, "Consent is required"],
    },

    status: {
      type: String,
      enum: {
        values: APPLICATION_STATUSES,
        message: `Status must be one of: ${APPLICATION_STATUSES.join(", ")}`,
      },
      default: "PENDING",
    },

    // Admin-only fields – never written by the public endpoint
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason must not exceed 500 characters"],
      default: undefined,
    },

    reviewedAt: {
      type: Date,
      default: undefined,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },

    // Activation invitation status
    activationInviteStatus: {
      type: String,
      enum: ["NOT_SENT", "SENT", "FAILED"],
      default: "NOT_SENT",
    },

    activationInviteSentAt: {
      type: Date,
      default: undefined,
    },

    activationInviteError: {
      type: String,
      trim: true,
      default: undefined,
    },

    // OTP for registration verification
    activationOtpHash: {
      type: String,
      default: undefined,
    },

    activationOtpExpiresAt: {
      type: Date,
      default: undefined,
    },

    activationOtpRequestedAt: {
      type: Date,
      default: undefined,
    },

    activationOtpAttempts: {
      type: Number,
      default: 0,
    },

    activatedAt: {
      type: Date,
      default: undefined,
    },

    activatedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: undefined,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Sparse unique index: allows many documents to have no memberId (PENDING/REJECTED)
// while still enforcing uniqueness across all assigned Member IDs.
MembershipApplicationSchema.index({ memberId: 1 }, { unique: true, sparse: true });

const MembershipApplication = mongoose.model(
  "MembershipApplication",
  MembershipApplicationSchema
);

module.exports = MembershipApplication;
