const fs = require("fs");
const path = require("path");
const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const { embedText } = require("./embeddingService.js");
const { similaritySearch, upsertChunks } = require("./vectorStore.js");
const { processDocument } = require("./documentProcessor.js");
const {
  isDomainCompatible,
  isGenericOrUnknownDomain,
  normalizeDomain,
} = require("./domainMatcher.js");

/**
 * legalRetriever.js — Legal Knowledge RAG Retriever
 *
 * Enforces quality filtering, domain normalization, and confidence metadata tagging.
 *
 * STATUS CODES:
 *   - "SUCCESS": Vector store searched and 1+ relevant knowledge chunks returned
 *   - "NO_RESULTS": Search completed successfully, store is populated, but query yielded 0 matches above threshold
 *   - "NOT_CONFIGURED": Vector store collection is empty and seed files unavailable
 *   - "FAILED": Embedding API error or DB aggregation failure
 */

const DEFAULT_LIMIT = 5;

/**
 * Auto-seeds the vector store from local seed files if MongoDB collection is empty.
 */
async function autoSeedKnowledgeStore() {
  const dataDir = path.join(__dirname, "../../../data/legal-knowledge/india");
  if (!fs.existsSync(dataDir)) return;

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  console.log(`[legalRetriever] Auto-seeding LegalKnowledgeChunk store from ${files.length} seed dataset(s)…`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const rawData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const chunks = processDocument(rawData);
      const chunksWithEmbeddings = [];

      for (const chunk of chunks) {
        const textToEmbed = `${chunk.title} ${chunk.legalDomain} ${chunk.content}`;
        const vector = await embedText(textToEmbed);
        chunksWithEmbeddings.push({ ...chunk, vector });
      }

      await upsertChunks(chunksWithEmbeddings);
    } catch (err) {
      console.warn(`[legalRetriever] Auto-seed warning for ${file}:`, err.message);
    }
  }

  const count = await LegalKnowledgeChunk.countDocuments();
  console.log(`[legalRetriever] Auto-seeding complete. Total chunks in DB: ${count}.`);
}

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
 *   status: "SUCCESS" | "NO_RESULTS" | "NOT_CONFIGURED" | "FAILED",
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
  const { limit = DEFAULT_LIMIT } = opts;
  const { jurisdiction = "India", legalDomain } = intake;

  // 1. Check DB count, auto-seed if empty
  try {
    let docCount = await LegalKnowledgeChunk.countDocuments();
    if (docCount === 0) {
      console.warn("[legalRetriever] Store empty in MongoDB. Attempting auto-seeding…");
      await autoSeedKnowledgeStore();
      docCount = await LegalKnowledgeChunk.countDocuments();
    }

    if (docCount === 0) {
      return { status: "NOT_CONFIGURED", sources: [] };
    }
  } catch (dbErr) {
    console.error("[legalRetriever] Database check failed:", dbErr.message);
    return { status: "FAILED", sources: [] };
  }

  // 2. Build search query
  const query = buildRetrievalQuery(intake);
  console.log(`[legalRetriever] Search Query: "${query.slice(0, 120)}…"`);

  // 3. Generate query embedding
  let queryVec;
  try {
    queryVec = await embedText(query);
  } catch (err) {
    console.error("[legalRetriever] Query embedding failed:", err.message);
    return { status: "FAILED", sources: [] };
  }

  // 4. Perform 3-pass similarity search with pass metadata tagging
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

    // Pass 3: Global fallback (Quality gate: require minScore >= 0.35 for generic/ambiguous queries)
    if (taggedResults.length === 0) {
      const requiredScore = isGeneric ? 0.35 : 0.10;

      const pass3 = await similaritySearch(queryVec, {
        limit,
        minScore: requiredScore,
      });

      for (const chunk of pass3) {
        if (!seenChunkIds.has(chunk.chunkId)) {
          if (isGeneric) {
            // Unrelated/generic queries must pass strict quality gate AND domain compatibility
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
    console.error("[legalRetriever] Vector aggregation failed:", searchErr.message);
    return { status: "FAILED", sources: [] };
  }

  // 5. Shape final sources payload
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

  return {
    status,
    sources: formattedSources,
  };
}

module.exports = { retrieve };
