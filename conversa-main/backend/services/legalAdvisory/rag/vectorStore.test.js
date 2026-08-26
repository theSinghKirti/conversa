"use strict";

const {
  similaritySearch,
  validateStoredEmbeddingDimensions,
} = require("./vectorStore.js");
const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");

jest.mock("../../../Models/LegalKnowledgeChunk.js");

describe("vectorStore Dimension Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Schema validation", () => {
    test("LegalKnowledgeChunk schema includes optional embedding metadata fields", () => {
      const paths = LegalKnowledgeChunk.schema.paths;
      expect(paths).toHaveProperty("embeddingModel");
      expect(paths).toHaveProperty("embeddingProvider");
      expect(paths).toHaveProperty("embeddingDimensions");
    });
  });

  describe("validateStoredEmbeddingDimensions", () => {
    test("passes when all stored chunks have matching dimensions (768)", async () => {
      LegalKnowledgeChunk.aggregate.mockResolvedValue([]);

      await expect(
        validateStoredEmbeddingDimensions(768, { jurisdiction: "India" })
      ).resolves.toBeUndefined();

      expect(LegalKnowledgeChunk.aggregate).toHaveBeenCalledTimes(1);
    });

    test("throws EMBEDDING_DIMENSION_MISMATCH when 768-dim query vector encounters 1024-dim stored chunk", async () => {
      LegalKnowledgeChunk.aggregate.mockResolvedValue([
        {
          chunkId: "c_hf_1024",
          title: "HF Ingested Document",
          embeddingDimensions: 1024,
          actualLength: 1024,
        },
      ]);

      let thrownError;
      try {
        await validateStoredEmbeddingDimensions(768, { jurisdiction: "India" });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_DIMENSION_MISMATCH");
      expect(thrownError.message).toContain("dimension 768");
      expect(thrownError.message).toContain("dimension 1024");
      expect(thrownError.message).toContain("c_hf_1024");
    });

    test("throws EMBEDDING_DIMENSION_MISMATCH when 1024-dim query vector encounters 768-dim stored legacy chunk without metadata", async () => {
      LegalKnowledgeChunk.aggregate.mockResolvedValue([
        {
          chunkId: "c_legacy_768",
          title: "Legacy Gemini Chunk",
          embeddingDimensions: null,
          actualLength: 768,
        },
      ]);

      let thrownError;
      try {
        await validateStoredEmbeddingDimensions(1024, { jurisdiction: "India" });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_DIMENSION_MISMATCH");
      expect(thrownError.message).toContain("dimension 1024");
      expect(thrownError.message).toContain("dimension 768");
      expect(thrownError.message).toContain("c_legacy_768");
    });
  });

  describe("similaritySearch dimension protection", () => {
    test("halts and throws EMBEDDING_DIMENSION_MISMATCH before cosine aggregation when mismatch exists", async () => {
      LegalKnowledgeChunk.aggregate.mockResolvedValueOnce([
        {
          chunkId: "c_mismatch",
          title: "Incompatible Chunk",
          embeddingDimensions: 1024,
          actualLength: 1024,
        },
      ]);

      const query768 = new Array(768).fill(0.01);

      await expect(
        similaritySearch(query768, { jurisdiction: "India" })
      ).rejects.toMatchObject({
        code: "EMBEDDING_DIMENSION_MISMATCH",
      });

      // Validates that it called aggregate once for dimension check and did NOT continue to cosine pipeline
      expect(LegalKnowledgeChunk.aggregate).toHaveBeenCalledTimes(1);
    });
  });
});
