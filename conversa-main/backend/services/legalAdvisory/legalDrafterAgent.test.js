"use strict";

const { runDrafter, generateFallbackDrafter, _resetClient } = require("./legalDrafterAgent.js");
const { GoogleGenAI } = require("@google/genai");

jest.mock("@google/genai");

describe("legalDrafterAgent", () => {
  const mockQuery = "My employer terminated me without notice period.";
  const mockIntake = {
    caseType: "Wrongful Termination",
    legalDomain: "Labour Law",
    summary: "Fired without notice.",
    relevantEntities: ["Employer", "Employee"],
    keywords: ["termination", "notice"],
    jurisdiction: "India",
  };

  const sampleJsonResponse = JSON.stringify({
    issueIdentified: "Wrongful termination under Labour Law.",
    generalLegalContext: "Section 25F conditions apply.",
    relevantLegalInformation: [],
    possibleNextSteps: ["1. Send legal notice"],
    documentsToGather: ["Appointment letter"],
    limitationsAndUncertainty: "Consult an advocate.",
    disclaimer: "Informational only.",
  });

  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetClient();
    global.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("Flow 1: Groq success returns parsed structured drafter output", async () => {
    process.env.GROQ_API_KEY = "mock_groq_key";
    process.env.GEMINI_API_KEY = "mock_gemini_key";

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: sampleJsonResponse } }],
      }),
    });

    const result = await runDrafter(mockQuery, mockIntake, [], []);

    expect(result.issueIdentified).toBe("Wrongful termination under Labour Law.");
    expect(result.generalLegalContext).toBe("Section 25F conditions apply.");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(GoogleGenAI).not.toHaveBeenCalled();
  });

  test("Flow 2: Groq failure + Gemini success falls back to Gemini", async () => {
    process.env.GROQ_API_KEY = "mock_groq_key";
    process.env.GEMINI_API_KEY = "mock_gemini_key";

    // Groq fails with 500 error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Internal Server Error",
    });

    const mockGenerateContent = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: sampleJsonResponse }],
          },
        },
      ],
    });

    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));

    const result = await runDrafter(mockQuery, mockIntake, [], []);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(result.issueIdentified).toBe("Wrongful termination under Labour Law.");
  });

  test("Flow 3: Groq failure + Gemini failure throws AI_GENERATION_FAILED", async () => {
    process.env.GROQ_API_KEY = "mock_groq_key";
    process.env.GEMINI_API_KEY = "mock_gemini_key";

    // Groq network error
    global.fetch.mockRejectedValueOnce(new Error("Groq network timeout"));

    const mockGenerateContent = jest.fn().mockRejectedValue(new Error("Gemini quota exceeded"));
    GoogleGenAI.mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    }));

    let thrownError;
    try {
      await runDrafter(mockQuery, mockIntake, [], []);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.code).toBe("AI_GENERATION_FAILED");
    expect(thrownError.message).toContain("Legal Advisory Drafter failed across all configured AI providers");
    expect(thrownError.message).toContain("Groq");
    expect(thrownError.message).toContain("Gemini");
  });

  test("Flow 4: No provider configured throws AI_PROVIDER_NOT_CONFIGURED", async () => {
    process.env.GROQ_API_KEY = "";
    process.env.GEMINI_API_KEY = "";

    let thrownError;
    try {
      await runDrafter(mockQuery, mockIntake, [], []);
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.code).toBe("AI_PROVIDER_NOT_CONFIGURED");
    expect(thrownError.message).toBe("No AI generation provider is configured.");
  });

  test("generateFallbackDrafter remains exported and directly callable", () => {
    const fallback = generateFallbackDrafter(mockQuery, mockIntake, [], []);
    expect(fallback).toHaveProperty("issueIdentified");
    expect(fallback).toHaveProperty("possibleNextSteps");
    expect(fallback.possibleNextSteps.length).toBeGreaterThan(0);
  });
});
