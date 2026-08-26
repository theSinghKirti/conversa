const secrets = require("../../../secrets.js");

const HF_MODEL = "BAAI/bge-large-en-v1.5";
const EMBEDDING_DIMS = 1024;
let lastLogged = false;

function createEmbeddingError(message, code, originalError) {
  const err = new Error(message);
  err.code = code;
  if (originalError && originalError.stack) {
    err.originalError = originalError;
  }
  return err;
}

function getHuggingFaceKey() {
  const key =
    process.env.HUGGINGFACE_API_KEY ||
    secrets.HUGGINGFACE_API_KEY ||
    process.env.HF_TOKEN;

  if (!key || typeof key !== "string" || key.trim().length === 0) {
    throw createEmbeddingError(
      "Embedding provider unavailable: HUGGINGFACE_API_KEY is missing.",
      "EMBEDDING_CONFIG_ERROR"
    );
  }
  return key.trim();
}

function validateEmbeddingValues(values, expectedDims = EMBEDDING_DIMS) {
  const actualDims = Array.isArray(values)
    ? values.length
    : values === undefined
    ? "undefined"
    : values === null
    ? "null"
    : typeof values;

  if (!Array.isArray(values) || values.length !== expectedDims) {
    throw createEmbeddingError(
      `Embedding response shape invalid: expected an array with ${expectedDims} values, received ${actualDims}.`,
      "EMBEDDING_DIMENSION_INVALID"
    );
  }

  return values;
}

/**
 * Embed a single text string using Hugging Face BAAI/bge-m3 (1024 dimensions).
 *
 * @param {string} text
 * @returns {Promise<number[]>} — 1024-dimensional dense embedding vector
 */
async function embedText(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw createEmbeddingError(
      "embedText: text must be a non-empty string.",
      "EMBEDDING_CONFIG_ERROR"
    );
  }

  const apiKey = getHuggingFaceKey();
  const model =
    process.env.HUGGINGFACE_EMBEDDING_MODEL ||
    secrets.HUGGINGFACE_EMBEDDING_MODEL ||
    HF_MODEL;

  if (!lastLogged) {
    console.log(
      `[EmbeddingService] Provider: huggingface, Model: ${model}, Expected Dimensions: ${EMBEDDING_DIMS}`
    );
    lastLogged = true;
  }

  const url = `https://router.huggingface.co/hf-inference/models/${model}`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  return validateEmbeddingValues(rawVector, EMBEDDING_DIMS);
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
    throw createEmbeddingError(
      "embedBatch: texts must be an array.",
      "EMBEDDING_CONFIG_ERROR"
    );
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

const getActiveProvider = () => ({
  provider: "huggingface",
  model: process.env.HUGGINGFACE_EMBEDDING_MODEL || secrets.HUGGINGFACE_EMBEDDING_MODEL || HF_MODEL,
  expectedDims: EMBEDDING_DIMS,
});

const _resetClient = () => {
  lastLogged = false;
};

module.exports = {
  embedText,
  embedBatch,
  EMBEDDING_DIMS,
  validateEmbeddingValues,
  getActiveProvider,
  _resetClient,
};
