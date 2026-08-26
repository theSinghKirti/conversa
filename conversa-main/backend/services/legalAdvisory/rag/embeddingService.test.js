"use strict";

const {
  embedText,
  embedBatch,
  EMBEDDING_DIMS,
  validateEmbeddingValues,
  getActiveProvider,
  _resetClient,
} = require("./embeddingService.js");
const secrets = require("../../../secrets.js");

describe("embeddingService (Hugging Face BAAI/bge-m3 1024-dim)", () => {
  const originalEnvHfKey = process.env.HUGGINGFACE_API_KEY;
  const originalSecretHfKey = secrets.HUGGINGFACE_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetClient();
    process.env.HUGGINGFACE_API_KEY = "hf_test_token";
    secrets.HUGGINGFACE_API_KEY = "hf_test_token";
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.HUGGINGFACE_API_KEY = originalEnvHfKey;
    secrets.HUGGINGFACE_API_KEY = originalSecretHfKey;
    global.fetch = originalFetch;
  });

  describe("Provider configuration", () => {
    test("reports Hugging Face provider with 1024 dimensions", () => {
      const provider = getActiveProvider();
      expect(provider.provider).toBe("huggingface");
      expect(provider.model).toBeDefined();
      expect(provider.expectedDims).toBe(1024);
      expect(EMBEDDING_DIMS).toBe(1024);
    });

    test("throws explicit EMBEDDING_CONFIG_ERROR when HUGGINGFACE_API_KEY is missing", async () => {
      delete process.env.HUGGINGFACE_API_KEY;
      delete process.env.HF_TOKEN;
      secrets.HUGGINGFACE_API_KEY = "";

      let thrownError;
      try {
        await embedText("Labour law dispute");
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_CONFIG_ERROR");
      expect(thrownError.message).toBe("Embedding provider unavailable: HUGGINGFACE_API_KEY is missing.");
    });
  });

  describe("embedText", () => {
    test("validates that text is a non-empty string", async () => {
      await expect(embedText("")).rejects.toMatchObject({
        code: "EMBEDDING_CONFIG_ERROR",
        message: "embedText: text must be a non-empty string.",
      });
      await expect(embedText("   ")).rejects.toMatchObject({
        code: "EMBEDDING_CONFIG_ERROR",
      });
      await expect(embedText(null)).rejects.toMatchObject({
        code: "EMBEDDING_CONFIG_ERROR",
      });
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

    test("handles Hugging Face nested array output format [[...]]", async () => {
      const mockVector1024 = new Array(1024).fill(0.007);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockVector1024],
      });

      const result = await embedText("Consumer protection query");
      expect(result).toHaveLength(1024);
    });

    test("throws EMBEDDING_PROVIDER_ERROR when Hugging Face API responds with error status", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "Model is currently loading",
      });

      let thrownError;
      try {
        await embedText("Test query");
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_PROVIDER_ERROR");
      expect(thrownError.message).toContain("Hugging Face embedding request failed (503): Model is currently loading");
    });

    test("throws EMBEDDING_PROVIDER_ERROR on network failure", async () => {
      global.fetch.mockRejectedValueOnce(new Error("fetch failed (connection reset)"));

      let thrownError;
      try {
        await embedText("Test query");
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_PROVIDER_ERROR");
      expect(thrownError.message).toContain("Hugging Face embedding network error: fetch failed (connection reset)");
    });

    test("throws EMBEDDING_DIMENSION_INVALID when vector length is not 1024", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => new Array(768).fill(0.01), // wrong dimension
      });

      let thrownError;
      try {
        await embedText("Test input");
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.code).toBe("EMBEDDING_DIMENSION_INVALID");
      expect(thrownError.message).toBe("Embedding response shape invalid: expected an array with 1024 values, received 768.");
    });
  });

  describe("embedBatch", () => {
    test("validates that texts is an array", async () => {
      await expect(embedBatch("not-an-array")).rejects.toMatchObject({
        code: "EMBEDDING_CONFIG_ERROR",
        message: "embedBatch: texts must be an array.",
      });
    });

    test("embeds multiple texts sequentially and returns all 1024-dim vectors", async () => {
      const vec1 = new Array(1024).fill(0.1);
      const vec2 = new Array(1024).fill(0.2);

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => vec1 })
        .mockResolvedValueOnce({ ok: true, json: async () => vec2 });

      const results = await embedBatch(["Text 1", "Text 2"], { delayMs: 10 });
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(vec1);
      expect(results[1]).toEqual(vec2);
    });

    test("fails clearly and propagates error if any item in batch fails", async () => {
      const vec1 = new Array(1024).fill(0.1);
      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => vec1 })
        .mockRejectedValueOnce(new Error("Network disconnect"));

      await expect(embedBatch(["Text 1", "Text 2"], { delayMs: 0 })).rejects.toThrow(
        "embedBatch failed for item 2/2: Hugging Face embedding network error: Network disconnect"
      );
    });
  });
});
