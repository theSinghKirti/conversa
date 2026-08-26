"use strict";

const { retrieve } = require("./legalRetriever.js");
const { embedText } = require("./embeddingService.js");
const { similaritySearch } = require("./vectorStore.js");
const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");

jest.mock("./embeddingService.js");
jest.mock("./vectorStore.js");
jest.mock("../../../Models/LegalKnowledgeChunk.js");

describe("legalRetriever", () => {
  const intake = {
    jurisdiction: "India",
    legalDomain: "Labour Law",
    caseType: "Wrongful Termination",
    summary: "Employer fired employee without notice period.",
    keywords: ["termination", "notice"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns SUCCESS when vector search finds matching documents", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    embedText.mockResolvedValue(new Array(768).fill(0.01));
    similaritySearch.mockResolvedValue([
      {
        chunkId: "c1",
        title: "Industrial Disputes Act",
        content: "Section 25F conditions for retrenchment.",
        source: "Acts",
        sourceUrl: "https://example.com/act",
        legalDomain: "Labour Law",
        relevanceScore: 0.85,
      },
    ]);

    const result = await retrieve(intake);
    expect(result.status).toBe("SUCCESS");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe("Industrial Disputes Act");
    expect(result.sources[0].retrievalPass).toBe("PASS_1_EXACT");
  });

  test("returns NO_RESULTS when vector search finds 0 matches above threshold", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    embedText.mockResolvedValue(new Array(768).fill(0.01));
    similaritySearch.mockResolvedValue([]);

    const result = await retrieve(intake);
    expect(result.status).toBe("NO_RESULTS");
    expect(result.sources).toEqual([]);
  });

  test("re-throws error upward when query embedding generation fails without continuing to vector search", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    const embeddingError = new Error("Embedding provider unavailable: GEMINI_API_KEY is missing.");
    embeddingError.code = "EMBEDDING_CONFIG_ERROR";
    embedText.mockRejectedValue(embeddingError);

    await expect(retrieve(intake)).rejects.toThrow(
      "Embedding provider unavailable: GEMINI_API_KEY is missing."
    );
    // Ensure similarity search is NOT called when query embedding fails
    expect(similaritySearch).not.toHaveBeenCalled();
  });

  test("re-throws error upward with code AUTO_SEED_FAILED when auto-seeding embedding fails", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(0);
    embedText.mockRejectedValue(new Error("Gemini quota exceeded during auto-seeding"));

    let thrownError;
    try {
      await retrieve(intake);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain("Legal knowledge auto-seeding failed for");
    expect(thrownError.message).toContain("Gemini quota exceeded during auto-seeding");
    expect(thrownError.code).toBe("AUTO_SEED_FAILED");
  });

  test("re-throws error upward when similaritySearch throws EMBEDDING_DIMENSION_MISMATCH", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    embedText.mockResolvedValue(new Array(768).fill(0.01));
    const mismatchErr = new Error("Embedding dimension mismatch: query vector has dimension 768, but stored chunk has dimension 1024.");
    mismatchErr.code = "EMBEDDING_DIMENSION_MISMATCH";
    similaritySearch.mockRejectedValue(mismatchErr);

    await expect(retrieve(intake)).rejects.toThrow(
      "Embedding dimension mismatch: query vector has dimension 768, but stored chunk has dimension 1024."
    );
  });

  test("returns FAILED when similaritySearch throws generic database error", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    embedText.mockResolvedValue(new Array(768).fill(0.01));
    similaritySearch.mockRejectedValue(new Error("Mongo connection timeout"));

    const result = await retrieve(intake);
    expect(result.status).toBe("FAILED");
    expect(result.sources).toEqual([]);
  });
});
