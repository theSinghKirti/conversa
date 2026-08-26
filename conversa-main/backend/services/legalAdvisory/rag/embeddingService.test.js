"use strict";

const { GoogleGenAI } = require("@google/genai");
const {
  embedText,
  embedBatch,
  EMBEDDING_DIMS,
  getActiveProvider,
  _resetClient,
} = require("./embeddingService.js");
const secrets = require("../../../secrets.js");

jest.mock("@google/genai");

describe("embeddingService", () => {
  const originalEnvGeminiKey = process.env.GEMINI_API_KEY;
  const originalEnvHfKey = process.env.HUGGINGFACE_API_KEY;
  const originalEnvProvider = process.env.LEGAL_EMBEDDING_PROVIDER;
  const originalSecretGeminiKey = secrets.GEMINI_API_KEY;
  const originalSecretHfKey = secrets.HUGGINGFACE_API_KEY;
  const originalSecretProvider = secrets.LEGAL_EMBEDDING_PROVIDER;

  let mockEmbedContent;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetClient();

    process.env.LEGAL_EMBEDDING_PROVIDER = "gemini";
    secrets.LEGAL_EMBEDDING_PROVIDER = "gemini";

    delete process.env.HUGGINGFACE_API_KEY;
    secrets.HUGGINGFACE_API_KEY = "";
    process.env.GEMINI_API_KEY = "test-gemini-key";
    secrets.GEMINI_API_KEY = "test-gemini-key";

    mockEmbedContent = jest.fn();
    GoogleGenAI.mockImplementation(() => ({
      models: {
        embedContent: mockEmbedContent,
      },
    }));
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalEnvGeminiKey;
    process.env.HUGGINGFACE_API_KEY = originalEnvHfKey;
    process.env.LEGAL_EMBEDDING_PROVIDER = originalEnvProvider;
    secrets.GEMINI_API_KEY = originalSecretGeminiKey;
    secrets.HUGGINGFACE_API_KEY = originalSecretHfKey;
    secrets.LEGAL_EMBEDDING_PROVIDER = originalSecretProvider;
  });

  describe("Provider configuration validation", () => {
    test("throws explicit configuration error when LEGAL_EMBEDDING_PROVIDER is missing", () => {
      delete process.env.LEGAL_EMBEDDING_PROVIDER;
      secrets.LEGAL_EMBEDDING_PROVIDER = "";

      expect(() => getActiveProvider()).toThrow(
        "LEGAL_EMBEDDING_PROVIDER must be explicitly set to 'huggingface' or 'gemini'."
      );
    });

    test("throws explicit configuration error when LEGAL_EMBEDDING_PROVIDER is invalid", () => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "openai";
      secrets.LEGAL_EMBEDDING_PROVIDER = "openai";

      expect(() => getActiveProvider()).toThrow(
        "LEGAL_EMBEDDING_PROVIDER must be explicitly set to 'huggingface' or 'gemini'."
      );
    });

    test("does not automatically select Hugging Face just because HUGGINGFACE_API_KEY exists when provider is gemini", () => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "gemini";
      process.env.HUGGINGFACE_API_KEY = "hf_token_123";
      process.env.GEMINI_API_KEY = "gemini_key_123";

      const provider = getActiveProvider();
      expect(provider.provider).toBe("gemini");
      expect(provider.expectedDims).toBe(768);
    });

    test("does not automatically select Gemini when provider is huggingface", () => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "huggingface";
      process.env.HUGGINGFACE_API_KEY = "hf_token_123";
      process.env.GEMINI_API_KEY = "gemini_key_123";

      const provider = getActiveProvider();
      expect(provider.provider).toBe("huggingface");
      expect(provider.expectedDims).toBe(1024);
    });
  });

  describe("embedText (Gemini provider)", () => {
    beforeEach(() => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "gemini";
      secrets.LEGAL_EMBEDDING_PROVIDER = "gemini";
    });

    test("validates that text is a non-empty string", async () => {
      await expect(embedText("")).rejects.toThrow("embedText: text must be a non-empty string.");
      await expect(embedText("   ")).rejects.toThrow("embedText: text must be a non-empty string.");
      await expect(embedText(null)).rejects.toThrow("embedText: text must be a non-empty string.");
      await expect(embedText(123)).rejects.toThrow("embedText: text must be a non-empty string.");
      await expect(embedText({})).rejects.toThrow("embedText: text must be a non-empty string.");
    });

    test("throws explicit provider-specific error when GEMINI_API_KEY is missing", async () => {
      delete process.env.GEMINI_API_KEY;
      secrets.GEMINI_API_KEY = "";

      await expect(embedText("Legal dispute query")).rejects.toThrow(
        "Embedding provider unavailable: GEMINI_API_KEY is missing."
      );
    });

    test("successfully embeds text using gemini-embedding-001 and returns 768-dim array", async () => {
      const mockVector = new Array(768).fill(0.0123);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: mockVector }],
      });

      const result = await embedText("  Tenant eviction notice notice period  ");

      expect(mockEmbedContent).toHaveBeenCalledTimes(1);
      expect(mockEmbedContent).toHaveBeenCalledWith({
        model: "gemini-embedding-001",
        contents: "Tenant eviction notice notice period",
        config: { outputDimensionality: 768 },
      });
      expect(result).toHaveLength(EMBEDDING_DIMS);
      expect(result).toBe(mockVector);
    });

    test("supports response format with single embedding.values", async () => {
      const mockVector = new Array(768).fill(0.0456);
      mockEmbedContent.mockResolvedValueOnce({
        embedding: { values: mockVector },
      });

      const result = await embedText("Wrongful termination query");
      expect(result).toHaveLength(768);
      expect(result).toBe(mockVector);
    });

    test("throws explicit error preserving original failure reason when Gemini API call fails", async () => {
      mockEmbedContent.mockRejectedValueOnce(new Error("Quota exceeded / Rate limit"));

      await expect(embedText("Valid query")).rejects.toThrow(
        "Gemini embedding request failed: Quota exceeded / Rate limit"
      );
    });

    test("throws explicit error with actual and expected dims when embedding shape is invalid", async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: new Array(512).fill(0.1) }],
      });

      await expect(embedText("Test input")).rejects.toThrow(
        "Embedding response shape invalid: expected an array with 768 values, received 512."
      );

      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: null }],
      });

      await expect(embedText("Test input")).rejects.toThrow(
        "Embedding response shape invalid: expected an array with 768 values, received null."
      );
    });
  });

  describe("embedText (Hugging Face provider)", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "huggingface";
      secrets.LEGAL_EMBEDDING_PROVIDER = "huggingface";
      process.env.HUGGINGFACE_API_KEY = "hf_test_token";
      secrets.HUGGINGFACE_API_KEY = "hf_test_token";
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test("throws explicit provider-specific error when HUGGINGFACE_API_KEY is missing", async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      secrets.HUGGINGFACE_API_KEY = "";

      await expect(embedText("Labour law compliance query")).rejects.toThrow(
        "Embedding provider unavailable: HUGGINGFACE_API_KEY is missing."
      );
    });

    test("successfully embeds text using Hugging Face 1024-dim BGE-M3 model", async () => {
      const mockVector1024 = new Array(1024).fill(0.005);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVector1024,
      });

      const result = await embedText("Labour law compliance query");
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1024);
      expect(result).toEqual(mockVector1024);
    });

    test("handles Hugging Face nested array output format", async () => {
      const mockVector1024 = new Array(1024).fill(0.007);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockVector1024],
      });

      const result = await embedText("Consumer protection query");
      expect(result).toHaveLength(1024);
    });

    test("throws clear error when Hugging Face API responds with error status", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "Model is currently loading",
      });

      await expect(embedText("Test query")).rejects.toThrow(
        "Hugging Face embedding request failed (503): Model is currently loading"
      );
    });
  });

  describe("embedBatch", () => {
    beforeEach(() => {
      process.env.LEGAL_EMBEDDING_PROVIDER = "gemini";
      secrets.LEGAL_EMBEDDING_PROVIDER = "gemini";
    });

    test("validates that texts is an array", async () => {
      await expect(embedBatch("not-an-array")).rejects.toThrow("embedBatch: texts must be an array.");
    });

    test("embeds multiple texts sequentially and returns all vectors", async () => {
      const vec1 = new Array(768).fill(0.1);
      const vec2 = new Array(768).fill(0.2);

      mockEmbedContent
        .mockResolvedValueOnce({ embeddings: [{ values: vec1 }] })
        .mockResolvedValueOnce({ embeddings: [{ values: vec2 }] });

      const results = await embedBatch(["Text 1", "Text 2"], { delayMs: 10 });
      expect(results).toHaveLength(2);
      expect(results[0]).toBe(vec1);
      expect(results[1]).toBe(vec2);
    });

    test("fails clearly and propagates error if any item in batch fails", async () => {
      const vec1 = new Array(768).fill(0.1);
      mockEmbedContent
        .mockResolvedValueOnce({ embeddings: [{ values: vec1 }] })
        .mockRejectedValueOnce(new Error("API network failure"));

      await expect(embedBatch(["Text 1", "Text 2"], { delayMs: 0 })).rejects.toThrow(
        "embedBatch failed for item 2/2: Gemini embedding request failed: API network failure"
      );
    });
  });
});
