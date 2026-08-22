const { embedText } = require("./embeddingService.js");
const { similaritySearch } = require("./vectorStore.js");

/**
 * legalRetriever.js
 *
 * The Legal RAG Retriever takes structured Case Intake output and retrieves
 * the most semantically relevant legal knowledge chunks from the vector store.
 *
 * DESIGN PRINCIPLES:
 *   - Only returns chunks that actually exist in the knowledge base
 *   - Never fabricates sources or citations
 *   - Returns [] gracefully if the knowledge base is empty or no results pass minScore
 *   - The caller (legalAdvisoryService) decides what to do if results are empty
 *
 * INPUT:  structured case intake (from caseIntakeAgent)
 * OUTPUT: array of relevant legal knowledge chunks with source metadata
 */

const DEFAULT_LIMIT     = 5;
const DEFAULT_MIN_SCORE = 0.55;

/**
 * Build a semantic retrieval query from the structured intake data.
 *
 * Combines case type, legal domain, intake summary, and keywords into a
 * rich query string that will embed well for legal similarity search.
 *
 * @param {{ caseType, legalDomain, summary, keywords, jurisdiction }} intake
 * @returns {string}
 */
function buildRetrievalQuery(intake) {
  const { caseType, legalDomain, summary, keywords } = intake;

  const parts = [];
  if (caseType)    parts.push(caseType);
  if (legalDomain) parts.push(legalDomain);
  if (summary)     parts.push(summary);
  if (keywords && keywords.length) parts.push(keywords.join(" "));

  return parts.join(". ");
}

/**
 * Retrieve the most relevant legal knowledge chunks for a given case.
 *
 * @param {{
 *   caseType: string,
 *   legalDomain: string,
 *   summary: string,
 *   keywords: string[],
 *   jurisdiction: string
 * }} intake — structured output from the Case Intake Agent
 * @param {{
 *   limit?: number,
 *   minScore?: number
 * }} [opts]
 * @returns {Promise<Array<{
 *   title: string,
 *   content: string,
 *   source: string,
 *   sourceUrl: string,
 *   legalDomain: string,
 *   relevanceScore: number
 * }>>}
 */
async function retrieve(intake, opts = {}) {
  const { limit = DEFAULT_LIMIT, minScore = DEFAULT_MIN_SCORE } = opts;

  const { jurisdiction, legalDomain } = intake;

  // Build semantic query from intake data
  const query = buildRetrievalQuery(intake);
  if (!query.trim()) {
    console.warn("[legalRetriever] Empty retrieval query — returning no sources.");
    return [];
  }

  console.log("[legalRetriever] Embedding retrieval query…");
  let queryVec;
  try {
    queryVec = await embedText(query);
  } catch (err) {
    // Embedding failure is non-fatal — advisory can still proceed without sources
    console.error("[legalRetriever] Failed to embed query:", err.message);
    return [];
  }

  // First pass: search with jurisdiction + domain filter (most specific)
  console.log(`[legalRetriever] Searching vector store (jurisdiction=${jurisdiction}, domain=${legalDomain})…`);
  let results = await similaritySearch(queryVec, {
    jurisdiction,
    legalDomain,
    limit,
    minScore,
  });

  // Second pass: widen to jurisdiction only if first pass returned fewer than 2 results
  if (results.length < 2) {
    console.log("[legalRetriever] Widening search to jurisdiction only…");
    results = await similaritySearch(queryVec, {
      jurisdiction,
      limit,
      minScore,
    });
  }

  // Third pass: global search if still no results
  if (results.length === 0) {
    console.log("[legalRetriever] No jurisdiction-filtered results — doing global search…");
    results = await similaritySearch(queryVec, { limit, minScore });
  }

  console.log(`[legalRetriever] Retrieved ${results.length} relevant chunks.`);

  // Shape output — only include fields safe to expose to Gemini and the frontend
  return results.map((chunk) => ({
    title:          chunk.title,
    content:        chunk.content,
    source:         chunk.source,
    sourceUrl:      chunk.sourceUrl || "",
    legalDomain:    chunk.legalDomain,
    relevanceScore: chunk.relevanceScore,
  }));
}

module.exports = { retrieve };
