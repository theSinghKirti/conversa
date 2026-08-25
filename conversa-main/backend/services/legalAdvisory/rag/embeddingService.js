const { GoogleGenAI } = require("@google/genai");
const secrets = require("../../../secrets.js");

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMS = 768;

let ai;
let cachedApiKey;

const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || secrets.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    throw new Error("Embedding provider unavailable: GEMINI_API_KEY is missing.");
  }
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

function validateEmbeddingValues(values) {
  const actualDims = Array.isArray(values)
    ? values.length
    : values === undefined
    ? "undefined"
    : values === null
    ? "null"
    : typeof values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `Gemini embedding response shape invalid: expected an array with ${EMBEDDING_DIMS} values, received ${actualDims}.`
    );
  }

  return values;
}

/**
 * Embed a single text string.
 *
 * @param {string} text
 * @returns {Promise<number[]>} — 768-dimensional embedding vector
 */
async function embedText(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embedText: text must be a non-empty string.");
  }

  const client = getClient();

  let response;
  try {
    response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.trim(),
    });
  } catch (err) {
    throw new Error(`Gemini embedding request failed: ${err?.message || String(err)}`);
  }

  const values =
    response?.embeddings?.[0]?.values !== undefined
      ? response.embeddings[0].values
      : response?.embedding?.values;
  return validateEmbeddingValues(values);
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

module.exports = { embedText, embedBatch, EMBEDDING_DIMS, _resetClient };
