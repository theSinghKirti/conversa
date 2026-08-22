const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { MONGO_URI, MONGO_DB_NAME } = process.env;

const { generateAdvisory } = require("../services/legalAdvisory/legalAdvisoryService.js");

const TEST_QUERIES = [
  "My landlord is demanding more rent than agreed in my rental agreement.",
  "My employer terminated me without notice.",
  "I was cheated in an online transaction and lost money.",
];

async function runE2ETests() {
  console.log("=================================================");
  console.log(" Legal Advisory Pipeline End-to-End Test Suite");
  console.log("=================================================\n");

  const mongoUri = MONGO_URI || "mongodb://localhost:27017/";
  const dbName = MONGO_DB_NAME || "conversa";

  console.log(`Connecting to MongoDB at ${mongoUri} (${dbName})…`);
  await mongoose.connect(mongoUri, { dbName });
  console.log("Connected to MongoDB successfully.\n");

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`=================================================`);
    console.log(`E2E TEST ${i + 1}: "${query}"`);
    console.log(`=================================================`);

    try {
      const result = await generateAdvisory(query, "India");

      console.log("\n📊 E2E TEST RESULT SUMMARY:");
      console.log("-------------------------------------------------");
      console.log(`- Case Type:                 "${result.caseType}"`);
      console.log(`- Legal Domain:              "${result.legalDomain}"`);
      console.log(`- RAG Search Status:          "${result.ragSearchStatus}"`);
      console.log(`- RAG Documents Retrieved:    ${result.retrievedSources.length}`);
      result.retrievedSources.forEach((src, idx) => {
        console.log(`   [RAG ${idx + 1}] "${src.title}" (${src.source}) - score ${src.relevanceScore}`);
      });

      console.log(`- Precedent Search Status:    "${result.precedentSearchStatus}"`);
      console.log(`- Precedents Returned:        ${result.precedents.length}`);
      result.precedents.forEach((p, idx) => {
        console.log(`   [Precedent ${idx + 1}] "${p.caseName}" (${p.court}, ${p.dateOrYear})`);
      });

      console.log(`- Issue Identified Present:   ${!!result.issueIdentified}`);
      console.log(`- Next Steps Count:           ${result.possibleNextSteps.length}`);
      console.log(`- Documents to Gather Count:  ${result.documentsToGather.length}`);
      console.log("-------------------------------------------------\n");
    } catch (err) {
      console.error(`❌ E2E TEST ${i + 1} FAILED:`, err.message);
    }
  }

  await mongoose.disconnect();
  console.log("=================================================");
  console.log(" E2E Test Suite Execution Complete.");
  console.log("=================================================");
}

runE2ETests().catch((err) => {
  console.error("Fatal error during E2E test:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
