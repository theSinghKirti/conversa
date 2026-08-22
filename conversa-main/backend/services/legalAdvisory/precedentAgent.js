const fs = require("fs");
const path = require("path");
const LegalPrecedent = require("../../Models/LegalPrecedent.js");
const { embedText } = require("./rag/embeddingService.js");
const { searchPrecedents, upsertPrecedents } = require("./precedentSearchTool.js");

/**
 * precedentAgent.js — Legal Precedent Search Agent
 *
 * Enforces precedent traceability (caseName, court, dateOrYear, citation, source, sourceUrl),
 * pass metadata tagging, and relevance quality filtering.
 *
 * STATUS CODES:
 *   - "SUCCESS": Store searched and 1+ relevant court precedents returned
 *   - "NO_RESULTS": Search executed successfully, store is populated, but query yielded 0 matches
 *   - "NOT_CONFIGURED": Precedent collection is empty and seed files unavailable
 *   - "FAILED": Embedding API error or DB aggregation error
 */

/**
 * Auto-seeds the precedent store from local seed files if MongoDB collection is empty.
 */
async function autoSeedPrecedentStore() {
  const dataDir = path.join(__dirname, "../../data/legal-precedents/india");
  if (!fs.existsSync(dataDir)) return;

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  console.log(`[PrecedentAgent] Auto-seeding LegalPrecedent store from ${files.length} seed dataset(s)…`);

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const precedents = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const recordsToUpsert = [];

      for (const item of precedents) {
        const textToEmbed = `${item.caseName} ${item.court} ${item.citation || ""} ${item.legalDomain} ${item.summary} ${item.keyHoldings}`;
        const vector = await embedText(textToEmbed);
        recordsToUpsert.push({ ...item, vector });
      }

      await upsertPrecedents(recordsToUpsert);
    } catch (err) {
      console.warn(`[PrecedentAgent] Auto-seed warning for ${file}:`, err.message);
    }
  }

  const count = await LegalPrecedent.countDocuments();
  console.log(`[PrecedentAgent] Auto-seeding complete. Total precedents in DB: ${count}.`);
}

/**
 * Constructs a detailed search query using all structured case intake fields.
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
  const citeStr = precedent.citation ? ` [${precedent.citation}]` : "";
  return `Landmark ${precedent.court} judgment (${precedent.dateOrYear})${citeStr} establishing binding legal principles for ${domain.toLowerCase()} disputes in ${precedent.jurisdiction || "India"}.`;
}

function isGenericOrNonLegalDomain(domain) {
  if (!domain || typeof domain !== "string") return true;
  const d = domain.toLowerCase().trim();
  return (
    d.includes("civil") ||
    d.includes("general") ||
    d.includes("not applicable") ||
    d.includes("n/a") ||
    d.includes("none") ||
    d.includes("other") ||
    d.includes("non-legal") ||
    d.includes("information")
  );
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
 *     citation: string,
 *     source: string,
 *     summary: string,
 *     relevanceExplanation: string,
 *     sourceUrl: string,
 *     relevanceScore: number,
 *     retrievalPass: string,
 *     confidenceLevel: string
 *   }>
 * }>}
 */
async function runPrecedentSearch(intake, legalSources = [], jurisdiction = "India") {
  console.log("[PrecedentAgent] Stage 3 — Starting Precedent Search…");

  // 1. Check DB count, auto-seed if empty
  try {
    let precedentCount = await LegalPrecedent.countDocuments();
    if (precedentCount === 0) {
      console.warn("[PrecedentAgent] Store empty in MongoDB. Attempting auto-seeding…");
      await autoSeedPrecedentStore();
      precedentCount = await LegalPrecedent.countDocuments();
    }

    if (precedentCount === 0) {
      return { status: "NOT_CONFIGURED", precedents: [] };
    }
  } catch (dbErr) {
    console.error("[PrecedentAgent] Database check failed:", dbErr.message);
    return { status: "FAILED", precedents: [] };
  }

  // 2. Build detailed query
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

  // 4. Perform 3-pass search with pass metadata tagging
  const taggedMatches = [];
  const seenIds = new Set();
  const isGeneric = isGenericOrNonLegalDomain(intake.legalDomain);

  try {
    // Pass 1: Jurisdiction + Legal Domain
    if (!isGeneric) {
      const pass1 = await searchPrecedents(queryVec, {
        jurisdiction,
        legalDomain: intake.legalDomain,
        limit: 3,
        minScore: 0.12,
      });

      for (const item of pass1) {
        seenIds.add(item.precedentId || item.caseName);
        taggedMatches.push({
          ...item,
          retrievalPass: "PASS_1_EXACT",
          confidenceLevel: item.relevanceScore >= 0.18 ? "HIGH" : "MEDIUM",
        });
      }
    }

    // Pass 2: Jurisdiction only (Require minScore >= 0.35 for generic/non-legal queries)
    if (taggedMatches.length === 0) {
      const pass2Score = isGeneric ? 0.35 : 0.08;

      const pass2 = await searchPrecedents(queryVec, {
        jurisdiction,
        limit: 3,
        minScore: pass2Score,
      });

      for (const item of pass2) {
        const id = item.precedentId || item.caseName;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          taggedMatches.push({
            ...item,
            retrievalPass: "PASS_2_JURISDICTION",
            confidenceLevel: "MEDIUM",
          });
        }
      }
    }

    // Pass 3: Global fallback (Quality gate: require minScore >= 0.35 for generic/ambiguous queries)
    if (taggedMatches.length === 0) {
      const requiredScore = isGeneric ? 0.35 : 0.12;

      const pass3 = await searchPrecedents(queryVec, {
        limit: 3,
        minScore: requiredScore,
      });

      for (const item of pass3) {
        const id = item.precedentId || item.caseName;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          taggedMatches.push({
            ...item,
            retrievalPass: "PASS_3_GLOBAL",
            confidenceLevel: "LOW",
          });
        }
      }
    }
  } catch (searchErr) {
    console.error("[PrecedentAgent] Vector similarity search failed:", searchErr.message);
    return { status: "FAILED", precedents: [] };
  }

  // 5. Shape final precedent results
  const formattedPrecedents = taggedMatches.map((item) => ({
    caseName:             item.caseName || "",
    court:                item.court || "",
    dateOrYear:           item.dateOrYear || "",
    citation:             item.citation || "",
    source:               item.source || "Supreme Court Reports / Indian Kanoon",
    summary:              item.summary || item.keyHoldings || "",
    relevanceExplanation: generateRelevanceExplanation(item, intake),
    sourceUrl:            item.sourceUrl || "",
    relevanceScore:       item.relevanceScore,
    retrievalPass:        item.retrievalPass,
    confidenceLevel:      item.confidenceLevel,
  }));

  const status = formattedPrecedents.length > 0 ? "SUCCESS" : "NO_RESULTS";
  console.log(`[PrecedentAgent] Search completed with status="${status}" (${formattedPrecedents.length} precedent(s) returned).`);

  return {
    status,
    precedents: formattedPrecedents,
  };
}

module.exports = { runPrecedentSearch, buildDetailedPrecedentQuery };
