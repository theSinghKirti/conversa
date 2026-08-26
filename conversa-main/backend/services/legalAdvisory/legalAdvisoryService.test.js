"use strict";

const { generateAdvisory } = require("./legalAdvisoryService.js");
const { runIntake } = require("./caseIntakeAgent.js");
const { retrieve } = require("./rag/legalRetriever.js");
const { runPrecedentSearch } = require("./precedentAgent.js");
const { runDrafter } = require("./legalDrafterAgent.js");

jest.mock("./caseIntakeAgent.js");
jest.mock("./rag/legalRetriever.js");
jest.mock("./precedentAgent.js");
jest.mock("./legalDrafterAgent.js");

describe("legalAdvisoryService Orchestrator", () => {
  const mockIntake = {
    caseType: "Wrongful Termination",
    legalDomain: "Labour Law",
    summary: "Fired without notice.",
    relevantEntities: ["Employer", "Employee"],
    keywords: ["termination", "notice"],
    jurisdiction: "India",
  };

  const mockDrafterOutput = {
    issueIdentified: "Wrongful termination issue",
    generalLegalContext: "Section 25F conditions apply.",
    relevantLegalInformation: [],
    possibleNextSteps: ["1. Review employment agreement", "2. Send legal notice"],
    documentsToGather: ["Appointment letter", "Termination letter"],
    limitationsAndUncertainty: "Consult an advocate.",
    disclaimer: "Informational only.",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    runIntake.mockResolvedValue(mockIntake);
    runPrecedentSearch.mockResolvedValue({ status: "SUCCESS", precedents: [] });
    runDrafter.mockResolvedValue(mockDrafterOutput);
  });

  test("RAG succeeds: runs entire pipeline through Drafter and returns structured advisory", async () => {
    retrieve.mockResolvedValue({
      status: "SUCCESS",
      sources: [
        {
          title: "Industrial Disputes Act",
          content: "Section 25F retrenchment conditions.",
          source: "Act",
          sourceUrl: "https://example.com",
          legalDomain: "Labour Law",
          relevanceScore: 0.85,
        },
      ],
    });

    const result = await generateAdvisory("Fired without notice", "India");

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(runDrafter).toHaveBeenCalledTimes(1);
    expect(result.ragSearchStatus).toBe("SUCCESS");
    expect(result.retrievedSources).toHaveLength(1);
    expect(result.advisoryResponse).toContain("ISSUE IDENTIFIED");
  });

  test("RAG returns NO_RESULTS: continues to Drafter with empty sources and NO_RESULTS status", async () => {
    retrieve.mockResolvedValue({
      status: "NO_RESULTS",
      sources: [],
    });

    const result = await generateAdvisory("Fired without notice", "India");

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(runDrafter).toHaveBeenCalledTimes(1);
    expect(result.ragSearchStatus).toBe("NO_RESULTS");
    expect(result.retrievedSources).toEqual([]);
    expect(result.advisoryResponse).toContain("ISSUE IDENTIFIED");
  });

  test("RAG throws EMBEDDING_FAILED: rejects immediately, stops pipeline, and does NOT run Drafter", async () => {
    const embeddingError = new Error("Embedding provider unavailable: GEMINI_API_KEY is missing.");
    embeddingError.code = "EMBEDDING_FAILED";
    retrieve.mockRejectedValue(embeddingError);

    await expect(generateAdvisory("Fired without notice", "India")).rejects.toThrow(
      "Embedding provider unavailable: GEMINI_API_KEY is missing."
    );

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(runDrafter).not.toHaveBeenCalled();
  });

  test("RAG throws AUTO_SEED_FAILED: rejects immediately, stops pipeline, and does NOT run Drafter", async () => {
    const seedError = new Error("Legal knowledge auto-seeding failed for labour-law.json: Rate limit exceeded");
    seedError.code = "AUTO_SEED_FAILED";
    retrieve.mockRejectedValue(seedError);

    await expect(generateAdvisory("Fired without notice", "India")).rejects.toThrow(
      "Legal knowledge auto-seeding failed for labour-law.json: Rate limit exceeded"
    );

    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(runDrafter).not.toHaveBeenCalled();
  });
});
