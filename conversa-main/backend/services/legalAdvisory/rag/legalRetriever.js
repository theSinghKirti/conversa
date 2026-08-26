const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const { embedText } = require("./embeddingService.js");
const { similaritySearch } = require("./vectorStore.js");
const {
  isDomainCompatible,
  isGenericOrUnknownDomain,
} = require("./domainMatcher.js");
const DEBUG_AUDIT = process.env.DEBUG_LEGAL_RETRIEVAL_AUDIT === "1";

function auditLog(message) {
  if (DEBUG_AUDIT) console.log(message);
}

/**
 * legalRetriever.js — Legal Knowledge RAG Retriever
 *
 * Query-time retrieval flow:
 *   1. Validate input & construct retrieval query
 *   2. Generate 1024-dimensional query embedding via Hugging Face BAAI/bge-m3
 *   3. Search MongoDB vector store using similaritySearch
 *   4. Return top relevant chunks with status "SUCCESS" or "NO_RESULTS"
 *
 * If embedding or search fails, errors are thrown upward immediately.
 */

const DEFAULT_LIMIT = 5;

function buildRetrievalQuery(intake) {
  const { caseType, legalDomain, summary, keywords, jurisdiction } = intake;

  const parts = [];
  if (jurisdiction) parts.push(jurisdiction);
  if (caseType && caseType.toLowerCase() !== "generic") parts.push(caseType);
  if (legalDomain && !isGenericOrUnknownDomain(legalDomain)) parts.push(legalDomain);
  if (summary) parts.push(summary);
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
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{
 *   status: "SUCCESS" | "NO_RESULTS",
 *   sources: Array<{
 *     title: string,
 *     content: string,
 *     source: string,
 *     sourceUrl: string,
 *     legalDomain: string,
 *     relevanceScore: number,
 *     retrievalPass: string,
 *     confidenceLevel: string
 *   }>
 * }>}
 */
async function retrieve(intake, opts = {}) {
  if (!intake || typeof intake !== "object") {
    throw new Error("legalRetriever: intake must be a valid object.");
  }

  const { limit = DEFAULT_LIMIT } = opts;
  const { jurisdiction = "India", legalDomain } = intake;
  auditLog("[Legal RAG] START");

  // 1. Build search query
  const query = buildRetrievalQuery(intake);
  console.log(`[legalRetriever] Search Query: "${query.slice(0, 120)}…"`);

  // 2. Generate 1024-dim query embedding using Hugging Face
  let queryVec;
  try {
    queryVec = await embedText(query);
    auditLog("[Legal RAG] Query embedding: SUCCESS");
  } catch (err) {
    console.error("[legalRetriever] Query embedding failed:", err.message);
    auditLog("[Legal RAG] Query embedding: FAILED (EMBEDDING_PROVIDER_ERROR)");
    if (!err.code) {
      err.code = "EMBEDDING_FAILED";
    }
    throw err;
  }

  // 3. Perform 3-pass similarity search with pass metadata tagging
  const taggedResults = [];
  const seenChunkIds = new Set();
  const isGeneric = isGenericOrUnknownDomain(legalDomain);

  try {
    // Pass 1: Jurisdiction + Legal Domain (Exact/Compatible match)
    if (!isGeneric) {
      const pass1 = await similaritySearch(queryVec, {
        jurisdiction,
        legalDomain,
        limit,
        minScore: 0.10,
      });

      for (const chunk of pass1) {
        seenChunkIds.add(chunk.chunkId);
        taggedResults.push({
          ...chunk,
          retrievalPass: "PASS_1_EXACT",
          confidenceLevel: chunk.relevanceScore >= 0.25 ? "HIGH" : "MEDIUM",
        });
      }
    }

    // Pass 2: Jurisdiction only (Domain fallback)
    if (taggedResults.length < 2 && !isGeneric) {
      const pass2 = await similaritySearch(queryVec, {
        jurisdiction,
        limit,
        minScore: 0.08,
      });

      for (const chunk of pass2) {
        if (!seenChunkIds.has(chunk.chunkId) && isDomainCompatible(chunk.legalDomain, legalDomain, true)) {
          seenChunkIds.add(chunk.chunkId);
          taggedResults.push({
            ...chunk,
            retrievalPass: "PASS_2_JURISDICTION",
            confidenceLevel: "MEDIUM",
          });
        }
      }
    }

    // Pass 3: Global fallback
    if (taggedResults.length === 0) {
      const requiredScore = isGeneric ? 0.35 : 0.10;

      const pass3 = await similaritySearch(queryVec, {
        limit,
        minScore: requiredScore,
      });

      for (const chunk of pass3) {
        if (!seenChunkIds.has(chunk.chunkId)) {
          if (isGeneric) {
            if (chunk.relevanceScore >= 0.35 && isDomainCompatible(chunk.legalDomain, legalDomain, true)) {
              seenChunkIds.add(chunk.chunkId);
              taggedResults.push({
                ...chunk,
                retrievalPass: "PASS_3_GLOBAL",
                confidenceLevel: "LOW",
              });
            }
          } else if (isDomainCompatible(chunk.legalDomain, legalDomain, true)) {
            seenChunkIds.add(chunk.chunkId);
            taggedResults.push({
              ...chunk,
              retrievalPass: "PASS_3_GLOBAL",
              confidenceLevel: "LOW",
            });
          }
        }
      }
    }
  } catch (searchErr) {
    console.error("[legalRetriever] Vector search failed:", searchErr.message);
    throw searchErr;
  }

  // 4. Shape final top sources payload
  const formattedSources = taggedResults.slice(0, limit).map((chunk) => ({
    title:           chunk.title,
    content:         chunk.content,
    source:          chunk.source,
    sourceUrl:       chunk.sourceUrl || "",
    legalDomain:     chunk.legalDomain,
    relevanceScore:  chunk.relevanceScore,
    retrievalPass:   chunk.retrievalPass,
    confidenceLevel: chunk.confidenceLevel,
  }));

  const status = formattedSources.length > 0 ? "SUCCESS" : "NO_RESULTS";
  console.log(`[legalRetriever] Search complete with status="${status}" (${formattedSources.length} source(s) returned).`);
  auditLog(`[Legal RAG] Final result status: ${status}`);

  return {
    status,
    sources: formattedSources,
  };
}

module.exports = { retrieve };
