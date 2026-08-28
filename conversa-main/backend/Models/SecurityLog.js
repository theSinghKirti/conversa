const mongoose = require("mongoose");
const crypto = require("crypto");

const generateLogId = () => {
  const bytes = crypto.randomBytes(3);
  const token = bytes.toString("hex").toUpperCase();
  return `SEC-${token}`;
};

const SecurityLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      unique: true,
      required: true,
      default: generateLogId,
    },
    ipAddress: {
      type: String,
      default: "127.0.0.1",
      trim: true,
    },
    actor: {
      type: String,
      default: "System",
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    target: {
      type: String,
      default: "",
      trim: true,
    },
    severity: {
      type: String,
      enum: ["INFO", "MEDIUM", "HIGH", "WARNING", "CRITICAL"],
      default: "INFO",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "ALLOWED", "BLOCKED", "FAILED"],
      default: "SUCCESS",
    },
  },
  {
    timestamps: true,
  }
);

SecurityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SecurityLog", SecurityLogSchema);
