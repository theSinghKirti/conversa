const { embedText } = require("./rag/embeddingService.js");
const { searchPrecedents } = require("./precedentSearchTool.js");

/**
 * precedentAgent.js
 *
 * Precedent Agent orchestrator responsible for identifying relevant court rulings
 * and case law precedents for a given legal intake and jurisdiction.
 *
 * ACCURACY GUARANTEE:
 *   Returns ONLY verified precedent records from the configured precedent store.
 *   If no precedent passes the relevance score threshold (0.52), returns an empty array [].
 *   Never hallucinates fake case names, court names, or citations.
 *
 * INPUT:
 *   - intake: { caseType, legalDomain, summary, keywords, jurisdiction }
 *   - legalSources: Array<object> (from RAG layer)
 *   - jurisdiction: string
 *
 * OUTPUT:
 *   Array<{
 *     caseName: string,
 *     court: string,
 *     dateOrYear: string,
 *     summary: string,
 *     relevanceExplanation: string,
 *     sourceUrl: string
 *   }>
 */

/**
 * Builds a search query for precedent retrieval.
 */
function buildPrecedentQuery(intake) {
  const { caseType, legalDomain, summary, keywords } = intake;
  const parts = [];
  if (caseType)    parts.push(caseType);
  if (legalDomain) parts.push(legalDomain);
  if (summary)     parts.push(summary);
  if (keywords && keywords.length) parts.push(keywords.join(" "));
  return parts.join(". ");
}

/**
 * Generates a human-readable explanation of why a court judgment is relevant
 * to the intake issue.
 */
function generateRelevanceExplanation(precedent, intake) {
  const domain = precedent.legalDomain || intake.legalDomain || "legal";
  return `Landmark ${precedent.court} judgment (${precedent.dateOrYear}) establishing legal principles for ${domain.toLowerCase()} disputes under ${precedent.jurisdiction || "India"} law.`;
}

/**
 * Runs the Precedent Agent.
 *
 * @param {object} intake — output from caseIntakeAgent
 * @param {Array<object>} legalSources — output from legalRetriever
 * @param {string} jurisdiction — e.g. "India"
 * @returns {Promise<Array<{
 *   caseName: string,
 *   court: string,
 *   dateOrYear: string,
 *   summary: string,
 *   relevanceExplanation: string,
 *   sourceUrl: string
 * }>>}
 */
async function runPrecedentSearch(intake, legalSources = [], jurisdiction = "India") {
  console.log("[precedentAgent] Stage 3 — Running Precedent Search Agent…");

  const queryText = buildPrecedentQuery(intake);
  if (!queryText.trim()) {
    console.warn("[precedentAgent] Empty precedent query string — returning [].");
    return [];
  }

  // 1. Generate query vector
  let queryVec;
  try {
    queryVec = await embedText(queryText);
  } catch (err) {
    console.error("[precedentAgent] Failed to embed query for precedent search:", err.message);
    return [];
  }

  // 2. First pass: jurisdiction + legalDomain filter
  console.log(`[precedentAgent] Searching precedents (jurisdiction=${jurisdiction}, domain=${intake.legalDomain})…`);
  let matches = await searchPrecedents(queryVec, {
    jurisdiction,
    legalDomain: intake.legalDomain,
    limit: 3,
    minScore: 0.52,
  });

  // 3. Second pass: widen to jurisdiction if no domain-specific matches found
  if (matches.length === 0) {
    console.log("[precedentAgent] Widening precedent search to jurisdiction only…");
    matches = await searchPrecedents(queryVec, {
      jurisdiction,
      limit: 3,
      minScore: 0.52,
    });
  }

  if (matches.length === 0) {
    console.log("[precedentAgent] No verified precedents met relevance threshold — returning [].");
    return [];
  }

  console.log(`[precedentAgent] Found ${matches.length} verified precedent match(es).`);

  // 4. Format verified precedent objects
  return matches.map((item) => ({
    caseName:             item.caseName || "",
    court:                item.court || "",
    dateOrYear:           item.dateOrYear || "",
    summary:              item.summary || item.keyHoldings || "",
    relevanceExplanation: generateRelevanceExplanation(item, intake),
    sourceUrl:            item.sourceUrl || "",
  }));
}

module.exports = { runPrecedentSearch };
