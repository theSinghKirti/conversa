const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY, GEMINI_MODEL } = require("../../secrets.js");

/**
 * Lazy-initialized Gemini client — same singleton pattern used across the app.
 */
let ai;
const getGeminiClient = () => {
  if (!GEMINI_API_KEY) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return ai;
};

/**
 * Builds the Case Intake prompt.
 *
 * This prompt is deliberately narrow:
 *  - classify the issue
 *  - extract entities and keywords
 *  - produce a neutral summary
 *  - do NOT answer the legal question or provide any advice
 *
 * Low temperature (0.2) to get consistent, deterministic classification.
 */
function buildIntakePrompt(query, jurisdiction) {
  return `You are a legal case intake specialist. Your ONLY job is to analyse a user's legal situation, classify it, and extract structured metadata. You must NOT provide any legal advice, opinions, or answers.

User Query: """${query}"""
Jurisdiction: ${jurisdiction}

Return ONLY a raw JSON object — no markdown, no code fences, no explanation outside the JSON.

The JSON must have exactly these keys:
{
  "caseType": "<concise label for the type of case, e.g. 'Employment Dispute', 'Property Dispute', 'Consumer Complaint', 'Criminal Matter', 'Family Law Matter', 'Contract Dispute'>",
  "legalDomain": "<primary area of law, e.g. 'Labour Law', 'Tenant-Landlord Law', 'Consumer Law', 'Criminal Law', 'Family Law', 'Contract Law', 'Civil Law'>",
  "summary": "<2–3 sentence neutral, factual summary of the situation as described by the user — no opinions, no advice>",
  "relevantEntities": ["<list of key persons, organisations, or parties mentioned or implied, e.g. 'employer', 'employee', 'landlord', 'tenant', 'seller', 'buyer'>"],
  "jurisdiction": "${jurisdiction}",
  "keywords": ["<5–8 short retrieval keywords relevant to this case, e.g. 'wrongful termination', 'notice period', 'security deposit', 'online fraud', 'consumer rights'>"]
}

Rules:
1. caseType must be a short 2–4 word label.
2. legalDomain must be a recognised area of law.
3. summary must be strictly factual — do not include any legal opinion.
4. relevantEntities must be actual roles or named parties — not generic words.
5. keywords must be specific legal or factual terms useful for retrieval.
6. Do NOT include any advice, next steps, or legal commentary anywhere in the JSON.
7. Return ONLY the JSON object. Nothing else.`;
}

/**
 * Strips accidental markdown fences and parses the JSON response from Gemini.
 *
 * @param {string} raw
 * @returns {object}
 */
function parseIntakeResponse(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("[caseIntakeAgent] JSON parse failed. Raw snippet:", cleaned.slice(0, 400));
    throw new Error("Case Intake Agent returned malformed JSON. Please try again.");
  }
}

/**
 * Runs the Case Intake Agent.
 *
 * Responsibility: understand + classify the legal issue only.
 * Does NOT produce the advisory answer.
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
    throw new Error("Gemini API key is not configured. Cannot run Case Intake Agent.");
  }

  const prompt = buildIntakePrompt(query, jurisdiction);

  const response = await geminiClient.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,   // low — deterministic classification
      maxOutputTokens: 512,
    },
  });

  const rawText = response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!rawText) {
    throw new Error("Case Intake Agent received an empty response from Gemini.");
  }

  const parsed = parseIntakeResponse(rawText);

  // Normalise and validate output shape with safe defaults
  return {
    caseType:         typeof parsed.caseType === "string"        ? parsed.caseType.trim()         : "",
    legalDomain:      typeof parsed.legalDomain === "string"     ? parsed.legalDomain.trim()      : "",
    summary:          typeof parsed.summary === "string"         ? parsed.summary.trim()          : "",
    relevantEntities: Array.isArray(parsed.relevantEntities)     ? parsed.relevantEntities.filter(Boolean).map(String) : [],
    jurisdiction:     typeof parsed.jurisdiction === "string"    ? parsed.jurisdiction.trim()     : jurisdiction,
    keywords:         Array.isArray(parsed.keywords)             ? parsed.keywords.filter(Boolean).map(String) : [],
  };
}

module.exports = { runIntake };
