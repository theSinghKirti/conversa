const mongoose = require("mongoose");
const crypto = require("crypto");

const generateLogId = () => {
  const bytes = crypto.randomBytes(3);
  const token = bytes.toString("hex").toUpperCase();
  return `AUD-${token}`;
};

const AuditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      unique: true,
      required: true,
      default: generateLogId,
    },
    actor: {
      type: String,
      default: "System Admin",
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    target: {
      type: String,
      default: "System",
      trim: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS",
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
