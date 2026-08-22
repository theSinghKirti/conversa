const mongoose = require("mongoose");

/**
 * LegalPrecedent Model
 *
 * Stores landmark court judgments, precedents, and legal rulings with
 * pre-computed text-embedding-004 vectors for semantic precedent search.
 */
const LegalPrecedentSchema = new mongoose.Schema(
  {
    precedentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    caseName: {
      type: String,
      required: true,
      trim: true,
    },
    court: {
      type: String,
      required: true,
      trim: true,
    },
    dateOrYear: {
      type: String,
      required: true,
      trim: true,
    },
    citation: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      trim: true,
      default: "Supreme Court Reports / Indian Kanoon",
    },
    legalDomain: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jurisdiction: {
      type: String,
      required: true,
      trim: true,
      default: "India",
      index: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    keyHoldings: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    embedding: {
      type: [Number],
      required: true,
      select: false, // exclude vector array from default queries
    },
  },
  {
    timestamps: true,
  }
);

LegalPrecedentSchema.index({ jurisdiction: 1, legalDomain: 1 });

const LegalPrecedent = mongoose.model("LegalPrecedent", LegalPrecedentSchema);
module.exports = LegalPrecedent;
