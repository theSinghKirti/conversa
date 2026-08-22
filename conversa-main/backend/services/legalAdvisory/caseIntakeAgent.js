const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../secrets.js");

/**
 * Lazy-initialized Gemini client — same singleton pattern used across the app.
 */
let ai;
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey });
  return ai;
};

/**
 * Builds the Case Intake prompt.
 *
 * Explicitly instructs Gemini to return strictly valid raw JSON without markdown or code fences.
 */
function buildIntakePrompt(query, jurisdiction) {
  return `You are a legal case intake specialist. Your ONLY job is to analyse a user's legal situation, classify it, and extract structured metadata. You must NOT provide any legal advice, opinions, or answers.

User Query: """${query}"""
Jurisdiction: ${jurisdiction}

You must return ONLY a valid JSON object.
Do not include markdown.
Do not wrap the response in \`\`\`json code fences.
Do not include any explanation before or after the JSON.
Your complete response must be directly parseable as JSON.

The required output structure is:
{
  "caseType": "<concise label for the type of case, e.g. 'Employment Dispute', 'Property Dispute', 'Consumer Complaint', 'Lost Property / Theft', 'Criminal Matter', 'Family Law Matter', 'Contract Dispute'>",
  "legalDomain": "<primary area of law, e.g. 'Labour Law', 'Tenant-Landlord Law', 'Consumer Law', 'Civil / Criminal Law', 'Family Law', 'Contract Law'>",
  "summary": "<2–3 sentence neutral, factual summary of the situation as described by the user — no opinions, no advice>",
  "relevantEntities": ["<list of key persons, organisations, or parties mentioned or implied, e.g. 'employer', 'employee', 'landlord', 'tenant', 'seller', 'buyer', 'owner', 'police'>"],
  "jurisdiction": "${jurisdiction}",
  "keywords": ["<5–8 short retrieval keywords relevant to this case, e.g. 'wrongful termination', 'notice period', 'security deposit', 'online fraud', 'lost property', 'theft report'>"]
}

Rules:
1. caseType must be a short 2–4 word string.
2. legalDomain must be a recognised area of law string.
3. summary must be a strictly factual string — do not include any legal advice.
4. relevantEntities must be an array of strings representing roles or parties.
5. jurisdiction must be a string.
6. keywords must be an array of strings.
7. Return ONLY the raw JSON object. Nothing else.`;
}

/**
 * Robust JSON extraction and parsing for Case Intake Agent.
 *
 * 1. Trims leading/trailing whitespace
 * 2. Strips markdown fences (\`\`\`json ... \`\`\` or \`\`\` ... \`\`\`)
 * 3. Extracts JSON substring if surrounding text is present
 * 4. Parses cleaned JSON
 *
 * @param {string} raw
 * @returns {object}
 */
function parseIntakeResponse(raw) {
  if (!raw || typeof raw !== "string") {
    console.error("[CaseIntakeAgent] Raw Gemini response is empty or not a string.");
    throw new Error("Unable to process your legal issue right now. Please try again.");
  }

  let cleaned = raw.trim();

  // 1. Remove markdown fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  // 2. Extract JSON object substring if surrounded by extra text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error("[CaseIntakeAgent] JSON parse error:", parseError.message);
    if (process.env.NODE_ENV !== "production") {
      console.error("[CaseIntakeAgent] Raw Gemini output received:", raw);
      console.error("[CaseIntakeAgent] Cleaned string attempted:", cleaned);
    }
    throw new Error("Unable to process your legal issue right now. Please try again.");
  }
}

/**
 * Validates that the parsed object conforms to the required intake schema.
 * Applies safe defaults where appropriate.
 *
 * @param {object} parsed
 * @param {string} fallbackJurisdiction
 * @returns {{
 *   caseType: string,
 *   legalDomain: string,
 *   summary: string,
 *   relevantEntities: string[],
 *   jurisdiction: string,
 *   keywords: string[]
 * }}
 */
function validateIntakeOutput(parsed, fallbackJurisdiction = "India") {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Unable to process your legal issue right now. Please try again.");
  }

  const caseType = typeof parsed.caseType === "string" && parsed.caseType.trim().length > 0
    ? parsed.caseType.trim()
    : "General Legal Matter";

  const legalDomain = typeof parsed.legalDomain === "string" && parsed.legalDomain.trim().length > 0
    ? parsed.legalDomain.trim()
    : "General Law";

  const summary = typeof parsed.summary === "string" && parsed.summary.trim().length > 0
    ? parsed.summary.trim()
    : "";

  const relevantEntities = Array.isArray(parsed.relevantEntities)
    ? parsed.relevantEntities.filter((e) => typeof e === "string" && e.trim().length > 0).map((e) => e.trim())
    : [];

  const jurisdiction = typeof parsed.jurisdiction === "string" && parsed.jurisdiction.trim().length > 0
    ? parsed.jurisdiction.trim()
    : fallbackJurisdiction;

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((k) => typeof k === "string" && k.trim().length > 0).map((k) => k.trim())
    : [];

  return {
    caseType,
    legalDomain,
    summary,
    relevantEntities,
    jurisdiction,
    keywords,
  };
}

/**
 * Deterministic offline intake classifier.
 */
function generateFallbackIntake(query, jurisdiction = "India") {
  const qLower = (query || "").toLowerCase();

  let caseType = "General Legal Matter";
  let legalDomain = "Civil Law";
  let keywords = ["legal advice", "rights", "procedure"];
  let entities = ["party A", "party B"];

  if (qLower.includes("landlord") || qLower.includes("rent") || qLower.includes("deposit") || qLower.includes("tenant")) {
    caseType = "Tenancy Dispute";
    legalDomain = "Tenant-Landlord Law";
    keywords = ["security deposit", "rent increase", "tenancy agreement", "eviction"];
    entities = ["landlord", "tenant"];
  } else if (qLower.includes("employer") || qLower.includes("fired") || qLower.includes("terminate") || qLower.includes("notice") || qLower.includes("salary")) {
    caseType = "Employment Dispute";
    legalDomain = "Labour Law";
    keywords = ["wrongful termination", "notice period", "severance", "full and final"];
    entities = ["employer", "employee"];
  } else if (qLower.includes("cheated") || qLower.includes("online") || qLower.includes("fraud") || qLower.includes("transaction") || qLower.includes("money")) {
    caseType = "Consumer Fraud";
    legalDomain = "Consumer Law";
    keywords = ["online fraud", "financial cheating", "consumer rights", "refund"];
    entities = ["buyer", "seller"];
  } else if (qLower.includes("purse") || qLower.includes("lost") || qLower.includes("stolen") || qLower.includes("theft")) {
    caseType = "Lost Property / Theft";
    legalDomain = "Criminal Law";
    keywords = ["lost property", "theft FIR", "police complaint", "stolen items"];
    entities = ["complainant", "police"];
  }

  return validateIntakeOutput({
    caseType,
    legalDomain,
    summary: `User reports issue regarding ${caseType.toLowerCase()} in ${jurisdiction}: "${query}".`,
    relevantEntities: entities,
    jurisdiction,
    keywords,
  }, jurisdiction);
}

/**
 * Runs the Case Intake Agent.
 *
 * Responsibility: understand + classify the legal issue only.
 * Does NOT produce the final legal advisory.
 *
 * @param {string} query       — The user's raw legal description
 * @param {string} jurisdiction — e.g. "India"
 * @returns {Promise<{
 *   caseType: string,
 *   legalDomain: string,
 *   summary: string,
 *   relevantEntities: string[],
 *   jurisdiction: string,
 *   keywords: string[]
 * }>}
 */
async function runIntake(query, jurisdiction = "India") {
  const geminiClient = getGeminiClient();
  if (!geminiClient) {
    console.warn("[CaseIntakeAgent] GEMINI_API_KEY missing — using deterministic offline intake classification.");
    return generateFallbackIntake(query, jurisdiction);
  }

  const prompt = buildIntakePrompt(query, jurisdiction);

  try {
    console.log("[CaseIntakeAgent] Calling Gemini with responseMimeType: application/json...");
    const response = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.2, // low — deterministic classification
        maxOutputTokens: 1024,
      },
    });

    const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!rawText) {
      console.warn("[CaseIntakeAgent] Empty response from Gemini — using fallback classification.");
      return generateFallbackIntake(query, jurisdiction);
    }

    const parsed = parseIntakeResponse(rawText);
    return validateIntakeOutput(parsed, jurisdiction);
  } catch (err) {
    console.warn("[CaseIntakeAgent] Gemini API unavailable or quota exceeded:", err.message, "— using fallback classification.");
    return generateFallbackIntake(query, jurisdiction);
  }
}

module.exports = { runIntake, parseIntakeResponse, validateIntakeOutput, generateFallbackIntake };
