const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const { embedText } = require("./embeddingService.js");
const { similaritySearch } = require("./vectorStore.js");

/**
 * legalRetriever.js
 *
 * The Legal RAG Retriever takes structured Case Intake output and retrieves
 * the most semantically relevant legal knowledge chunks from the vector store.
 *
 * STATUS CODES:
 *   - "SUCCESS": Vector store searched and 1+ relevant knowledge chunks returned
 *   - "NO_RESULTS": Search completed successfully, store is populated, but query yielded 0 matches above threshold
 *   - "NOT_CONFIGURED": Vector store collection is empty (0 documents in DB)
 *   - "FAILED": Embedding API error or DB aggregation failure
 *
 * OUTPUT:
 *   {
 *     status: "SUCCESS" | "NO_RESULTS" | "NOT_CONFIGURED" | "FAILED",
 *     sources: Array<{ title, content, source, sourceUrl, legalDomain, relevanceScore }>
 *   }
 */

const DEFAULT_LIMIT     = 5;
const DEFAULT_MIN_SCORE = 0.30;

function buildRetrievalQuery(intake) {
  const { caseType, legalDomain, summary, keywords, jurisdiction } = intake;

  const parts = [];
  if (jurisdiction) parts.push(jurisdiction);
  if (caseType)    parts.push(caseType);
  if (legalDomain) parts.push(legalDomain);
  if (summary)     parts.push(summary);
  if (keywords && keywords.length) parts.push(keywords.join(" "));

  return parts.join(" ");
}

/**
 * Retrieve relevant legal knowledge chunks for a given case intake.
 *
 * @param {{
 *   caseType: string,
 *   legalDomain: string,
 *   summary: string,
 *   keywords: string[],
 *   jurisdiction: string
 * }} intake
 * @param {{ limit?: number, minScore?: number }} [opts]
 * @returns {Promise<{
 *   status: "SUCCESS" | "NO_RESULTS" | "NOT_CONFIGURED" | "FAILED",
 *   sources: Array<{
 *     title: string,
 *     content: string,
 *     source: string,
 *     sourceUrl: string,
 *     legalDomain: string,
 *     relevanceScore: number
 *   }>
 * }>}
 */
async function retrieve(intake, opts = {}) {
  const { limit = DEFAULT_LIMIT, minScore = DEFAULT_MIN_SCORE } = opts;
  const { jurisdiction, legalDomain } = intake;

  // 1. Check if vector store contains documents
  try {
    const docCount = await LegalKnowledgeChunk.countDocuments();
    if (docCount === 0) {
      console.warn("[legalRetriever] LegalKnowledgeChunk store is empty in MongoDB (0 docs).");
      return { status: "NOT_CONFIGURED", sources: [] };
    }
  } catch (dbErr) {
    console.error("[legalRetriever] Database check failed:", dbErr.message);
    return { status: "FAILED", sources: [] };
  }

  // 2. Build detailed query
  const query = buildRetrievalQuery(intake);
  console.log(`[legalRetriever] Query: "${query.slice(0, 120)}…"`);

  // 3. Generate query embedding
  let queryVec;
  try {
    queryVec = await embedText(query);
  } catch (err) {
    console.error("[legalRetriever] Query embedding failed:", err.message);
    return { status: "FAILED", sources: [] };
  }

  // 4. Perform 3-pass similarity search
  let results = [];
  try {
    // Pass 1: Filter by jurisdiction + legalDomain
    results = await similaritySearch(queryVec, {
      jurisdiction,
      legalDomain,
      limit,
      minScore,
    });

    // Pass 2: Filter by jurisdiction only if pass 1 gave fewer than 2 results
    if (results.length < 2) {
      const pass2 = await similaritySearch(queryVec, {
        jurisdiction,
        limit,
        minScore: Math.max(0.20, minScore - 0.10),
      });
      // Deduplicate
      const existingIds = new Set(results.map((r) => r.chunkId));
      for (const item of pass2) {
        if (!existingIds.has(item.chunkId)) {
          results.push(item);
          existingIds.add(item.chunkId);
        }
      }
    }

    // Pass 3: Global search if still 0 results
    if (results.length === 0) {
      results = await similaritySearch(queryVec, {
        limit,
        minScore: 0.15,
      });
    }
  } catch (searchErr) {
    console.error("[legalRetriever] Vector aggregation failed:", searchErr.message);
    return { status: "FAILED", sources: [] };
  }

  // 5. Shape output & status
  const formattedSources = results.slice(0, limit).map((chunk) => ({
    title:          chunk.title,
    content:        chunk.content,
    source:         chunk.source,
    sourceUrl:      chunk.sourceUrl || "",
    legalDomain:    chunk.legalDomain,
    relevanceScore: chunk.relevanceScore,
  }));

  const status = formattedSources.length > 0 ? "SUCCESS" : "NO_RESULTS";
  console.log(`[legalRetriever] Completed with status="${status}" (${formattedSources.length} source(s) found).`);

  return {
    status,
    sources: formattedSources,
  };
}

module.exports = { retrieve };
