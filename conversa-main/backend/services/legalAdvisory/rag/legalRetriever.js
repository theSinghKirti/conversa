const fs = require("fs");
const path = require("path");
const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const { embedText } = require("./embeddingService.js");
const { similaritySearch, upsertChunks } = require("./vectorStore.js");
const { processDocument } = require("./documentProcessor.js");

/**
 * legalRetriever.js
 *
 * The Legal RAG Retriever takes structured Case Intake output and retrieves
 * the most semantically relevant legal knowledge chunks from the vector store.
 *
 * STATUS CODES:
 *   - "SUCCESS": Vector store searched and 1+ relevant knowledge chunks returned
 *   - "NO_RESULTS": Search completed successfully, store is populated, but query yielded 0 matches above threshold
 *   - "NOT_CONFIGURED": Vector store collection is empty and seed files unavailable
 *   - "FAILED": Embedding API error or DB aggregation failure
 */

const DEFAULT_LIMIT     = 5;
const DEFAULT_MIN_SCORE = 0.25;

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

  // 1. Check if vector store contains documents, auto-seed if empty
  try {
    let docCount = await LegalKnowledgeChunk.countDocuments();
    if (docCount === 0) {
      console.warn("[legalRetriever] LegalKnowledgeChunk store is empty in MongoDB (0 docs). Attempting auto-seeding…");
      await autoSeedKnowledgeStore();
      docCount = await LegalKnowledgeChunk.countDocuments();
    }

    if (docCount === 0) {
      console.warn("[legalRetriever] LegalKnowledgeChunk store remains empty after auto-seeding attempt.");
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
      minScore: 0.12,
    });

    // Pass 2: Filter by jurisdiction only if pass 1 gave fewer than 2 results
    if (results.length < 2) {
      const pass2 = await similaritySearch(queryVec, {
        jurisdiction,
        limit,
        minScore: 0.08,
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
        minScore: 0.05,
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
