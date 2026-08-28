const mongoose = require("mongoose");
const crypto = require("crypto");

const generateAlertId = () => {
  const bytes = crypto.randomBytes(3);
  const token = bytes.toString("hex").toUpperCase();
  return `EMG-${token}`;
};

const EmergencyBroadcastSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      unique: true,
      required: true,
      default: generateAlertId,
    },
    title: {
      type: String,
      required: [true, "Alert title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [120, "Title must not exceed 120 characters"],
    },
    message: {
      type: String,
      required: [true, "Message content is required"],
      trim: true,
      minlength: [2, "Message must be at least 2 characters"],
      maxlength: [2000, "Message must not exceed 2000 characters"],
    },
    severity: {
      type: String,
      enum: ["CRITICAL", "WARNING", "INFO"],
      default: "CRITICAL",
      required: true,
    },
    targetGroup: {
      type: String,
      default: "All Active Members",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    senderName: {
      type: String,
      default: "Security Admin",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

EmergencyBroadcastSchema.index({ createdAt: -1 });

module.exports = mongoose.model("EmergencyBroadcast", EmergencyBroadcastSchema);
