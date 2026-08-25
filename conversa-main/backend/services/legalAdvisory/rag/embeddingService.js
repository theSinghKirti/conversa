const { GoogleGenAI } = require("@google/genai");
const secrets = require("../../../secrets.js");

const DEFAULT_HF_MODEL = "BAAI/bge-m3";
const DEFAULT_GEMINI_MODEL = "gemini-embedding-001";

let ai;
let cachedApiKey;

const getActiveProvider = () => {
  const hfKey = process.env.HUGGINGFACE_API_KEY || secrets.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
  if (hfKey && typeof hfKey === "string" && hfKey.trim().length > 0) {
    return {
      provider: "huggingface",
      apiKey: hfKey.trim(),
      model: process.env.HUGGINGFACE_EMBEDDING_MODEL || secrets.HUGGINGFACE_EMBEDDING_MODEL || DEFAULT_HF_MODEL,
      expectedDims: 1024,
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY || secrets.GEMINI_API_KEY;
  if (geminiKey && typeof geminiKey === "string" && geminiKey.trim().length > 0) {
    return {
      provider: "gemini",
      apiKey: geminiKey.trim(),
      model: DEFAULT_GEMINI_MODEL,
      expectedDims: 768,
    };
  }

  return { provider: "none", apiKey: null, model: null, expectedDims: 768 };
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
    throw new Error(
      `Embedding response shape invalid: expected an array with ${dims} values, received ${actualDims}.`
    );
  }

  return values;
}

/**
 * Embed a single text string using the active configured provider.
 *
 * @param {string} text
 * @returns {Promise<number[]>} — Dense embedding vector
 */
async function embedText(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embedText: text must be a non-empty string.");
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
      throw new Error(`Hugging Face embedding network error: ${netErr.message}`);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Hugging Face embedding request failed (${response.status}): ${errBody || response.statusText}`);
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
      throw new Error(`Gemini embedding request failed: ${err?.message || String(err)}`);
    }

    const values =
      response?.embeddings?.[0]?.values !== undefined
        ? response.embeddings[0].values
        : response?.embedding?.values;
    return validateEmbeddingValues(values, active.expectedDims);
  }

  throw new Error("Embedding provider unavailable: GEMINI_API_KEY is missing.");
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
    throw new Error("embedBatch: texts must be an array.");
  }
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      results.push(await embedText(texts[i]));
    } catch (err) {
      throw new Error(`embedBatch failed for item ${i + 1}/${texts.length}: ${err.message}`);
    }
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

const EMBEDDING_DIMS = 768;

module.exports = { embedText, embedBatch, EMBEDDING_DIMS, getActiveProvider, _resetClient };
