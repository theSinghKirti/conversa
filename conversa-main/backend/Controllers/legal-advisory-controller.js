const LegalAdvisory = require("../Models/LegalAdvisory.js");
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

  // Call the AI service (two-stage: intake → advisory)
  try {
    const {
      caseType,
      legalDomain,
      caseSummary,
      advisoryResponse,
      relevantEntities,
      keywords,
      retrievedSources,
    } = await generateAdvisory(
      query.trim(),
      jurisdiction.trim() || "India"
    );

    // Update record with the full result
    advisoryRecord.status = "COMPLETED";
    advisoryRecord.caseType = caseType;
    advisoryRecord.legalDomain = legalDomain;
    advisoryRecord.caseSummary = caseSummary;
    advisoryRecord.advisoryResponse = advisoryResponse;
    advisoryRecord.relevantEntities = relevantEntities || [];
    advisoryRecord.keywords = keywords || [];
    advisoryRecord.retrievedSources = retrievedSources || [];
    await advisoryRecord.save();

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
        createdAt: advisoryRecord.createdAt,
        updatedAt: advisoryRecord.updatedAt,
      },
    });
  } catch (error) {
    console.error("[legal-advisory-controller] AI generation failed:", error.message);

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

module.exports = { analyzeQuery };
