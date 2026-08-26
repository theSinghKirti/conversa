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

  test("returns FAILED when similaritySearch throws database error", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(10);
    embedText.mockResolvedValue(new Array(768).fill(0.01));
    similaritySearch.mockRejectedValue(new Error("Mongo connection timeout"));

    const result = await retrieve(intake);
    expect(result.status).toBe("FAILED");
    expect(result.sources).toEqual([]);
  });

  test("returns NOT_CONFIGURED when document count is 0 even after auto-seed attempt", async () => {
    LegalKnowledgeChunk.countDocuments.mockResolvedValue(0);

    const result = await retrieve(intake);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.sources).toEqual([]);
  });
});
