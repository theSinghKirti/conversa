const mongoose = require("mongoose");

const Userschema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    about: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: function() {
        return this.authMethod !== "OTP_ONLY";
      },
      minlength: 6,
    },
    profilePic: {
      type: String,
      default:
        "https://ui-avatars.com/api/?name=Conversa&background=random&bold=true",
    },
    otp: {
      type: String,
      default: "",
    },
    otpExpiry: {
      type: Date,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    isBot: {
      type: Boolean,
      default: false,
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pinnedConversations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Authorization role – never accepted from a public endpoint
    role: {
      type: String,
      enum: ["MEMBER", "ADMIN"],
      default: "MEMBER",
    },

    // Community Member ID
    memberId: {
      type: String,
      uppercase: true,
      trim: true,
      default: undefined,
    },

    // Account verification/status
    accountStatus: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
      default: "ACTIVE",
    },

    // Login mechanism
    authMethod: {
      type: String,
      enum: ["PASSWORD", "OTP_ONLY"],
      default: "PASSWORD",
    },

    // Reference to original membership application
    membershipApplication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipApplication",
      default: undefined,
    },

    // Directory Details
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    occupation: {
      type: String,
      trim: true,
      default: "",
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
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""],
      default: "",
    },
    communityDetails: {
      type: String,
      maxlength: [500, "Community details must not exceed 500 characters"],
      default: "",
    },

    // Directory Visibility Settings
    directoryVisibility: {
      showEmail: {
        type: Boolean,
        default: false,
      },
      showPhone: {
        type: Boolean,
        default: false,
      },
      showOrganisation: {
        type: Boolean,
        default: true,
      },
      showEducation: {
        type: Boolean,
        default: true,
      },
      showBloodGroup: {
        type: Boolean,
        default: true,
      },
      showCommunityDetails: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add unique sparse indexes to avoid conflict with null/undefined values
Userschema.index({ memberId: 1 }, { unique: true, sparse: true });
Userschema.index({ membershipApplication: 1 }, { unique: true, sparse: true });

// Add indexes for directory filter performance
Userschema.index({ city: 1 });
Userschema.index({ state: 1 });
Userschema.index({ occupation: 1 });
Userschema.index({ bloodGroup: 1 });

const User = mongoose.model("User", Userschema);
module.exports = User;
