const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { MONGO_URI, MONGO_DB_NAME } = process.env;
const LegalKnowledgeChunk = require("../Models/LegalKnowledgeChunk.js");
const LegalPrecedent = require("../Models/LegalPrecedent.js");
const { embedText } = require("../services/legalAdvisory/rag/embeddingService.js");
const { similaritySearch } = require("../services/legalAdvisory/rag/vectorStore.js");
const { searchPrecedents } = require("../services/legalAdvisory/precedentSearchTool.js");

async function testAggregation() {
  console.log("=================================================");
  console.log(" Direct Vector Aggregation Diagnostic Test");
  console.log("=================================================\n");

  const mongoUri = MONGO_URI || "mongodb://localhost:27017/";
  const dbName = MONGO_DB_NAME || "conversa";

  await mongoose.connect(mongoUri, { dbName });
  console.log(`Connected to MongoDB (${dbName}).`);

  const kCount = await LegalKnowledgeChunk.countDocuments();
  const pCount = await LegalPrecedent.countDocuments();

  console.log(`Store Counts: LegalKnowledgeChunk=${kCount}, LegalPrecedent=${pCount}\n`);

  const testQuery = "My landlord is demanding more rent than agreed";
  console.log(`Query text: "${testQuery}"`);

  const vec = await embedText(testQuery);
  console.log(`Generated embedding vector length: ${vec.length}`);

  // Test raw aggregation pipeline without minScore filter
  console.log("\n--- RAW RAG AGGREGATION TEST (minScore: 0.0) ---");
  try {
    const rawKnowledge = await similaritySearch(vec, { limit: 5, minScore: 0.0 });
    console.log(`Raw Knowledge results count: ${rawKnowledge.length}`);
    rawKnowledge.forEach((item, idx) => {
      console.log(`  [${idx + 1}] score=${item.relevanceScore} | domain=${item.legalDomain} | title="${item.title}"`);
    });
  } catch (err) {
    console.error("❌ Raw Knowledge aggregation failed:", err);
  }

  console.log("\n--- RAW PRECEDENT AGGREGATION TEST (minScore: 0.0) ---");
  try {
    const rawPrecedents = await searchPrecedents(vec, { limit: 5, minScore: 0.0 });
    console.log(`Raw Precedent results count: ${rawPrecedents.length}`);
    rawPrecedents.forEach((item, idx) => {
      console.log(`  [${idx + 1}] score=${item.relevanceScore} | domain=${item.legalDomain} | case="${item.caseName}"`);
    });
  } catch (err) {
    console.error("❌ Raw Precedent aggregation failed:", err.message);
  }

  await mongoose.disconnect();
  console.log("\n=================================================");
  console.log(" Diagnostic Test Complete.");
  console.log("=================================================");
}

testAggregation().catch(console.error);
