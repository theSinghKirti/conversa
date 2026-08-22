const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const { runIntake, parseIntakeResponse, validateIntakeOutput } = require("../services/legalAdvisory/caseIntakeAgent.js");

const TEST_QUERIES = [
  "purse lost is my office",
  "My employer fired me without notice",
  "My landlord is refusing to return my security deposit",
  "I was cheated in an online transaction",
];

async function runTests() {
  console.log("=================================================");
  console.log(" Case Intake Agent Verification Suite");
  console.log("=================================================\n");

  // ── Unit Tests for Parser & Validator ─────────────────────────────────────
  console.log("--- 1. Testing Robust Parser & Validator (Unit Tests) ---");

  const sampleMarkdownResponse = "```json\n{\n  \"caseType\": \"Lost Property\",\n  \"legalDomain\": \"Civil Law\",\n  \"summary\": \"User lost purse in office.\",\n  \"relevantEntities\": [\"employee\", \"office management\"],\n  \"jurisdiction\": \"India\",\n  \"keywords\": [\"lost property\", \"purse\", \"office\"]\n}\n```";

  try {
    const parsedUnit = parseIntakeResponse(sampleMarkdownResponse);
    const validatedUnit = validateIntakeOutput(parsedUnit, "India");

    console.log("  [Markdown Code Fence Parsing]: PASSED ✓");
    console.log("  [Schema Validation]:           PASSED ✓");
  } catch (err) {
    console.error("  ❌ Unit test failed:", err.message);
    process.exit(1);
  }

  const sampleSurroundedResponse = "Sure, here is the intake summary:\n{\n  \"caseType\": \"Consumer Complaint\",\n  \"legalDomain\": \"Consumer Law\",\n  \"summary\": \"Online transaction fraud.\",\n  \"relevantEntities\": [\"buyer\", \"seller\"],\n  \"jurisdiction\": \"India\",\n  \"keywords\": [\"online fraud\", \"cheating\"]\n}\nHope this helps!";

  try {
    const parsedSurrounded = parseIntakeResponse(sampleSurroundedResponse);
    const validatedSurrounded = validateIntakeOutput(parsedSurrounded, "India");

    console.log("  [Surrounding Text Extraction]: PASSED ✓\n");
  } catch (err) {
    console.error("  ❌ Surrounding text extraction test failed:", err.message);
    process.exit(1);
  }

  // ── Live API Tests ────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("⚠️ GEMINI_API_KEY is not set in backend/.env — skipping live API calls.");
    console.log("All local parser and validation unit tests PASSED successfully!\n");
    return;
  }

  console.log("--- 2. Testing Live Gemini API Integration ---");
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`\n-------------------------------------------------`);
    console.log(`TEST ${i + 1}: "${query}"`);
    console.log(`-------------------------------------------------`);

    try {
      const result = await runIntake(query, "India");

      console.log("✅ Case Intake Succeeded!");
      console.log("  caseType:        ", result.caseType);
      console.log("  legalDomain:     ", result.legalDomain);
      console.log("  summary:         ", result.summary);
      console.log("  relevantEntities:", result.relevantEntities);
      console.log("  jurisdiction:    ", result.jurisdiction);
      console.log("  keywords:        ", result.keywords);

      const isValid =
        typeof result.caseType === "string" && result.caseType.length > 0 &&
        typeof result.legalDomain === "string" && result.legalDomain.length > 0 &&
        typeof result.summary === "string" &&
        Array.isArray(result.relevantEntities) &&
        typeof result.jurisdiction === "string" &&
        Array.isArray(result.keywords);

      if (isValid) {
        console.log("  [Live Output Schema Check]: PASSED ✓");
        passed++;
      } else {
        console.error("  [Live Output Schema Check]: FAILED ❌");
        failed++;
      }
    } catch (err) {
      console.error("❌ Live API test failed:", err.message);
      failed++;
    }
  }

  console.log("\n=================================================");
  console.log(` Live API Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
