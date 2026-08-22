const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { MONGO_URI, MONGO_DB_NAME } = process.env;

const LegalKnowledgeChunk = require("../Models/LegalKnowledgeChunk.js");
const LegalPrecedent = require("../Models/LegalPrecedent.js");
const { retrieve } = require("../services/legalAdvisory/rag/legalRetriever.js");
const { runPrecedentSearch } = require("../services/legalAdvisory/precedentAgent.js");

const testCases = [
  {
    name: "THEFT (Criminal Law)",
    header: "=== TEST 1: THEFT ===",
    intake: {
      jurisdiction: "India",
      legalDomain: "Criminal Law",
      caseType: "Theft",
      summary: "My purse was stolen from my office",
      keywords: ["purse", "stolen", "theft", "office"],
    },
  },
  {
    name: "TENANT-LANDLORD (Rent Dispute)",
    header: "=== TEST 2: TENANT-LANDLORD ===",
    intake: {
      jurisdiction: "India",
      legalDomain: "Tenant-Landlord Law",
      caseType: "Rent Dispute",
      summary: "My landlord is demanding more rent than agreed",
      keywords: ["landlord", "tenant", "rent", "agreement"],
    },
  },
  {
    name: "LABOUR LAW (Wrongful Termination)",
    header: "=== TEST 3: LABOUR LAW ===",
    intake: {
      jurisdiction: "India",
      legalDomain: "Labour Law",
      caseType: "Wrongful Termination",
      summary: "My employer terminated me without notice",
      keywords: ["employer", "termination", "notice", "employment"],
    },
  },
  {
    name: "UNRELATED QUERY (Generic / Pizza)",
    header: "=== TEST 4: UNRELATED QUERY ===",
    intake: {
      jurisdiction: "India",
      legalDomain: "Unknown",
      caseType: "Generic",
      summary: "What is the capital of France and how to make pizza",
      keywords: ["France", "pizza"],
    },
  },
];

async function verifyLegalPipeline() {
  console.log("=================================================");
  console.log(" Legal Advisory Pipeline Verification Utility");
  console.log("=================================================\n");

  const mongoUri = MONGO_URI || "mongodb://localhost:27017/";
  const dbName = MONGO_DB_NAME || "conversa";

  try {
    await mongoose.connect(mongoUri, { dbName });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }

  // 1. Database State Check
  const knowledgeCount = await LegalKnowledgeChunk.countDocuments();
  const precedentCount = await LegalPrecedent.countDocuments();

  console.log("=== DATABASE ===");
  console.log(`Legal Knowledge Chunks: ${knowledgeCount}`);
  console.log(`Legal Precedents: ${precedentCount}`);
  console.log("");

  // 2. Structured Test Suite Execution
  for (const tc of testCases) {
    console.log(tc.header);

    // Test Legal Knowledge RAG Retrieval
    const ragResult = await retrieve(tc.intake, { limit: 5 });
    console.log(`RAG: ${ragResult.status}`);
    console.log(`Sources: ${ragResult.sources.length}`);
    if (ragResult.sources.length > 0) {
      console.log(`Pass Used: ${ragResult.sources[0].retrievalPass}`);
      ragResult.sources.forEach((s, idx) => {
        console.log(`  - [Source ${idx + 1}] "${s.title}" (Score: ${s.relevanceScore}, Domain: ${s.legalDomain})`);
      });
    }

    // Test Precedent Search
    const precedentResult = await runPrecedentSearch(tc.intake, ragResult.sources, tc.intake.jurisdiction);
    console.log(`Precedents: ${precedentResult.status}`);
    console.log(`Precedents Found: ${precedentResult.precedents.length}`);
    if (precedentResult.precedents.length > 0) {
      console.log(`Pass Used: ${precedentResult.precedents[0].retrievalPass}`);
      precedentResult.precedents.forEach((p, idx) => {
        console.log(`  - [Precedent ${idx + 1}] "${p.caseName}" (${p.court}, ${p.citation}) (Score: ${p.relevanceScore})`);
      });
    }

    console.log("");
  }

  console.log("=================================================");
  console.log(" Verification Complete: All 4 Tests Finished");
  console.log("=================================================");

  await mongoose.disconnect();
}

verifyLegalPipeline().catch((err) => {
  console.error("Fatal error during verification:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
