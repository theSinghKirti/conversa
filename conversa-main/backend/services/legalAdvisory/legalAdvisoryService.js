const { runIntake } = require("./caseIntakeAgent.js");
const { retrieve } = require("./rag/legalRetriever.js");
const { runPrecedentSearch } = require("./precedentAgent.js");
const { runDrafter } = require("./legalDrafterAgent.js");
const { rerankEvidence } = require("./evidenceReranker.js");

/**
 * Formats structured Drafter output into a human-readable text block for
 * backward compatibility with any consumer reading advisoryResponse.
 *
 * @param {object} drafterOutput
 * @returns {string}
 */
function formatAdvisoryText(drafterOutput) {
  const {
    issueIdentified,
    generalLegalContext,
    possibleNextSteps,
    documentsToGather,
    limitationsAndUncertainty,
    disclaimer,
  } = drafterOutput;

  const stepsStr = possibleNextSteps.length
    ? possibleNextSteps.join("\n")
    : "1. Consult a qualified legal professional for case-specific guidance.";

  const docsStr = documentsToGather.length
    ? documentsToGather.join("\n")
    : "• Any contracts, communications, or receipts relevant to your issue.";

  return `ISSUE IDENTIFIED:
${issueIdentified}

GENERAL LEGAL CONTEXT:
${generalLegalContext}

POSSIBLE NEXT STEPS:
${stepsStr}

DOCUMENTS/INFORMATION THE USER SHOULD GATHER:
${docsStr}

LIMITATIONS AND UNCERTAINTY:
${limitationsAndUncertainty || "Consult a lawyer licensed in your jurisdiction to evaluate specific nuances."}

IMPORTANT DISCLAIMER:
${disclaimer}`;
}

function stripRankingMetadata(items = []) {
  return items.map(({ finalScore, rankingReasons, ...rest }) => rest);
}

/**
 * Four-Stage Legal Advisory Orchestrator.
 *
 * Stage 1 — Case Intake Agent (caseIntakeAgent.js)
 * Stage 2 — Legal Knowledge RAG (rag/legalRetriever.js)
 * Stage 3 — Legal Precedent Search (precedentAgent.js)
 * Stage 4 — Legal Response / Drafter Agent (legalDrafterAgent.js)
 *
 * Logging & Status Tracking:
 *   Tracks explicit statuses for RAG and Precedent search:
 *   - "SUCCESS"
 *   - "NO_RESULTS"
 *   - "NOT_CONFIGURED"
 *   - "FAILED"
 *
 * @param {string} query
 * @param {string} jurisdiction
 * @returns {Promise<{
 *   caseType: string,
 *   legalDomain: string,
 *   caseSummary: string,
 *   advisoryResponse: string,
 *   relevantEntities: string[],
 *   keywords: string[],
 *   retrievedSources: Array<object>,
 *   precedents: Array<object>,
 *   ragSearchStatus: string,
 *   precedentSearchStatus: string,
 *   issueIdentified: string,
 *   generalLegalContext: string,
 *   possibleNextSteps: string[],
 *   documentsToGather: string[],
 *   limitationsAndUncertainty: string,
 *   disclaimer: string
 * }>}
 */
async function generateAdvisory(query, jurisdiction = "India") {
  console.log("\n=================================================");
  console.log("[Orchestrator] Starting Legal Advisory Pipeline");
  console.log("=================================================");

  // ── Stage 1: Case Intake Agent ───────────────────────────────────────────
  console.log("[Orchestrator] Stage 1 — Running Case Intake Agent…");
  let intake;
  try {
    intake = await runIntake(query, jurisdiction);
  } catch (intakeErr) {
    console.error("[Orchestrator] Stage 1 Intake Failed:", intakeErr.message);
    throw new Error(`Case Intake failed: ${intakeErr.message}`);
  }

  console.log("[Orchestrator] Stage 1 Complete:", {
    caseType: intake.caseType,
    legalDomain: intake.legalDomain,
    keywordsCount: intake.keywords.length,
  });

  // ── Stage 2 & 3: Parallel Retrieval (Legal Knowledge RAG + Precedent Search) ───
  console.log("[Orchestrator] Stage 2 & 3 — Running Parallel Retrieval (Legal Knowledge RAG + Precedents)…");

  const parallelStart = Date.now();
  const legalRetrievalStart = Date.now();
  console.log(`[Legal Retrieval] START timestamp ${legalRetrievalStart}`);
  const legalRetrievalPromise = retrieve(intake, { limit: 4, minScore: 0.25 })
    .catch((ragErr) => {
      console.error("[Orchestrator] Stage 2 RAG Exception:", ragErr.message);
      return { status: "FAILED", sources: [] };
    })
    .finally(() => {
      const legalRetrievalEnd = Date.now();
      console.log(`[Legal Retrieval] END timestamp ${legalRetrievalEnd} duration ${legalRetrievalEnd - legalRetrievalStart}ms`);
    });

  const precedentRetrievalStart = Date.now();
  console.log(`[Precedent Retrieval] START timestamp ${precedentRetrievalStart}`);
  const precedentRetrievalPromise = runPrecedentSearch(intake, [], jurisdiction)
    .catch((precedentErr) => {
      console.error("[Orchestrator] Stage 3 Precedent Exception:", precedentErr.message);
      return { status: "FAILED", precedents: [] };
    })
    .finally(() => {
      const precedentRetrievalEnd = Date.now();
      console.log(`[Precedent Retrieval] END timestamp ${precedentRetrievalEnd} duration ${precedentRetrievalEnd - precedentRetrievalStart}ms`);
    });

  const [ragResult, precedentResult] = await Promise.all([
    legalRetrievalPromise,
    precedentRetrievalPromise,
  ]);

  const parallelEnd = Date.now();
  console.log(`[Parallel Retrieval] TOTAL duration ${parallelEnd - parallelStart}ms`);

  console.log(
    `[Orchestrator] Parallel Retrieval Complete — RAG Status: "${ragResult.status}" (${ragResult.sources.length} sources), ` +
    `Precedent Status: "${precedentResult.status}" (${precedentResult.precedents.length} precedents).`
  );

  const rerankedEvidence = rerankEvidence({ intake, ragResult, precedentResult });
  const rankedLegalSources = rerankedEvidence.legalSources;
  const rankedPrecedents = rerankedEvidence.precedents;

  // ── Stage 4: Legal Response / Drafter Agent ───────────────────────────────
  console.log("[Orchestrator] Stage 4 — Starting Legal Drafter Agent…");
  let drafterResult;
  try {
    drafterResult = await runDrafter(query, intake, rankedLegalSources, rankedPrecedents);
  } catch (drafterErr) {
    console.error("[Orchestrator] Stage 4 Drafter Failed:", drafterErr.message);
    throw new Error(`Legal Drafter Agent failed: ${drafterErr.message}`);
  }
  console.log("[Orchestrator] Stage 4 Complete — Advisory draft successfully generated.");
  console.log("=================================================\n");

  return {
    caseType: intake.caseType,
    legalDomain: intake.legalDomain,
    caseSummary: intake.summary,
    advisoryResponse: formatAdvisoryText(drafterResult),
    relevantEntities: intake.relevantEntities,
    keywords: intake.keywords,

    // RAG and Precedent payload & status codes
    retrievedSources: stripRankingMetadata(rankedLegalSources),
    precedents: stripRankingMetadata(rankedPrecedents),
    ragSearchStatus: rerankedEvidence.retrievalStatus.legal,
    precedentSearchStatus: rerankedEvidence.retrievalStatus.precedents,

    // Structured Drafter Agent fields
    issueIdentified: drafterResult.issueIdentified,
    generalLegalContext: drafterResult.generalLegalContext,
    possibleNextSteps: drafterResult.possibleNextSteps,
    documentsToGather: drafterResult.documentsToGather,
    limitationsAndUncertainty: drafterResult.limitationsAndUncertainty,
    disclaimer: drafterResult.disclaimer,
  };
}

module.exports = { generateAdvisory };
