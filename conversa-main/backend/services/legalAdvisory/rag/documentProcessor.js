const crypto = require("crypto");

/**
 * documentProcessor.js
 *
 * Validates, chunks, and prepares legal knowledge documents for embedding
 * and storage in the vector store.
 *
 * Each legal document JSON file has this shape:
 * {
 *   title:       string  (required)
 *   content:     string  (required)
 *   legalDomain: string  (required)
 *   jurisdiction: string (required, default: "India")
 *   source:      string  (required)
 *   sourceUrl:   string  (optional)
 *   lastUpdated: string  (optional)
 * }
 *
 * Chunking strategy:
 *   - Split on double-newline paragraph boundaries first
 *   - If a paragraph exceeds MAX_CHUNK_CHARS, split further on sentences
 *   - Apply OVERLAP_CHARS of overlap: the last N chars of the previous chunk
 *     are prepended to the next chunk to preserve cross-chunk context
 *   - Minimum chunk size: MIN_CHUNK_CHARS (skip tiny fragments)
 */

const MAX_CHUNK_CHARS  = 800;
const OVERLAP_CHARS    = 100;
const MIN_CHUNK_CHARS  = 80;

const REQUIRED_FIELDS = ["title", "content", "legalDomain", "jurisdiction", "source"];

/**
 * Validate a legal document object.
 * Throws a descriptive error if required fields are missing.
 *
 * @param {object} doc
 * @param {string} filePath — for error messages
 */
function validateDocument(doc, filePath = "") {
  for (const field of REQUIRED_FIELDS) {
    if (!doc[field] || typeof doc[field] !== "string" || doc[field].trim().length === 0) {
      throw new Error(
        `documentProcessor: Document "${filePath}" is missing required field "${field}".`
      );
    }
  }
}

/**
 * Split text into sentences on common sentence-end patterns.
 * Returns an array of sentence strings.
 *
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  // Split on ". ", "? ", "! " followed by capital letter or end of string
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z\u0900-\u097F])|(?<=[.?!])$/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Split a long paragraph into sub-chunks of at most MAX_CHUNK_CHARS,
 * joining sentences greedily.
 *
 * @param {string} paragraph
 * @returns {string[]}
 */
function splitParagraph(paragraph) {
  if (paragraph.length <= MAX_CHUNK_CHARS) return [paragraph];

  const sentences = splitSentences(paragraph);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? current + " " + sentence : sentence;
    if (candidate.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim().length >= MIN_CHUNK_CHARS) {
    chunks.push(current.trim());
  }
  return chunks.length > 0 ? chunks : [paragraph.slice(0, MAX_CHUNK_CHARS)];
}

/**
 * Apply OVERLAP_CHARS overlap between consecutive chunks.
 * Prepends the last OVERLAP_CHARS characters of the previous chunk
 * to the current chunk to preserve cross-boundary context.
 *
 * @param {string[]} rawChunks
 * @returns {string[]}
 */
function applyOverlap(rawChunks) {
  if (rawChunks.length <= 1) return rawChunks;

  return rawChunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = rawChunks[i - 1];
    const overlap = prev.slice(-OVERLAP_CHARS).trim();
    return overlap ? overlap + " " + chunk : chunk;
  });
}

/**
 * Generate a deterministic chunkId from source + chunkIndex.
 * This ensures re-ingestion produces the same IDs (enabling upserts).
 *
 * @param {string} source
 * @param {number} index
 * @returns {string}
 */
function makeChunkId(source, index) {
  return crypto
    .createHash("sha256")
    .update(`${source}::${index}`)
    .digest("hex")
    .slice(0, 24);
}

/**
 * Process a single legal knowledge document into an array of chunk objects
 * ready for embedding and storage.
 *
 * @param {object} doc — parsed JSON document
 * @param {string} [filePath] — for error messages
 * @returns {Array<{
 *   chunkId: string,
 *   title: string,
 *   content: string,
 *   legalDomain: string,
 *   jurisdiction: string,
 *   source: string,
 *   sourceUrl: string,
 *   lastUpdated: string,
 *   chunkIndex: number,
 *   totalChunks: number
 * }>}
 */
function processDocument(doc, filePath = "") {
  validateDocument(doc, filePath);

  const {
    title,
    content,
    legalDomain,
    jurisdiction = "India",
    source,
    sourceUrl    = "",
    lastUpdated  = "",
  } = doc;

  // Split into paragraphs on double newlines
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length >= MIN_CHUNK_CHARS);

  // Split each paragraph into sub-chunks
  const rawChunks = paragraphs.flatMap((para) => splitParagraph(para));

  // Apply overlap
  const overlappedChunks = applyOverlap(rawChunks);

  // Filter out tiny fragments again after overlap
  const finalChunks = overlappedChunks.filter((c) => c.trim().length >= MIN_CHUNK_CHARS);

  if (finalChunks.length === 0) {
    throw new Error(
      `documentProcessor: Document "${source}" produced no valid chunks. Check content length.`
    );
  }

  return finalChunks.map((chunkContent, i) => ({
    chunkId:     makeChunkId(source, i),
    title,
    content:     chunkContent.trim(),
    legalDomain: legalDomain.trim(),
    jurisdiction: jurisdiction.trim(),
    source:      source.trim(),
    sourceUrl:   sourceUrl.trim(),
    lastUpdated: lastUpdated.trim(),
    chunkIndex:  i,
    totalChunks: finalChunks.length,
  }));
}

module.exports = { processDocument, validateDocument };
