const { GoogleGenAI } = require("@google/genai");
const secrets = require("../../secrets.js");

/**
 * Lazy-initialized Gemini client.
 */
let ai;
let cachedGeminiKey;

const getGeminiClient = (apiKey) => {
  const key =
    apiKey ||
    (process.env.GEMINI_API_KEY !== undefined
      ? process.env.GEMINI_API_KEY
      : secrets.GEMINI_API_KEY);
  if (!key || typeof key !== "string" || key.trim().length === 0) return null;
  if (!ai || cachedGeminiKey !== key) {
    ai = new GoogleGenAI({ apiKey: key.trim() });
    cachedGeminiKey = key;
  }
  return ai;
};

const _resetClient = () => {
  ai = null;
  cachedGeminiKey = null;
};

/**
 * Builds the prompt for the Legal Response / Drafter Agent.
 *
 * @param {string} query
 * @param {object} intake
 * @param {Array<object>} retrievedSources
 * @param {Array<object>} precedents
 * @returns {string}
 */
function buildDrafterPrompt(query, intake, retrievedSources = [], precedents = []) {
  const {
    caseType,
    legalDomain,
    summary,
    relevantEntities,
    jurisdiction,
    keywords,
  } = intake;

  const entitiesStr = relevantEntities && relevantEntities.length ? relevantEntities.join(", ") : "N/A";
  const keywordsStr = keywords && keywords.length ? keywords.join(", ") : "N/A";

  let sourcesBlock = "";
  if (retrievedSources && retrievedSources.length > 0) {
    const formatted = retrievedSources
      .map(
        (src, idx) =>
          `[SOURCE ${idx + 1}]: "${src.title}" (${src.source})\nURL: ${
            src.sourceUrl || "N/A"
          }\nDOMAIN: ${src.legalDomain}\nEXCERPT:\n${src.content}`
      )
      .join("\n\n---\n\n");
    sourcesBlock = `--- RETRIEVED VERIFIED LEGAL SOURCES ---\nThe following verified legal excerpts were retrieved from the knowledge base for this issue:\n\n${formatted}\n--- END SOURCES ---\n`;
  } else {
    sourcesBlock = `--- RETRIEVED VERIFIED LEGAL SOURCES ---\nNo specific legal documents were retrieved from the knowledge base for this query.\n--- END SOURCES ---\n`;
  }

  let precedentsBlock = "";
  if (precedents && precedents.length > 0) {
    const formattedP = precedents
      .map(
        (p, idx) =>
          `[PRECEDENT ${idx + 1}]: "${p.caseName}" (${p.court}, ${p.dateOrYear})\nRELEVANCE: ${p.relevanceExplanation}\nSUMMARY: ${p.summary}`
      )
      .join("\n\n---\n\n");
    precedentsBlock = `--- RETRIEVED VERIFIED LEGAL PRECEDENTS ---\nThe following verified court judgments were retrieved for this issue:\n\n${formattedP}\n--- END PRECEDENTS ---\n`;
  } else {
    precedentsBlock = `--- RETRIEVED VERIFIED LEGAL PRECEDENTS ---\nNo reliable related legal precedents were identified for this query.\n--- END PRECEDENTS ---\n`;
  }

  return `You are a professional legal information specialist and drafting agent.
Your task is to analyze the user's issue, intake summary, verified legal sources, and verified precedents to produce a structured, clear, and realistic legal advisory.

--- CASE INTAKE SUMMARY ---
User Query: """${query}"""
Jurisdiction: ${jurisdiction}
Case Type: ${caseType}
Legal Domain: ${legalDomain}
Situation Summary: ${summary}
Relevant Entities: ${entitiesStr}
Keywords: ${keywordsStr}
--- END INTAKE ---

${sourcesBlock}
${precedentsBlock}

OPERATIONAL CONSTRAINTS & ACCURACY RULES:
1. PRIORITIZE RETRIEVED SOURCES & PRECEDENTS: Ground your legal explanation in the provided sources and court precedents.
2. NO FABRICATED CASE LAWS: NEVER invent, hallucinate, or fabricate any court judgment names, citations, section numbers, or source URLs not provided above.
3. EXPLICIT UNCERTAINTY: If key details or precedents are absent, explicitly highlight limitations and uncertainty in the "limitationsAndUncertainty" section.
4. NO ATTORNEY CLAIMS: Never state or imply that you are a licensed attorney, and never offer definitive legal guarantees or court outcome predictions.
5. NO LEGAL CHOICE MANDATE: Frame next steps as informational options for the user to discuss with a qualified legal professional.

Return ONLY a raw JSON object (no markdown fences, no text outside JSON) matching this exact schema:

{
  "issueIdentified": "<2-4 sentences describing the core legal issue in plain language, referencing the classified case type and relevant entities>",
  "generalLegalContext": "<3-5 sentences explaining relevant legal principles, statutes, and rights in ${jurisdiction} under ${legalDomain}. Explicitly cite retrieved sources where applicable.>",
  "relevantLegalInformation": [
    {
      "title": "<title of retrieved source or law>",
      "source": "<source name/statute>",
      "sourceUrl": "<source URL or empty string>",
      "excerpt": "<concise summary of key relevant rule>",
      "legalDomain": "${legalDomain}"
    }
  ],
  "possibleNextSteps": [
    "1. <actionable step 1>",
    "2. <actionable step 2>",
    "3. <actionable step 3>"
  ],
  "documentsToGather": [
    "<document or piece of evidence 1>",
    "<document or piece of evidence 2>",
    "<document or piece of evidence 3>"
  ],
  "limitationsAndUncertainty": "<2-3 sentences explaining any missing information, factual uncertainties, or nuances requiring professional legal review>",
  "disclaimer": "This information is generated by AI for general informational purposes only and does not constitute professional legal advice. Laws and procedures vary by jurisdiction and change over time. You should consult a qualified lawyer licensed in ${jurisdiction} before taking any legal action."
}

Note for "relevantLegalInformation": Include items ONLY if retrieved sources were provided above. If no retrieved sources were provided, return an empty array [] for "relevantLegalInformation".

Return ONLY the raw JSON object.`;
}

/**
 * Parses the JSON response cleanly.
 *
 * @param {string} raw
 * @returns {object}
 */
function parseDrafterResponse(raw) {
  let cleaned = (raw || "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0].trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("[LegalDrafterAgent] Failed to parse JSON response:", err.message);
    if (process.env.NODE_ENV !== "production") {
      console.error("[LegalDrafterAgent] Raw output:", raw);
    }
    throw new Error("Unable to parse structured legal advisory response from AI provider.");
  }
}

/**
 * Deterministic fallback legal advisory drafter.
 * Exported for backward compatibility / testing purposes only.
 */
function generateFallbackDrafter(query, intake, retrievedSources = [], precedents = []) {
  const { caseType, legalDomain, jurisdiction, summary } = intake;

  const sourcesList = retrievedSources.map((s) => ({
    title: s.title,
    source: s.source,
    sourceUrl: s.sourceUrl || "",
    excerpt: s.content,
    legalDomain: s.legalDomain,
  }));

  const steps = [];
  const docs = [];

  if (legalDomain === "Criminal Law") {
    steps.push("1. Immediately visit the nearest police station having territorial jurisdiction to report the theft/loss.");
    steps.push("2. File a First Information Report (FIR) under relevant sections of the Bharatiya Nyaya Sanhita (BNS) / IPC.");
    steps.push("3. Request and obtain a stamped copy of the FIR or Lost Article Report acknowledgement.");
    docs.push("Proof of identity (Aadhaar, Passport, or Voter ID)");
    docs.push("List of stolen contents with approximate values or serial numbers");
    docs.push("Any available CCTV footage, witness details, or location logs");
  } else if (legalDomain === "Tenant-Landlord Law") {
    steps.push("1. Review the terms of the registered tenancy/lease agreement regarding rent clauses and notice periods.");
    steps.push("2. Issue a formal written communication/notice detailing the agreed terms and disputed claims.");
    steps.push("3. Approach the Rent Authority or Rent Court under the applicable Tenancy/Rent Control Act if unresolved.");
    docs.push("Signed Tenancy / Lease Agreement");
    docs.push("Rent receipts, bank transfer records, and security deposit acknowledgement");
    docs.push("Written communications, notices, or email/SMS transcripts");
  } else if (legalDomain === "Labour Law") {
    steps.push("1. Review employment contract, appointment letter, and company exit/termination policies.");
    steps.push("2. Send a formal written representation or legal notice requesting full and final settlement and notice pay.");
    steps.push("3. File a complaint before the Labour Commissioner or Labour Court under the Industrial Disputes Act / Shops Act.");
    docs.push("Appointment letter, employment contract, and salary slips");
    docs.push("Termination letter / email or notice of cessation");
    docs.push("Bank statements showing salary credits and provident fund statements");
  } else {
    steps.push("1. Collate all written agreements, receipts, and communication logs related to this matter.");
    steps.push("2. Issue a formal notice stating facts, demands, and a reasonable compliance window.");
    steps.push("3. Consult a qualified legal practitioner in your jurisdiction for tailored guidance.");
    docs.push("Contracts, invoices, receipts, or relevant records");
    docs.push("Identity documents and communication logs");
  }

  return {
    issueIdentified: `Core Issue: ${caseType} under ${legalDomain} in ${jurisdiction}. ${summary}`,
    generalLegalContext: `Under ${jurisdiction} ${legalDomain}, matters involving ${caseType.toLowerCase()} are governed by established legal statutes. Parties are entitled to statutory remedies, due process, and legal dispute resolution mechanisms.`,
    relevantLegalInformation: sourcesList,
    possibleNextSteps: steps,
    documentsToGather: docs,
    limitationsAndUncertainty: `Specific legal nuances, limitation periods, and jurisdiction thresholds require verification with a qualified legal professional licensed in ${jurisdiction}.`,
    disclaimer: `This information is generated for general informational purposes only and does not constitute professional legal advice. Consult a qualified lawyer licensed in ${jurisdiction} before taking legal action.`,
  };
}

/**
 * Runs the Legal Response / Drafter Agent.
 *
 * @param {string} query
 * @param {object} intake
 * @param {Array<object>} retrievedSources
 * @param {Array<object>} precedents
 * @returns {Promise<{
 *   issueIdentified: string,
 *   generalLegalContext: string,
 *   relevantLegalInformation: Array<object>,
 *   possibleNextSteps: string[],
 *   documentsToGather: string[],
 *   limitationsAndUncertainty: string,
 *   disclaimer: string
 * }>}
 */
async function runDrafter(query, intake, retrievedSources = [], precedents = []) {
  const prompt = buildDrafterPrompt(query, intake, retrievedSources, precedents);

  const rawGroqKey =
    process.env.GROQ_API_KEY !== undefined
      ? process.env.GROQ_API_KEY
      : secrets.GROQ_API_KEY;
  const groqKey = typeof rawGroqKey === "string" ? rawGroqKey.trim() : "";
  const isGroqConfigured = groqKey.length > 0;

  const rawGeminiKey =
    process.env.GEMINI_API_KEY !== undefined
      ? process.env.GEMINI_API_KEY
      : secrets.GEMINI_API_KEY;
  const geminiKey = typeof rawGeminiKey === "string" ? rawGeminiKey.trim() : "";
  const isGeminiConfigured = geminiKey.length > 0;

  if (!isGroqConfigured && !isGeminiConfigured) {
    const configErr = new Error("No AI generation provider is configured.");
    configErr.code = "AI_PROVIDER_NOT_CONFIGURED";
    throw configErr;
  }

  const failureReasons = [];

  // 1. Try Groq if configured
  if (isGroqConfigured) {
    try {
      console.log("[LegalDrafterAgent] Calling Groq with response_format: json_object...");
      const groqModel =
        process.env.GROQ_MODEL || secrets.GROQ_MODEL || "llama-3.3-70b-versatile";
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            response_format: { type: "json_object" },
            max_tokens: 2048,
          }),
        }
      );

      if (groqResponse.ok) {
        const data = await groqResponse.json();
        const rawText = data?.choices?.[0]?.message?.content ?? "";
        if (rawText) {
          const parsed = parseDrafterResponse(rawText);
          return {
            issueIdentified:
              typeof parsed.issueIdentified === "string"
                ? parsed.issueIdentified.trim()
                : "",
            generalLegalContext:
              typeof parsed.generalLegalContext === "string"
                ? parsed.generalLegalContext.trim()
                : "",
            relevantLegalInformation: Array.isArray(
              parsed.relevantLegalInformation
            )
              ? parsed.relevantLegalInformation
              : [],
            possibleNextSteps: Array.isArray(parsed.possibleNextSteps)
              ? parsed.possibleNextSteps.filter(Boolean).map(String)
              : [],
            documentsToGather: Array.isArray(parsed.documentsToGather)
              ? parsed.documentsToGather.filter(Boolean).map(String)
              : [],
            limitationsAndUncertainty:
              typeof parsed.limitationsAndUncertainty === "string"
                ? parsed.limitationsAndUncertainty.trim()
                : "",
            disclaimer:
              typeof parsed.disclaimer === "string"
                ? parsed.disclaimer.trim()
                : "This information is generated by AI for general informational purposes only and does not constitute professional legal advice.",
          };
        }
        failureReasons.push("Groq returned empty content");
      } else {
        const errText = await groqResponse.text().catch(() => "");
        console.warn(
          `[LegalDrafterAgent] Groq request failed (${groqResponse.status})`
        );
        failureReasons.push(
          `Groq HTTP ${groqResponse.status}: ${
            errText.slice(0, 80) || groqResponse.statusText
          }`
        );
      }
    } catch (groqErr) {
      console.warn("[LegalDrafterAgent] Groq API call failed:", groqErr.message);
      failureReasons.push(`Groq: ${groqErr.message}`);
    }
  }

  // 2. Try Gemini if configured
  if (isGeminiConfigured) {
    try {
      const client = getGeminiClient(geminiKey);
      if (!client) {
        failureReasons.push("Gemini client initialization failed");
      } else {
        console.log(
          "[LegalDrafterAgent] Calling Gemini with responseMimeType: application/json..."
        );
        const geminiModel =
          process.env.GEMINI_MODEL ||
          secrets.GEMINI_MODEL ||
          "gemini-3-flash-preview";
        const response = await client.models.generateContent({
          model: geminiModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        });

        const rawText =
          response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (rawText) {
          const parsed = parseDrafterResponse(rawText);
          return {
            issueIdentified:
              typeof parsed.issueIdentified === "string"
                ? parsed.issueIdentified.trim()
                : "",
            generalLegalContext:
              typeof parsed.generalLegalContext === "string"
                ? parsed.generalLegalContext.trim()
                : "",
            relevantLegalInformation: Array.isArray(
              parsed.relevantLegalInformation
            )
              ? parsed.relevantLegalInformation
              : [],
            possibleNextSteps: Array.isArray(parsed.possibleNextSteps)
              ? parsed.possibleNextSteps.filter(Boolean).map(String)
              : [],
            documentsToGather: Array.isArray(parsed.documentsToGather)
              ? parsed.documentsToGather.filter(Boolean).map(String)
              : [],
            limitationsAndUncertainty:
              typeof parsed.limitationsAndUncertainty === "string"
                ? parsed.limitationsAndUncertainty.trim()
                : "",
            disclaimer:
              typeof parsed.disclaimer === "string"
                ? parsed.disclaimer.trim()
                : "This information is generated by AI for general informational purposes only and does not constitute professional legal advice.",
          };
        }
        failureReasons.push("Gemini returned empty content");
      }
    } catch (geminiErr) {
      console.warn(
        "[LegalDrafterAgent] Gemini API call failed:",
        geminiErr.message
      );
      failureReasons.push(`Gemini: ${geminiErr.message}`);
    }
  }

  const aiError = new Error(
    `Legal Advisory Drafter failed across all configured AI providers: ${failureReasons.join(
      "; "
    )}`
  );
  aiError.code = "AI_GENERATION_FAILED";
  throw aiError;
}

module.exports = { runDrafter, generateFallbackDrafter, _resetClient };
