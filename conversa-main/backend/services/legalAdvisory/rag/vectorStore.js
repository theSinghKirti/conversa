const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");

/**
 * vectorStore.js — Provider-agnostic vector store interface.
 *
 * CURRENT PROVIDER: MongoDB cosine similarity via aggregation pipeline.
 *
 * WHY MONGODB:
 *   The project uses only MongoDB in docker-compose. No additional
 *   infrastructure is needed for an MVP. For small-to-medium knowledge
 *   bases (<50k chunks) this performs well enough.
 *
 * UPGRADE PATH:
 *   Replace only this file to switch to:
 *     - MongoDB Atlas $vectorSearch (requires Atlas M10+ cluster)
 *     - Pinecone (add PINECONE_API_KEY, PINECONE_INDEX to secrets.js)
 *     - Qdrant (add QDRANT_URL to secrets.js)
 *   All callers (legalRetriever, ingest script) use the same interface.
 *
 * PUBLIC API:
 *   upsertChunks(chunks)                         → void
 *   similaritySearch(queryVec, opts)              → RankedChunk[]
 *   deleteBySource(source)                        → number (deleted count)
 *   getStats()                                    → { totalChunks, byDomain }
 */

/**
 * Compute dot product of two equal-length arrays.
 * Used in the MongoDB aggregation cosine similarity formula.
 *
 * We build the aggregation expression dynamically for any vector length.
 * For 768 dims this is done in-database — no JS-side computation.
 */
function buildCosineSimilarityStage(queryVec) {
  // MongoDB aggregation: cosine_similarity = dot(a,b) / (||a|| * ||b||)
  // ||queryVec|| is a constant we pre-compute in JS
  const qMagnitude = Math.sqrt(queryVec.reduce((sum, v) => sum + v * v, 0));

  if (qMagnitude === 0) {
    throw new Error("vectorStore: query vector has zero magnitude.");
  }

  // Build dot product as sum of element-wise products
  // { $reduce: { input: <zipped pairs>, initialValue: 0, in: { $add: [$$value, <product>] } } }
  // We achieve element-wise product using $map + $arrayElemAt
  const dotProductExpr = {
    $reduce: {
      input: { $range: [0, queryVec.length] },
      initialValue: 0,
      in: {
        $add: [
          "$$value",
          {
            $multiply: [
              { $arrayElemAt: ["$embedding", "$$this"] },
              { $arrayElemAt: [queryVec, "$$this"] },
            ],
          },
        ],
      },
    },
  };

  // ||docVec|| = sqrt(sum of squares)
  const docMagnitudeExpr = {
    $sqrt: {
      $reduce: {
        input: "$embedding",
        initialValue: 0,
        in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] },
      },
    },
  };

  const cosineSimilarityExpr = {
    $divide: [dotProductExpr, { $multiply: [docMagnitudeExpr, qMagnitude] }],
  };

  return cosineSimilarityExpr;
}

/**
 * Store or update an array of chunk objects.
 * Uses chunkId as the upsert key — safe to call multiple times (idempotent).
 *
 * @param {Array<{
 *   chunkId: string,
 *   title: string,
 *   content: string,
 *   legalDomain: string,
 *   jurisdiction: string,
 *   source: string,
 *   sourceUrl: string,
 *   lastUpdated: string,
 *   chunkIndex: number,
 *   totalChunks: number,
 *   embedding: number[]
 * }>} chunks
 */
async function upsertChunks(chunks) {
  if (!chunks || chunks.length === 0) return;

  const ops = chunks.map((chunk) => ({
    updateOne: {
      filter: { chunkId: chunk.chunkId },
      update: { $set: chunk },
      upsert: true,
    },
  }));

  const result = await LegalKnowledgeChunk.bulkWrite(ops, { ordered: false });
  return result;
}

/**
 * Perform cosine similarity search against the stored embeddings.
 *
 * @param {number[]} queryVec          — 768-dim query embedding
 * @param {{
 *   jurisdiction?: string,
 *   legalDomain?: string,
 *   limit?: number,
 *   minScore?: number
 * }} opts
 * @returns {Promise<Array<{
 *   chunkId: string,
 *   title: string,
 *   content: string,
 *   source: string,
 *   sourceUrl: string,
 *   legalDomain: string,
 *   jurisdiction: string,
 *   relevanceScore: number
 * }>>}
 */
async function similaritySearch(queryVec, opts = {}) {
  const {
    jurisdiction,
    legalDomain,
    limit     = 5,
    minScore  = 0.08,
  } = opts;

  // Pre-filter stage (reduces the number of dot products computed)
  const matchStage = {};
  if (jurisdiction) matchStage.jurisdiction = jurisdiction;
  if (legalDomain)  matchStage.legalDomain  = legalDomain;

  const pipeline = [
    // 1. Pre-filter by jurisdiction/domain before computing similarity
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

    // 2. Include embedding field (excluded by default via select: false)
    { $project: { embedding: 1, chunkId: 1, title: 1, content: 1, source: 1, sourceUrl: 1, legalDomain: 1, jurisdiction: 1 } },

    // 3. Compute cosine similarity score
    {
      $addFields: {
        relevanceScore: buildCosineSimilarityStage(queryVec),
      },
    },

    // 4. Filter out low-scoring results
    { $match: { relevanceScore: { $gte: minScore } } },

    // 5. Sort by score descending
    { $sort: { relevanceScore: -1 } },

    // 6. Limit results
    { $limit: limit },

    // 7. Shape output — do NOT expose the raw embedding vector
    {
      $project: {
        _id: 0,
        chunkId: 1,
        title: 1,
        content: 1,
        source: 1,
        sourceUrl: 1,
        legalDomain: 1,
        jurisdiction: 1,
        relevanceScore: { $round: ["$relevanceScore", 4] },
      },
    },
  ];

  return await LegalKnowledgeChunk.aggregate(pipeline);
}

/**
 * Delete all chunks belonging to a given source.
 * Called by the ingestion script before re-inserting to ensure idempotency.
 *
 * @param {string} source
 * @returns {Promise<number>} — number of deleted documents
 */
async function deleteBySource(source) {
  const result = await LegalKnowledgeChunk.deleteMany({ source });
  return result.deletedCount;
}

/**
 * Returns aggregate stats about the knowledge base.
 *
 * @returns {Promise<{ totalChunks: number, byDomain: Record<string, number> }>}
 */
async function getStats() {
  const [total, byDomainRaw] = await Promise.all([
    LegalKnowledgeChunk.countDocuments(),
    LegalKnowledgeChunk.aggregate([
      { $group: { _id: "$legalDomain", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const byDomain = {};
  for (const row of byDomainRaw) {
    byDomain[row._id] = row.count;
  }

  return { totalChunks: total, byDomain };
}

module.exports = { upsertChunks, similaritySearch, deleteBySource, getStats };
