"use strict";

const { rerankEvidence } = require("./evidenceReranker.js");

const intake = {
  jurisdiction: "India",
  legalDomain: "Labour Law",
  caseType: "Employment Dispute",
  summary: "The employer terminated the employee without notice.",
  keywords: ["termination", "notice period", "salary"],
  relevantEntities: ["employer", "employee"],
};

const makeLegalSource = (overrides = {}) => ({
  title: "Employment Rights A",
  content: "This source discusses India labour law, termination, notice period, and employee rights.",
  source: "Model Employment Law Guide",
  sourceUrl: "https://example.com/employment-a",
  legalDomain: "Labour Law",
  relevanceScore: 0.5,
  retrievalPass: "PASS_1_EXACT",
  confidenceLevel: "HIGH",
  ...overrides,
});

const makePrecedent = (overrides = {}) => ({
  caseName: "Alpha v. Beta",
  court: "Supreme Court of India",
  dateOrYear: "2018",
  citation: "(2018) 1 SCC 1",
  source: "Supreme Court Reports",
  summary: "A termination and notice-period dispute in India.",
  sourceUrl: "https://example.com/precedent-a",
  legalDomain: "Labour Law",
  jurisdiction: "India",
  relevanceScore: 0.5,
  retrievalPass: "PASS_1_EXACT",
  confidenceLevel: "HIGH",
  ...overrides,
});

describe("rerankEvidence", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test("ranks both successful branches deterministically", () => {
    const result = rerankEvidence({
      intake,
      ragResult: {
        status: "SUCCESS",
        sources: [
          makeLegalSource({ title: "Employment Rights Z", sourceUrl: "https://example.com/z" }),
          makeLegalSource({ title: "Employment Rights A", sourceUrl: "https://example.com/a" }),
        ],
      },
      precedentResult: {
        status: "SUCCESS",
        precedents: [
          makePrecedent({ caseName: "Zeta v. Omega", citation: "(2019) 2 SCC 2", sourceUrl: "https://example.com/zeta" }),
          makePrecedent({ caseName: "Alpha v. Beta", citation: "(2018) 1 SCC 1", sourceUrl: "https://example.com/alpha" }),
        ],
      },
    });

    expect(result.retrievalStatus).toEqual({ legal: "SUCCESS", precedents: "SUCCESS" });
    expect(result.legalSources.map((item) => item.title)).toEqual(["Employment Rights A", "Employment Rights Z"]);
    expect(result.precedents.map((item) => item.caseName)).toEqual(["Alpha v. Beta", "Zeta v. Omega"]);
    expect(result.legalSources[0]).toHaveProperty("finalScore");
    expect(result.legalSources[0]).toHaveProperty("rankingReasons");
  });

  test("deduplicates exact duplicate evidence independently", () => {
    const duplicateSource = makeLegalSource();
    const duplicatePrecedent = makePrecedent();

    const result = rerankEvidence({
      intake,
      ragResult: {
        status: "SUCCESS",
        sources: [duplicateSource, { ...duplicateSource }, makeLegalSource({ title: "Employment Rights B", sourceUrl: "https://example.com/b" })],
      },
      precedentResult: {
        status: "SUCCESS",
        precedents: [duplicatePrecedent, { ...duplicatePrecedent }, makePrecedent({ caseName: "Gamma v. Delta", citation: "(2020) 3 SCC 3", sourceUrl: "https://example.com/gamma" })],
      },
    });

    expect(result.legalSources).toHaveLength(2);
    expect(result.precedents).toHaveLength(2);
  });

  test("preserves NO_RESULTS when both branches return no evidence", () => {
    const result = rerankEvidence({
      intake,
      ragResult: { status: "NO_RESULTS", sources: [] },
      precedentResult: { status: "NO_RESULTS", precedents: [] },
    });

    expect(result.retrievalStatus).toEqual({ legal: "NO_RESULTS", precedents: "NO_RESULTS" });
    expect(result.legalSources).toEqual([]);
    expect(result.precedents).toEqual([]);
  });

  test("preserves FAILED status and keeps the successful branch", () => {
    const result = rerankEvidence({
      intake,
      ragResult: { status: "FAILED", sources: [] },
      precedentResult: { status: "SUCCESS", precedents: [makePrecedent()] },
    });

    expect(result.retrievalStatus).toEqual({ legal: "FAILED", precedents: "SUCCESS" });
    expect(result.legalSources).toEqual([]);
    expect(result.precedents).toHaveLength(1);
  });

  test("preserves SUCCESS when the other branch failed", () => {
    const result = rerankEvidence({
      intake,
      ragResult: { status: "SUCCESS", sources: [makeLegalSource()] },
      precedentResult: { status: "FAILED", precedents: [] },
    });

    expect(result.retrievalStatus).toEqual({ legal: "SUCCESS", precedents: "FAILED" });
    expect(result.legalSources).toHaveLength(1);
    expect(result.precedents).toEqual([]);
  });

  test("preserves FAILED when both branches fail", () => {
    const result = rerankEvidence({
      intake,
      ragResult: { status: "FAILED", sources: [] },
      precedentResult: { status: "FAILED", precedents: [] },
    });

    expect(result.retrievalStatus).toEqual({ legal: "FAILED", precedents: "FAILED" });
    expect(result.legalSources).toEqual([]);
    expect(result.precedents).toEqual([]);
  });

  test("preserves NOT_CONFIGURED without fabricating evidence", () => {
    const result = rerankEvidence({
      intake,
      ragResult: { status: "NOT_CONFIGURED", sources: [] },
      precedentResult: { status: "SUCCESS", precedents: [makePrecedent()] },
    });

    expect(result.retrievalStatus).toEqual({ legal: "NOT_CONFIGURED", precedents: "SUCCESS" });
    expect(result.legalSources).toEqual([]);
    expect(result.precedents).toHaveLength(1);
  });

  test("keeps ranking deterministic when scores tie", () => {
    const resultA = rerankEvidence({
      intake,
      ragResult: {
        status: "SUCCESS",
        sources: [
          makeLegalSource({ title: "Zeta Source", content: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/zeta" }),
          makeLegalSource({ title: "Alpha Source", content: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/alpha" }),
        ],
      },
      precedentResult: {
        status: "SUCCESS",
        precedents: [
          makePrecedent({ caseName: "Zeta Case", dateOrYear: "2019", citation: "(2019) 2 SCC 2", summary: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/zeta-case" }),
          makePrecedent({ caseName: "Alpha Case", dateOrYear: "2019", citation: "(2019) 1 SCC 1", summary: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/alpha-case" }),
        ],
      },
    });

    const resultB = rerankEvidence({
      intake,
      ragResult: {
        status: "SUCCESS",
        sources: [
          makeLegalSource({ title: "Zeta Source", content: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/zeta" }),
          makeLegalSource({ title: "Alpha Source", content: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/alpha" }),
        ],
      },
      precedentResult: {
        status: "SUCCESS",
        precedents: [
          makePrecedent({ caseName: "Zeta Case", dateOrYear: "2019", citation: "(2019) 2 SCC 2", summary: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/zeta-case" }),
          makePrecedent({ caseName: "Alpha Case", dateOrYear: "2019", citation: "(2019) 1 SCC 1", summary: "Shared legal context without unique ranking signal.", sourceUrl: "https://example.com/alpha-case" }),
        ],
      },
    });

    expect(resultA.legalSources.map((item) => item.title)).toEqual(resultB.legalSources.map((item) => item.title));
    expect(resultA.precedents.map((item) => item.caseName)).toEqual(resultB.precedents.map((item) => item.caseName));
    expect(resultA.legalSources.map((item) => item.title)).toEqual(["Alpha Source", "Zeta Source"]);
    expect(resultA.precedents.map((item) => item.caseName)).toEqual(["Alpha Case", "Zeta Case"]);
  });
});
