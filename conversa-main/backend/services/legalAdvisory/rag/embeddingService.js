const { GoogleGenAI } = require("@google/genai");
const secrets = require("../../../secrets.js");

const DEFAULT_HF_MODEL = "BAAI/bge-m3";
const DEFAULT_GEMINI_MODEL = "gemini-embedding-001";

let ai;
let cachedApiKey;
let lastLoggedConfig = null;

function logProviderConfig(config) {
  const configKey = `${config.provider}:${config.model}:${config.expectedDims}`;
  if (lastLoggedConfig !== configKey) {
    lastLoggedConfig = configKey;
    console.log(
      `[EmbeddingService] Provider: ${config.provider}, Model: ${config.model}, Expected Dimensions: ${config.expectedDims}`
    );
  }
}

function createEmbeddingError(message, code, originalError) {
  const err = new Error(message);
  err.code = code;
  if (originalError && originalError.stack) {
    err.originalError = originalError;
  }
  return err;
}

/**
 * Resolves the active embedding provider based explicitly on LEGAL_EMBEDDING_PROVIDER.
 *
 * @returns {{ provider: "huggingface"|"gemini", apiKey: string, model: string, expectedDims: number }}
 */
const getActiveProvider = () => {
  const rawProvider = (
    process.env.LEGAL_EMBEDDING_PROVIDER ||
    secrets.LEGAL_EMBEDDING_PROVIDER ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!rawProvider || (rawProvider !== "huggingface" && rawProvider !== "gemini")) {
    throw createEmbeddingError(
      "LEGAL_EMBEDDING_PROVIDER must be explicitly set to 'huggingface' or 'gemini'.",
      "EMBEDDING_CONFIG_ERROR"
    );
  }

  if (rawProvider === "huggingface") {
    const hfKey =
      process.env.HUGGINGFACE_API_KEY ||
      secrets.HUGGINGFACE_API_KEY ||
      process.env.HF_TOKEN;

    if (!hfKey || typeof hfKey !== "string" || hfKey.trim().length === 0) {
      throw createEmbeddingError(
        "Embedding provider unavailable: HUGGINGFACE_API_KEY is missing.",
        "EMBEDDING_CONFIG_ERROR"
      );
    }

    const model =
      process.env.HUGGINGFACE_EMBEDDING_MODEL ||
      secrets.HUGGINGFACE_EMBEDDING_MODEL ||
      DEFAULT_HF_MODEL;

    const config = {
      provider: "huggingface",
      apiKey: hfKey.trim(),
      model,
      expectedDims: 1024,
    };
    logProviderConfig(config);
    return config;
  }

  if (rawProvider === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY || secrets.GEMINI_API_KEY;
    if (!geminiKey || typeof geminiKey !== "string" || geminiKey.trim().length === 0) {
      throw createEmbeddingError(
        "Embedding provider unavailable: GEMINI_API_KEY is missing.",
        "EMBEDDING_CONFIG_ERROR"
      );
    }

    const config = {
      provider: "gemini",
      apiKey: geminiKey.trim(),
      model: DEFAULT_GEMINI_MODEL,
      expectedDims: 768,
    };
    logProviderConfig(config);
    return config;
  }

  throw createEmbeddingError(
    "LEGAL_EMBEDDING_PROVIDER must be explicitly set to 'huggingface' or 'gemini'.",
    "EMBEDDING_CONFIG_ERROR"
  );
};

const getGeminiClient = (apiKey) => {
  if (!ai || cachedApiKey !== apiKey) {
    ai = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }
  return ai;
};

const _resetClient = () => {
  ai = null;
  cachedApiKey = null;
  lastLoggedConfig = null;
};

function validateEmbeddingValues(values, expectedDims) {
  const actualDims = Array.isArray(values)
    ? values.length
    : values === undefined
    ? "undefined"
    : values === null
    ? "null"
    : typeof values;

  const dims = expectedDims || 768;
  if (!Array.isArray(values) || values.length !== dims) {
    throw createEmbeddingError(
      `Embedding response shape invalid: expected an array with ${dims} values, received ${actualDims}.`,
      "EMBEDDING_RESPONSE_INVALID"
    );
  }

  return values;
}

/**
 * Embed a single text string using the explicitly configured provider.
 *
 * @param {string} text
 * @returns {Promise<number[]>} — Dense embedding vector
 */
async function embedText(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw createEmbeddingError("embedText: text must be a non-empty string.", "EMBEDDING_CONFIG_ERROR");
  }

  const active = getActiveProvider();

  if (active.provider === "huggingface") {
    const url = `https://router.huggingface.co/hf-inference/models/${active.model}`;
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${active.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text.trim() }),
      });
    } catch (netErr) {
      throw createEmbeddingError(
        `Hugging Face embedding network error: ${netErr.message}`,
        "EMBEDDING_PROVIDER_ERROR",
        netErr
      );
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw createEmbeddingError(
        `Hugging Face embedding request failed (${response.status}): ${errBody || response.statusText}`,
        "EMBEDDING_PROVIDER_ERROR"
      );
    }

    const data = await response.json();
    const rawVector = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : data;
    return validateEmbeddingValues(rawVector, active.expectedDims);
  }

  if (active.provider === "gemini") {
    const client = getGeminiClient(active.apiKey);

    let response;
    try {
      response = await client.models.embedContent({
        model: active.model,
        contents: text.trim(),
        config: { outputDimensionality: 768 },
      });
    } catch (err) {
      throw createEmbeddingError(
        `Gemini embedding request failed: ${err?.message || String(err)}`,
        "EMBEDDING_PROVIDER_ERROR",
        err
      );
    }

    const values =
      response?.embeddings?.[0]?.values !== undefined
        ? response.embeddings[0].values
        : response?.embedding?.values;
    return validateEmbeddingValues(values, active.expectedDims);
  }

  throw createEmbeddingError(
    "LEGAL_EMBEDDING_PROVIDER must be explicitly set to 'huggingface' or 'gemini'.",
    "EMBEDDING_CONFIG_ERROR"
  );
}

/**
 * Embed multiple texts sequentially.
 *
 * @param {string[]} texts
 * @param {{ delayMs?: number }} opts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, { delayMs = 150 } = {}) {
  if (!Array.isArray(texts)) {
    throw createEmbeddingError("embedBatch: texts must be an array.", "EMBEDDING_CONFIG_ERROR");
  }
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      results.push(await embedText(texts[i]));
    } catch (err) {
      throw createEmbeddingError(
        `embedBatch failed for item ${i + 1}/${texts.length}: ${err.message}`,
        err.code || "EMBEDDING_PROVIDER_ERROR",
        err
      );
    }
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

const EMBEDDING_DIMS = 768;

module.exports = {
  embedText,
  embedBatch,
  EMBEDDING_DIMS,
  validateEmbeddingValues,
  getActiveProvider,
  _resetClient,
};
