const LegalPrecedent = require("../../Models/LegalPrecedent.js");
const { embedText } = require("./rag/embeddingService.js");
const { searchPrecedents } = require("./precedentSearchTool.js");

/**
 * precedentAgent.js
 *
 * Precedent Search Agent responsible for retrieving verified court rulings
 * and case law precedents.
 *
 * STATUS CODES:
 *   - "SUCCESS": Store searched and 1+ relevant court precedents returned
 *   - "NO_RESULTS": Search executed successfully, store is populated, but query yielded 0 matches
 *   - "NOT_CONFIGURED": Precedent collection is empty (0 documents in DB)
 *   - "FAILED": Embedding API error or DB aggregation error
 *
 * OUTPUT:
 *   {
 *     status: "SUCCESS" | "NO_RESULTS" | "NOT_CONFIGURED" | "FAILED",
 *     precedents: Array<{ caseName, court, dateOrYear, summary, relevanceExplanation, sourceUrl }>
 *   }
 */

/**
 * Constructs a detailed search query using all structured case intake fields.
 * Incorporates case type, legal domain, factual summary, entities, and keywords.
 *
 * @param {object} intake
 * @returns {string}
 */
function buildDetailedPrecedentQuery(intake) {
  const { caseType, legalDomain, summary, relevantEntities, keywords, jurisdiction } = intake;

  const parts = [];
  if (jurisdiction) parts.push(jurisdiction);
  if (caseType)    parts.push(caseType);
  if (legalDomain) parts.push(legalDomain);
  if (summary)     parts.push(summary);

  if (Array.isArray(relevantEntities) && relevantEntities.length > 0) {
    parts.push(`parties: ${relevantEntities.join(" ")}`);
  }

  if (Array.isArray(keywords) && keywords.length > 0) {
    parts.push(keywords.join(" "));
  }

  parts.push("court judgment landmark ruling legal precedent");
  return parts.join(" ");
}

/**
 * Generates a clear explanation of why a court precedent is relevant.
 */
function generateRelevanceExplanation(precedent, intake) {
  const domain = precedent.legalDomain || intake.legalDomain || "legal";
  return `Landmark ${precedent.court} judgment (${precedent.dateOrYear}) establishing binding legal principles for ${domain.toLowerCase()} disputes in ${precedent.jurisdiction || "India"}.`;
}

/**
 * Runs the Precedent Agent.
 *
 * @param {object} intake — output from Case Intake Agent
 * @param {Array<object>} legalSources — output from Legal Knowledge RAG
 * @param {string} jurisdiction — e.g. "India"
 * @returns {Promise<{
 *   status: "SUCCESS" | "NO_RESULTS" | "NOT_CONFIGURED" | "FAILED",
 *   precedents: Array<{
 *     caseName: string,
 *     court: string,
 *     dateOrYear: string,
 *     summary: string,
 *     relevanceExplanation: string,
 *     sourceUrl: string
 *   }>
 * }>}
 */
async function runPrecedentSearch(intake, legalSources = [], jurisdiction = "India") {
  console.log("[PrecedentAgent] Stage 3 — Starting Precedent Search…");

  // 1. Check DB population for LegalPrecedent
  try {
    const precedentCount = await LegalPrecedent.countDocuments();
    if (precedentCount === 0) {
      console.warn("[PrecedentAgent] LegalPrecedent collection is empty in MongoDB (0 docs).");
      return { status: "NOT_CONFIGURED", precedents: [] };
    }
  } catch (dbErr) {
    console.error("[PrecedentAgent] Database check failed:", dbErr.message);
    return { status: "FAILED", precedents: [] };
  }

  // 2. Construct detailed search query
  const queryText = buildDetailedPrecedentQuery(intake);
  console.log(`[PrecedentAgent] Search Query: "${queryText.slice(0, 140)}…"`);

  // 3. Generate query embedding vector
  let queryVec;
  try {
    queryVec = await embedText(queryText);
  } catch (err) {
    console.error("[PrecedentAgent] Embedding query failed:", err.message);
    return { status: "FAILED", precedents: [] };
  }

  // 4. Perform 2-pass vector similarity search
  let matches = [];
  try {
    // Pass 1: Filter by jurisdiction + legalDomain
    matches = await searchPrecedents(queryVec, {
      jurisdiction,
      legalDomain: intake.legalDomain,
      limit: 3,
      minScore: 0.30,
    });

    // Pass 2: Fall back to jurisdiction only if domain match returned 0 results
    if (matches.length === 0) {
      console.log("[PrecedentAgent] Pass 1 returned 0 — searching jurisdiction only…");
      matches = await searchPrecedents(queryVec, {
        jurisdiction,
        limit: 3,
        minScore: 0.20,
      });
    }

    // Pass 3: Global fallback if still 0 matches
    if (matches.length === 0) {
      console.log("[PrecedentAgent] Pass 2 returned 0 — doing global fallback search…");
      matches = await searchPrecedents(queryVec, {
        limit: 3,
        minScore: 0.15,
      });
    }
  } catch (searchErr) {
    console.error("[PrecedentAgent] Vector similarity search failed:", searchErr.message);
    return { status: "FAILED", precedents: [] };
  }

  // 5. Shape output & status
  const formattedPrecedents = matches.map((item) => ({
    caseName:             item.caseName || "",
    court:                item.court || "",
    dateOrYear:           item.dateOrYear || "",
    summary:              item.summary || item.keyHoldings || "",
    relevanceExplanation: generateRelevanceExplanation(item, intake),
    sourceUrl:            item.sourceUrl || "",
  }));

  const status = formattedPrecedents.length > 0 ? "SUCCESS" : "NO_RESULTS";
  console.log(`[PrecedentAgent] Search completed with status="${status}" (${formattedPrecedents.length} precedent(s) found).`);

  return {
    status,
    precedents: formattedPrecedents,
  };
}

module.exports = { runPrecedentSearch, buildDetailedPrecedentQuery };
