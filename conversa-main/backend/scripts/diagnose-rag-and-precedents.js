const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { MONGO_URI, MONGO_DB_NAME, GEMINI_API_KEY } = process.env;

const LegalKnowledgeChunk = require("../Models/LegalKnowledgeChunk.js");
const LegalPrecedent = require("../Models/LegalPrecedent.js");
const { embedText } = require("../services/legalAdvisory/rag/embeddingService.js");
const { similaritySearch: searchKnowledge } = require("../services/legalAdvisory/rag/vectorStore.js");
const { searchPrecedents } = require("../services/legalAdvisory/precedentSearchTool.js");

async function diagnose() {
  console.log("=================================================");
  console.log(" Legal Advisory Pipeline Diagnostic Utility");
  console.log("=================================================\n");

  const mongoUri = MONGO_URI || "mongodb://localhost:27017/";
  const dbName = MONGO_DB_NAME || "conversa";

  console.log(`1. DATABASE CONNECTION`);
  console.log(`   Connecting to ${mongoUri} (DB: ${dbName})…`);

  try {
    await mongoose.connect(mongoUri, { dbName });
    console.log("   ✅ MongoDB connection successful.\n");
  } catch (err) {
    console.error("   ❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }

  // 2. VECTOR STORE COUNTS
  console.log(`2. STORE POPULATION CHECK`);
  const knowledgeCount = await LegalKnowledgeChunk.countDocuments();
  const precedentCount = await LegalPrecedent.countDocuments();

  console.log(`   - LegalKnowledgeChunk count: ${knowledgeCount}`);
  console.log(`   - LegalPrecedent count:      ${precedentCount}`);

  if (knowledgeCount === 0) {
    console.log("   ⚠️ LegalKnowledgeChunk is EMPTY in MongoDB!");
  } else {
    const domains = await LegalKnowledgeChunk.distinct("legalDomain");
    console.log(`   - Knowledge Domains present: [${domains.join(", ")}]`);
  }

  if (precedentCount === 0) {
    console.log("   ⚠️ LegalPrecedent is EMPTY in MongoDB!");
  } else {
    const pDomains = await LegalPrecedent.distinct("legalDomain");
    console.log(`   - Precedent Domains present: [${pDomains.join(", ")}]`);
  }
  console.log("");

  // 3. GEMINI EMBEDDING & SEARCH DIAGNOSTICS
  console.log(`3. GEMINI API KEY & EMBEDDING CHECK`);
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
  if (!apiKey) {
    console.log("   ❌ GEMINI_API_KEY is NOT set in environment!");
  } else {
    console.log("   ✅ GEMINI_API_KEY is present.");
    try {
      console.log("   Testing embedText('test embedding query')…");
      const testVec = await embedText("test embedding query");
      console.log(`   ✅ Embedding generated successfully (dimensions: ${testVec.length}).\n`);

      // 4. SAMPLE SIMILARITY SEARCH IF STORES HAVE DATA
      if (knowledgeCount > 0) {
        console.log("4. SAMPLE RAG KNOWLEDGE SEARCH TEST");
        const query = "My landlord is demanding more rent than agreed";
        console.log(`   Query: "${query}"`);
        const qVec = await embedText(query);
        const kResults = await searchKnowledge(qVec, { limit: 3, minScore: 0.2 });
        console.log(`   Results returned: ${kResults.length}`);
        kResults.forEach((r, i) => {
          console.log(`   [${i + 1}] Title: "${r.title}" | Domain: ${r.legalDomain} | Score: ${r.relevanceScore}`);
        });
        console.log("");
      }

      if (precedentCount > 0) {
        console.log("5. SAMPLE PRECEDENT SEARCH TEST");
        const pQuery = "tenant landlord rent security deposit agreement";
        console.log(`   Query: "${pQuery}"`);
        const pVec = await embedText(pQuery);
        const pResults = await searchPrecedents(pVec, { limit: 3, minScore: 0.2 });
        console.log(`   Results returned: ${pResults.length}`);
        pResults.forEach((r, i) => {
          console.log(`   [${i + 1}] Case: "${r.caseName}" (${r.court}, ${r.dateOrYear}) | Score: ${r.relevanceScore}`);
        });
        console.log("");
      }
    } catch (err) {
      console.error("   ❌ Embedding / Search failed:", err.message);
    }
  }

  await mongoose.disconnect();
  console.log("=================================================");
  console.log(" Diagnostic Check Complete.");
  console.log("=================================================");
}

diagnose().catch((err) => {
  console.error("Fatal error during diagnostic:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
