const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY } = require("../../../secrets.js");

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMS  = 768;

let ai;
const getClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
};

/**
 * Deterministic pseudo-embedding generator for offline / fallback environment.
 * Generates a unit-normalized 768-dim vector based on text token hashing.
 */
function generateFallbackEmbedding(text) {
  const vec = new Array(EMBEDDING_DIMS).fill(0);
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    vec[0] = 1;
    return vec;
  }

  words.forEach((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % EMBEDDING_DIMS;
    vec[idx] += 1;
  });

  // Normalize to unit vector
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < EMBEDDING_DIMS; i++) {
      vec[i] /= mag;
    }
  } else {
    vec[0] = 1;
  }

  return vec;
}

/**
 * Embed a single text string.
 *
 * @param {string} text
 * @returns {Promise<number[]>} — 768-dimensional embedding vector
 */
async function embedText(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embedText: text must be a non-empty string.");
  }

  const client = getClient();
  if (!client) {
    console.warn("[embeddingService] GEMINI_API_KEY missing — using deterministic fallback embedding.");
    return generateFallbackEmbedding(text);
  }

  try {
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.trim(),
    });

    const values = response?.embeddings?.[0]?.values;
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
      console.warn(`[embeddingService] Unexpected embedding shape from API. Using fallback.`);
      return generateFallbackEmbedding(text);
    }
    return values;
  } catch (err) {
    console.warn("[embeddingService] Google Embed API failed:", err.message, "— using fallback embedding.");
    return generateFallbackEmbedding(text);
  }
}

/**
 * Embed multiple texts sequentially.
 *
 * @param {string[]} texts
 * @param {{ delayMs?: number }} opts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, { delayMs = 150 } = {}) {
  const results = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(await embedText(texts[i]));
    if (i < texts.length - 1 && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

module.exports = { embedText, embedBatch, EMBEDDING_DIMS };
