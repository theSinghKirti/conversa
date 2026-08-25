"use strict";

const { runPrecedentSearch } = require("./precedentAgent.js");
const { embedText } = require("./rag/embeddingService.js");
const { searchPrecedents } = require("./precedentSearchTool.js");
const LegalPrecedent = require("../../Models/LegalPrecedent.js");

jest.mock("./rag/embeddingService.js");
jest.mock("./precedentSearchTool.js");
jest.mock("../../Models/LegalPrecedent.js");

describe("precedentAgent", () => {
  const intake = {
    jurisdiction: "India",
    legalDomain: "Labour Law",
    caseType: "Wrongful Termination",
    summary: "Employer dismissed employee without notice or inquiry.",
    keywords: ["termination", "inquiry"],
    relevantEntities: ["employer", "workman"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns SUCCESS when precedents are found", async () => {
    LegalPrecedent.countDocuments.mockResolvedValue(5);
    embedText.mockResolvedValue(new Array(768).fill(0.02));
    searchPrecedents.mockResolvedValue([
      {
        precedentId: "p1",
        caseName: "Workmen v. Management",
        court: "Supreme Court of India",
        dateOrYear: "2015",
        citation: "(2015) 4 SCC 100",
        source: "SCR",
        summary: "Wrongful termination requires compliance with natural justice.",
        legalDomain: "Labour Law",
        jurisdiction: "India",
        relevanceScore: 0.88,
      },
    ]);

    const result = await runPrecedentSearch(intake);
    expect(result.status).toBe("SUCCESS");
    expect(result.precedents).toHaveLength(1);
    expect(result.precedents[0].caseName).toBe("Workmen v. Management");
  });

  test("returns NO_RESULTS when precedent search completes with 0 matches", async () => {
    LegalPrecedent.countDocuments.mockResolvedValue(5);
    embedText.mockResolvedValue(new Array(768).fill(0.02));
    searchPrecedents.mockResolvedValue([]);

    const result = await runPrecedentSearch(intake);
    expect(result.status).toBe("NO_RESULTS");
    expect(result.precedents).toEqual([]);
  });

  test("returns FAILED when embedding query fails (Gemini API error or missing key)", async () => {
    LegalPrecedent.countDocuments.mockResolvedValue(5);
    embedText.mockRejectedValue(new Error("Gemini embedding request failed: Quota exceeded"));

    const result = await runPrecedentSearch(intake);
    expect(result.status).toBe("FAILED");
    expect(result.precedents).toEqual([]);
    expect(searchPrecedents).not.toHaveBeenCalled();
  });

  test("returns FAILED when searchPrecedents throws DB aggregation error", async () => {
    LegalPrecedent.countDocuments.mockResolvedValue(5);
    embedText.mockResolvedValue(new Array(768).fill(0.02));
    searchPrecedents.mockRejectedValue(new Error("DB timeout during aggregation"));

    const result = await runPrecedentSearch(intake);
    expect(result.status).toBe("FAILED");
    expect(result.precedents).toEqual([]);
  });

  test("returns NOT_CONFIGURED when precedent store is empty even after auto-seed attempt", async () => {
    LegalPrecedent.countDocuments.mockResolvedValue(0);

    const result = await runPrecedentSearch(intake);
    expect(result.status).toBe("NOT_CONFIGURED");
    expect(result.precedents).toEqual([]);
  });
});
