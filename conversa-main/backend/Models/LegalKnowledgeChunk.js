const mongoose = require("mongoose");

/**
 * LegalKnowledgeChunk
 *
 * Stores individual text chunks from legal knowledge documents along with
 * their pre-computed text-embedding-004 vectors (768 dimensions).
 *
 * This collection acts as the vector store for the Legal Advisory RAG layer.
 * The vector provider is fully encapsulated in vectorStore.js — swapping from
 * MongoDB aggregation-based similarity to Atlas $vectorSearch or Pinecone
 * requires changing only vectorStore.js, not this model.
 */
const LegalKnowledgeChunkSchema = new mongoose.Schema(
  {
    // Unique identifier for idempotent re-ingestion
    chunkId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Source document metadata
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
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
    source: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    lastUpdated: {
      type: String,
      trim: true,
      default: "",
    },

    // Chunk position within source document
    chunkIndex: {
      type: Number,
      required: true,
      default: 0,
    },
    totalChunks: {
      type: Number,
      required: true,
      default: 1,
    },

    // Text embedding vector — 768-dim from Google text-embedding-004
    // Stored as plain Number array; cosine similarity computed in aggregation
    embedding: {
      type: [Number],
      required: true,
      select: false, // exclude from normal queries to reduce payload size
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for jurisdiction + domain filtered retrieval
LegalKnowledgeChunkSchema.index({ jurisdiction: 1, legalDomain: 1 });

const LegalKnowledgeChunk = mongoose.model(
  "LegalKnowledgeChunk",
  LegalKnowledgeChunkSchema
);
module.exports = LegalKnowledgeChunk;
