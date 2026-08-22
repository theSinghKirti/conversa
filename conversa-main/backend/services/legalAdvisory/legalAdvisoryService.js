const { runIntake } = require("./caseIntakeAgent.js");
const { retrieve } = require("./rag/legalRetriever.js");
const { runPrecedentSearch } = require("./precedentAgent.js");
const { runDrafter } = require("./legalDrafterAgent.js");

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

/**
 * Four-Stage Legal Advisory Orchestrator.
 *
 * Stage 1 — Case Intake Agent (caseIntakeAgent.js):
 *   Understands, classifies, extracts entities & keywords, writes neutral summary.
 *
 * Stage 2 — Legal Knowledge RAG (rag/legalRetriever.js):
 *   Retrieves top semantic vector matches for statutory legal knowledge.
 *
 * Stage 3 — Legal Precedent Search (precedentAgent.js):
 *   Retrieves top verified court ruling precedents for the case type & domain.
 *
 * Stage 4 — Legal Response / Drafter Agent (legalDrafterAgent.js):
 *   Synthesizes query, intake, knowledge chunks, and court precedents into structured advisory.
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
 *   issueIdentified: string,
 *   generalLegalContext: string,
 *   possibleNextSteps: string[],
 *   documentsToGather: string[],
 *   limitationsAndUncertainty: string,
 *   disclaimer: string
 * }>}
 */
async function generateAdvisory(query, jurisdiction = "India") {
  // ── Stage 1: Case Intake Agent ───────────────────────────────────────────
  console.log("[legalAdvisoryService] Stage 1 — Running Case Intake Agent…");
  let intake;
  try {
    intake = await runIntake(query, jurisdiction);
  } catch (intakeErr) {
    console.error("[legalAdvisoryService] Stage 1 Intake Failed:", intakeErr.message);
    throw new Error(`Case Intake failed: ${intakeErr.message}`);
  }

  console.log("[legalAdvisoryService] Stage 1 complete:", {
    caseType: intake.caseType,
    legalDomain: intake.legalDomain,
    keywords: intake.keywords,
  });

  // ── Stage 2: Legal Knowledge RAG Retrieval ──────────────────────────────
  console.log("[legalAdvisoryService] Stage 2 — Retrieving legal knowledge sources via RAG…");
  let retrievedSources = [];
  try {
    retrievedSources = await retrieve(intake, { limit: 4, minScore: 0.5 });
  } catch (ragErr) {
    console.warn("[legalAdvisoryService] Stage 2 RAG warning (proceeding with empty sources):", ragErr.message);
    retrievedSources = [];
  }
  console.log(`[legalAdvisoryService] Stage 2 complete — ${retrievedSources.length} knowledge chunk(s) retrieved.`);

  // ── Stage 3: Legal Precedent Search ──────────────────────────────────────
  console.log("[legalAdvisoryService] Stage 3 — Running Precedent Search Agent…");
  let precedents = [];
  try {
    precedents = await runPrecedentSearch(intake, retrievedSources, jurisdiction);
  } catch (precedentErr) {
    console.warn("[legalAdvisoryService] Stage 3 Precedent warning (proceeding with empty precedents):", precedentErr.message);
    precedents = [];
  }
  console.log(`[legalAdvisoryService] Stage 3 complete — ${precedents.length} precedent(s) retrieved.`);

  // ── Stage 4: Legal Response / Drafter Agent ───────────────────────────────
  console.log("[legalAdvisoryService] Stage 4 — Running Legal Drafter Agent…");
  let drafterResult;
  try {
    drafterResult = await runDrafter(query, intake, retrievedSources, precedents);
  } catch (drafterErr) {
    console.error("[legalAdvisoryService] Stage 4 Drafter Failed:", drafterErr.message);
    throw new Error(`Legal Drafter Agent failed: ${drafterErr.message}`);
  }

  console.log("[legalAdvisoryService] Stage 4 complete — advisory successfully generated.");

  return {
    caseType: intake.caseType,
    legalDomain: intake.legalDomain,
    caseSummary: intake.summary,
    advisoryResponse: formatAdvisoryText(drafterResult),
    relevantEntities: intake.relevantEntities,
    keywords: intake.keywords,
    retrievedSources,
    precedents,

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
