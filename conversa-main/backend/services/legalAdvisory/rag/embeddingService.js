const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY } = require("../../../secrets.js");

/**
 * embeddingService.js
 *
 * Thin wrapper around Google's text-embedding-004 model.
 * Reuses the existing GEMINI_API_KEY and lazy-init pattern from the app.
 *
 * Model: text-embedding-004
 *   - 768-dimensional dense vectors
 *   - State-of-the-art retrieval quality for English + Indian legal text
 *   - Available via the same @google/genai SDK already installed
 *
 * This service is the ONLY place in the RAG layer that knows about the
 * embedding model. Swapping to a different model (e.g. text-multilingual-
 * embedding-002) requires changing only this file.
 */

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
 * Embed a single text string.
 *
 * @param {string} text
 * @returns {Promise<number[]>} — 768-dimensional embedding vector
 */
async function embedText(text) {
  const client = getClient();
  if (!client) {
    throw new Error("GEMINI_API_KEY is not configured. Cannot generate embeddings.");
  }

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    throw new Error("embedText: text must be a non-empty string.");
  }

  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text.trim(),
  });

  const values = response?.embeddings?.[0]?.values;
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMS) {
    throw new Error(
      `embedText: unexpected embedding shape. Expected ${EMBEDDING_DIMS} dims, got ${values?.length ?? "none"}.`
    );
  }

  return values;
}

/**
 * Embed multiple texts sequentially, respecting rate limits.
 * Inserts a 200ms delay between calls to avoid hitting free-tier quota.
 *
 * @param {string[]} texts
 * @param {{ delayMs?: number }} opts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, { delayMs = 200 } = {}) {
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
