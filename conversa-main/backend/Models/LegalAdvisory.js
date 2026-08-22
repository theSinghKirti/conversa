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
    // RAG — legal knowledge chunks retrieved for this advisory
    retrievedSources: {
      type: [
        {
          title:           { type: String, default: "" },
          content:         { type: String, default: "" },
          source:          { type: String, default: "" },
          sourceUrl:       { type: String, default: "" },
          legalDomain:     { type: String, default: "" },
          relevanceScore:  { type: Number, default: 0  },
          retrievalPass:   { type: String, default: "" },
          confidenceLevel: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Legal Precedent Search — verified precedent rulings
    precedents: {
      type: [
        {
          caseName:             { type: String, default: "" },
          court:                { type: String, default: "" },
          dateOrYear:           { type: String, default: "" },
          citation:             { type: String, default: "" },
          source:               { type: String, default: "" },
          summary:              { type: String, default: "" },
          relevanceExplanation: { type: String, default: "" },
          sourceUrl:            { type: String, default: "" },
          relevanceScore:       { type: Number, default: 0  },
          retrievalPass:        { type: String, default: "" },
          confidenceLevel:      { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Pipeline search status indicators
    ragSearchStatus: {
      type: String,
      enum: ["SUCCESS", "NO_RESULTS", "NOT_CONFIGURED", "FAILED"],
      default: "NOT_CONFIGURED",
    },
    precedentSearchStatus: {
      type: String,
      enum: ["SUCCESS", "NO_RESULTS", "NOT_CONFIGURED", "FAILED"],
      default: "NOT_CONFIGURED",
    },
    // Legal Drafter Agent structured output fields
    issueIdentified: {
      type: String,
      trim: true,
      default: "",
    },
    generalLegalContext: {
      type: String,
      trim: true,
      default: "",
    },
    possibleNextSteps: {
      type: [String],
      default: [],
    },
    documentsToGather: {
      type: [String],
      default: [],
    },
    limitationsAndUncertainty: {
      type: String,
      trim: true,
      default: "",
    },
    disclaimer: {
      type: String,
      trim: true,
      default: "",
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
