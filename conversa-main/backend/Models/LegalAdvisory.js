const mongoose = require("mongoose");

const LegalAdvisorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
    },
    jurisdiction: {
      type: String,
      trim: true,
      default: "India",
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    caseType: {
      type: String,
      trim: true,
      default: "",
    },
    legalDomain: {
      type: String,
      trim: true,
      default: "",
    },
    caseSummary: {
      type: String,
      trim: true,
      default: "",
    },
    advisoryResponse: {
      type: String,
      trim: true,
      default: "",
    },
    // Case Intake Agent output — stored for future retrieval/RAG use
    relevantEntities: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient per-user queries
LegalAdvisorySchema.index({ userId: 1, createdAt: -1 });

const LegalAdvisory = mongoose.model("LegalAdvisory", LegalAdvisorySchema);
module.exports = LegalAdvisory;
