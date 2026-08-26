const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const { getDomainFilter } = require("./domainMatcher.js");
const DEBUG_AUDIT = process.env.DEBUG_LEGAL_RETRIEVAL_AUDIT === "1";

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
 * Validates that stored LegalKnowledgeChunk embeddings are compatible with the query vector dimension.
 * Checks both metadata (embeddingDimensions) and the actual embedding array size ($size: "$embedding")
 * for chunks matching the retrieval filter.
 *
 * @param {number} expectedDimension
 * @param {object} [matchFilter]
 * @throws {Error} with code EMBEDDING_DIMENSION_MISMATCH if any mismatch is found.
 */
async function validateStoredEmbeddingDimensions(expectedDimension, matchFilter = {}) {
  if (typeof expectedDimension !== "number" || expectedDimension <= 0) {
    throw new Error(`vectorStore: Invalid expected dimension: ${expectedDimension}`);
  }

  const mismatchDocs = await LegalKnowledgeChunk.aggregate([
    ...(Object.keys(matchFilter).length ? [{ $match: matchFilter }] : []),
    {
      $project: {
        chunkId: 1,
        title: 1,
        embeddingDimensions: 1,
        actualLength: {
          $cond: {
            if: { $isArray: "$embedding" },
            then: { $size: "$embedding" },
            else: 0,
          },
        },
      },
    },
    {
      $match: {
        $or: [
          { actualLength: { $ne: expectedDimension } },
          {
            $and: [
              { embeddingDimensions: { $exists: true, $ne: null } },
              { embeddingDimensions: { $ne: expectedDimension } },
            ],
          },
        ],
      },
    },
    { $limit: 1 },
  ]);

  if (mismatchDocs.length > 0) {
    const mismatch = mismatchDocs[0];
    const detectedDim =
      mismatch.actualLength !== undefined && mismatch.actualLength !== expectedDimension
        ? mismatch.actualLength
        : mismatch.embeddingDimensions !== undefined &&
          mismatch.embeddingDimensions !== null &&
          mismatch.embeddingDimensions !== expectedDimension
        ? mismatch.embeddingDimensions
        : null;

    if (detectedDim !== null) {
      const err = new Error(
        `Embedding dimension mismatch: query vector has dimension ${expectedDimension}, but stored chunk "${mismatch.chunkId || "unknown"}" has dimension ${detectedDim}.`
      );
      err.code = "EMBEDDING_DIMENSION_MISMATCH";
      throw err;
    }
  }
}

/**
 * Perform cosine similarity search against the stored embeddings.
 *
 * @param {number[]} queryVec          — Query embedding vector
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
  if (!Array.isArray(queryVec) || queryVec.length === 0) {
    throw new Error("vectorStore: query vector must be a non-empty array of numbers.");
  }
  const expectedDimension = queryVec.length;

  const {
    jurisdiction,
    legalDomain,
    limit     = 5,
    minScore  = 0.08,
  } = opts;

  // Pre-filter stage (reduces the number of dot products computed)
  const matchStage = {};
  if (jurisdiction) matchStage.jurisdiction = jurisdiction;
  if (legalDomain) {
    const domainFilter = getDomainFilter(legalDomain);
    if (domainFilter.length === 1) {
      matchStage.legalDomain = domainFilter[0];
    } else if (domainFilter.length > 1) {
      matchStage.legalDomain = { $in: domainFilter };
    } else {
      matchStage.legalDomain = legalDomain;
    }
  }

  // 1. Validate vector dimensions of stored candidate chunks before computing cosine similarity
  await validateStoredEmbeddingDimensions(expectedDimension, matchStage);

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

  if (DEBUG_AUDIT) {
    const totalCandidates = await LegalKnowledgeChunk.countDocuments();
    const metadataCandidates = Object.keys(matchStage).length
      ? await LegalKnowledgeChunk.countDocuments(matchStage)
      : totalCandidates;

    const thresholdPipeline = pipeline.slice(0, 5);
    const thresholdCandidates = await LegalKnowledgeChunk.aggregate(thresholdPipeline);

    console.log(`[Legal RAG] Candidate documents before filtering: ${totalCandidates}`);
    console.log(`[Legal RAG] Candidate documents after metadata filtering: ${metadataCandidates}`);
    console.log(`[Legal RAG] Candidate documents after threshold filtering: ${thresholdCandidates.length}`);
  }

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

module.exports = {
  upsertChunks,
  similaritySearch,
  validateStoredEmbeddingDimensions,
  deleteBySource,
  getStats,
};
