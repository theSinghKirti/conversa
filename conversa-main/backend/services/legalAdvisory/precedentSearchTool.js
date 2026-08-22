const LegalPrecedent = require("../../Models/LegalPrecedent.js");

/**
 * precedentSearchTool.js — Provider-agnostic Legal Precedent search interface.
 *
 * CURRENT PROVIDER: MongoDB vector cosine similarity aggregation over LegalPrecedent.
 *
 * MODULAR ARCHITECTURE:
 *   If the underlying legal data provider changes (e.g., IndianKanoon API,
 *   CourtListener API, or external vector database), replace ONLY this file.
 *   Caller modules (precedentAgent.js, legalAdvisoryService.js) remain unchanged.
 *
 * PUBLIC API:
 *   upsertPrecedents(precedents)               → void
 *   searchPrecedents(queryVec, opts)          → PrecedentMatch[]
 *   deleteByDomain(domain)                    → number
 */

/**
 * Build cosine similarity stage for aggregation.
 */
function buildCosineSimilarityStage(queryVec) {
  const qMagnitude = Math.sqrt(queryVec.reduce((sum, v) => sum + v * v, 0));
  if (qMagnitude === 0) {
    throw new Error("precedentSearchTool: query vector has zero magnitude.");
  }

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

  const docMagnitudeExpr = {
    $sqrt: {
      $reduce: {
        input: "$embedding",
        initialValue: 0,
        in: { $add: ["$$value", { $multiply: ["$$this", "$$this"] }] },
      },
    },
  };

  return {
    $divide: [dotProductExpr, { $multiply: [docMagnitudeExpr, qMagnitude] }],
  };
}

/**
 * Upsert precedent objects into the vector database.
 *
 * @param {Array<object>} precedents
 */
async function upsertPrecedents(precedents) {
  if (!precedents || precedents.length === 0) return;

  const ops = precedents.map((p) => ({
    updateOne: {
      filter: { precedentId: p.precedentId },
      update: { $set: p },
      upsert: true,
    },
  }));

  return await LegalPrecedent.bulkWrite(ops, { ordered: false });
}

/**
 * Perform semantic vector search over LegalPrecedents.
 *
 * @param {number[]} queryVec — 768-dim embedding vector
 * @param {{
 *   jurisdiction?: string,
 *   legalDomain?: string,
 *   limit?: number,
 *   minScore?: number
 * }} opts
 * @returns {Promise<Array<{
 *   precedentId: string,
 *   caseName: string,
 *   court: string,
 *   dateOrYear: string,
 *   legalDomain: string,
 *   jurisdiction: string,
 *   summary: string,
 *   keyHoldings: string,
 *   sourceUrl: string,
 *   relevanceScore: number
 * }>>}
 */
async function searchPrecedents(queryVec, opts = {}) {
  const {
    jurisdiction,
    legalDomain,
    limit    = 3,
    minScore = 0.08,
  } = opts;

  const matchStage = {};
  if (jurisdiction) matchStage.jurisdiction = jurisdiction;
  if (legalDomain)  matchStage.legalDomain  = legalDomain;

  const pipeline = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    {
      $project: {
        embedding: 1,
        precedentId: 1,
        caseName: 1,
        court: 1,
        dateOrYear: 1,
        citation: 1,
        source: 1,
        legalDomain: 1,
        jurisdiction: 1,
        summary: 1,
        keyHoldings: 1,
        sourceUrl: 1,
      },
    },
    {
      $addFields: {
        relevanceScore: buildCosineSimilarityStage(queryVec),
      },
    },
    { $match: { relevanceScore: { $gte: minScore } } },
    { $sort: { relevanceScore: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        precedentId: 1,
        caseName: 1,
        court: 1,
        dateOrYear: 1,
        citation: 1,
        source: 1,
        legalDomain: 1,
        jurisdiction: 1,
        summary: 1,
        keyHoldings: 1,
        sourceUrl: 1,
        relevanceScore: { $round: ["$relevanceScore", 4] },
      },
    },
  ];

  return await LegalPrecedent.aggregate(pipeline);
}

module.exports = { upsertPrecedents, searchPrecedents };
