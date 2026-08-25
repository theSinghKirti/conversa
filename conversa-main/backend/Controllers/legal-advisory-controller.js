const LegalAdvisory = require("../Models/LegalAdvisory.js");
const mongoose = require("mongoose");
const LegalKnowledgeChunk = require("../Models/LegalKnowledgeChunk.js");
const LegalPrecedent = require("../Models/LegalPrecedent.js");
const { generateAdvisory } = require("../services/legalAdvisory/legalAdvisoryService.js");

/**
 * POST /api/legal-advisory/analyze
 *
 * Authenticated endpoint. Accepts a legal query and jurisdiction,
 * calls Gemini via legalAdvisoryService, and returns a structured advisory.
 */
const analyzeQuery = async (req, res) => {
  const userId = req.user.id;
  const { query, jurisdiction = "India" } = req.body;

  // Validate query
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({ error: "query is required and must not be empty." });
  }

  if (query.trim().length < 20) {
    return res.status(400).json({ error: "Please describe your legal issue in at least 20 characters." });
  }

  // Create a record immediately so we have something to update on failure
  let advisoryRecord;
  try {
    advisoryRecord = await LegalAdvisory.create({
      userId,
      query: query.trim(),
      jurisdiction: jurisdiction.trim() || "India",
      status: "PROCESSING",
    });
  } catch (error) {
    console.error("[legal-advisory-controller] Failed to create record:", error.message);
    return res.status(500).send("Internal Server Error");
  }

  // Call the AI pipeline (3-stage: intake → RAG retrieval → Drafter Agent)
  try {
    const result = await generateAdvisory(
      query.trim(),
      jurisdiction.trim() || "India"
    );

    // Update record with full pipeline result
    advisoryRecord.status = "COMPLETED";
    advisoryRecord.caseType = result.caseType || "";
    advisoryRecord.legalDomain = result.legalDomain || "";
    advisoryRecord.caseSummary = result.caseSummary || "";
    advisoryRecord.advisoryResponse = result.advisoryResponse || "";
    advisoryRecord.relevantEntities = result.relevantEntities || [];
    advisoryRecord.keywords = result.keywords || [];
    advisoryRecord.retrievedSources = result.retrievedSources || [];
    advisoryRecord.precedents = result.precedents || [];
    advisoryRecord.ragSearchStatus = result.ragSearchStatus || "NOT_CONFIGURED";
    advisoryRecord.precedentSearchStatus = result.precedentSearchStatus || "NOT_CONFIGURED";

    // Structured Drafter Agent fields
    advisoryRecord.issueIdentified = result.issueIdentified || "";
    advisoryRecord.generalLegalContext = result.generalLegalContext || "";
    advisoryRecord.possibleNextSteps = result.possibleNextSteps || [];
    advisoryRecord.documentsToGather = result.documentsToGather || [];
    advisoryRecord.limitationsAndUncertainty = result.limitationsAndUncertainty || "";
    advisoryRecord.disclaimer = result.disclaimer || "";

    await advisoryRecord.save();

    console.log(`[legal-advisory-controller] Saved advisory ${advisoryRecord._id} (Status: COMPLETED). RAG: "${advisoryRecord.ragSearchStatus}", Precedents: "${advisoryRecord.precedentSearchStatus}".`);

    return res.status(200).json({
      success: true,
      advisory: {
        _id: advisoryRecord._id,
        userId: advisoryRecord.userId,
        query: advisoryRecord.query,
        jurisdiction: advisoryRecord.jurisdiction,
        status: advisoryRecord.status,
        caseType: advisoryRecord.caseType,
        legalDomain: advisoryRecord.legalDomain,
        caseSummary: advisoryRecord.caseSummary,
        advisoryResponse: advisoryRecord.advisoryResponse,
        relevantEntities: advisoryRecord.relevantEntities,
        keywords: advisoryRecord.keywords,
        retrievedSources: advisoryRecord.retrievedSources,
        precedents: advisoryRecord.precedents,
        ragSearchStatus: advisoryRecord.ragSearchStatus,
        precedentSearchStatus: advisoryRecord.precedentSearchStatus,
        issueIdentified: advisoryRecord.issueIdentified,
        generalLegalContext: advisoryRecord.generalLegalContext,
        possibleNextSteps: advisoryRecord.possibleNextSteps,
        documentsToGather: advisoryRecord.documentsToGather,
        limitationsAndUncertainty: advisoryRecord.limitationsAndUncertainty,
        disclaimer: advisoryRecord.disclaimer,
        createdAt: advisoryRecord.createdAt,
        updatedAt: advisoryRecord.updatedAt,
      },
    });
  } catch (error) {
    console.error("[legal-advisory-controller] AI pipeline generation failed:", error.message);

    // Update record status to FAILED
    try {
      advisoryRecord.status = "FAILED";
      await advisoryRecord.save();
    } catch (saveError) {
      console.error("[legal-advisory-controller] Failed to update status to FAILED:", saveError.message);
    }

    return res.status(500).json({
      error: error.message || "Failed to generate legal advisory. Please try again.",
    });
  }
};

/**
 * GET /api/legal-advisory/health/data
 *
 * Admin-only diagnostic endpoint that reports the active database and
 * collection counts without exposing credentials or document content.
 */
const getDataHealth = async (_req, res) => {
  try {
    const databaseConnected = mongoose.connection.readyState === 1;
    const databaseName = mongoose.connection?.db?.databaseName || mongoose.connection?.name || null;

    const [legalKnowledgeChunks, legalPrecedents] = databaseConnected
      ? await Promise.all([
          LegalKnowledgeChunk.countDocuments(),
          LegalPrecedent.countDocuments(),
        ])
      : [0, 0];

    return res.status(200).json({
      success: true,
      databaseConnected,
      databaseName,
      collections: {
        legalKnowledgeChunks,
        legalPrecedents,
      },
    });
  } catch (error) {
    console.error("[legal-advisory-controller] Data health check failed:", error.message);
    return res.status(500).json({
      success: false,
      error: "Unable to read database health.",
    });
  }
};

module.exports = { analyzeQuery, getDataHealth };
