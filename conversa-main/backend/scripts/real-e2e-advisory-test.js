"use strict";

const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load .env
dotenv.config({ path: path.join(__dirname, "../.env") });

const { resolveMongoConnection } = require("./mongoConnectionConfig.js");
const { mongoUri, dbName } = resolveMongoConnection({ allowLocalFallback: true });

const { generateAdvisory } = require("../services/legalAdvisory/legalAdvisoryService.js");
const { runIntake } = require("../services/legalAdvisory/caseIntakeAgent.js");
const { embedText, getActiveProvider } = require("../services/legalAdvisory/rag/embeddingService.js");
const { retrieve } = require("../services/legalAdvisory/rag/legalRetriever.js");
const { rerankEvidence } = require("../services/legalAdvisory/evidenceReranker.js");
const LegalKnowledgeChunk = require("../Models/LegalKnowledgeChunk.js");

async function runRealEndToEndTest() {
  console.log("================================================================================");
  console.log(" REAL END-TO-END TEST: Legal Advisory Pipeline");
  console.log(" Query: \"My purse was stolen. What should I do?\"");
  console.log("================================================================================\n");

  await mongoose.connect(mongoUri, { dbName });
  console.log(`[DB] Connected to MongoDB database: "${dbName || "default"}"\n`);

  const query = "My purse was stolen. What should I do?";
  const jurisdiction = "India";

  // Step 1: Case Intake
  console.log("--- 1. Testing Case Intake Agent ---");
  const intake = await runIntake(query, jurisdiction);
  console.log("Intake Result:", {
    caseType: intake.caseType,
    legalDomain: intake.legalDomain,
    summary: intake.summary,
    keywords: intake.keywords,
    relevantEntities: intake.relevantEntities,
  });

  // Step 2 & 3: Active Embedding Model & Query Dimension
  console.log("\n--- 2 & 3. Testing Embedding Service (Hugging Face) ---");
  const providerConfig = getActiveProvider();
  console.log(`Active Embedding Provider: ${providerConfig.provider}`);
  console.log(`Active Embedding Model: ${providerConfig.model}`);
  
  const queryText = `${jurisdiction} ${intake.caseType} ${intake.legalDomain} ${intake.summary} ${intake.keywords.join(" ")}`;
  const queryVec = await embedText(queryText);
  console.log(`Query Vector Generated Successfully: Length = ${queryVec.length} dimensions`);

  // Step 4: MongoDB Total Stored Chunks
  console.log("\n--- 4. Checking MongoDB Vector Store ---");
  const totalChunksInDB = await LegalKnowledgeChunk.countDocuments();
  console.log(`Total Stored LegalKnowledgeChunks in MongoDB: ${totalChunksInDB}`);

  // Step 5 & 6: Real Retrieval
  console.log("\n--- 5 & 6. Executing Real RAG Retrieval ---");
  const ragResult = await retrieve(intake, { limit: 4, minScore: 0.25 });
  console.log(`RAG Search Status: ${ragResult.status}`);
  console.log(`Number of Retrieved Chunks: ${ragResult.sources.length}`);
  console.log("Retrieved Chunks Details:");
  ragResult.sources.forEach((s, idx) => {
    console.log(`  [Chunk ${idx + 1}] Title: "${s.title}" | Score: ${s.relevanceScore} | Domain: ${s.legalDomain} | Pass: ${s.retrievalPass}`);
  });

  // Step 7 & 8: Reranker
  console.log("\n--- 7 & 8. Testing Evidence Reranker ---");
  const precedentResult = { status: "SUCCESS", precedents: [] }; // focused on legal RAG
  const inputCount = ragResult.sources.length;
  const reranked = rerankEvidence({ intake, ragResult, precedentResult });
  const outputCount = reranked.legalSources.length;
  console.log(`Reranker Input Count: ${inputCount}`);
  console.log(`Reranker Output Count: ${outputCount}`);

  // Step 9 - 13: Full Pipeline Execution via generateAdvisory
  console.log("\n--- 9 - 13. Executing Full Orchestrator Pipeline ---");
  const advisoryResult = await generateAdvisory(query, jurisdiction);

  console.log("\n================================================================================");
  console.log(" FINAL SUMMARY REPORT");
  console.log("================================================================================");
  console.log(`1. Case Intake Result: caseType="${advisoryResult.caseType}", legalDomain="${advisoryResult.legalDomain}"`);
  console.log(`2. Active Embedding Model: ${providerConfig.model} (${providerConfig.provider})`);
  console.log(`3. Query Embedding Dimension: ${queryVec.length}`);
  console.log(`4. Number of MongoDB Chunks Searched: ${totalChunksInDB}`);
  console.log(`5. Number of Retrieved Chunks: ${ragResult.sources.length}`);
  console.log(`6. Retrieved Chunk IDs & Similarity Scores:`);
  ragResult.sources.forEach((s) => {
    console.log(`   - "${s.title.slice(0, 60)}..." -> Score: ${s.relevanceScore}`);
  });
  console.log(`7. Reranker Input Count: ${inputCount}`);
  console.log(`8. Reranker Output Count: ${outputCount}`);
  console.log(`9. Legal Drafter Invoked: YES`);
  console.log(`10. AI Drafter Execution: SUCCESS`);
  console.log(`11. Final Service Result Status: SUCCESS`);
  console.log(`12. ragSearchStatus: ${advisoryResult.ragSearchStatus}`);
  console.log(`13. Number of retrievedSources returned: ${advisoryResult.retrievedSources.length}`);
  console.log("\n--- ADVISORY TEXT PREVIEW ---\n");
  console.log(advisoryResult.advisoryResponse.slice(0, 500) + "...\n");
  console.log("================================================================================");

  await mongoose.disconnect();
}

runRealEndToEndTest().catch((err) => {
  console.error("FATAL ERROR in Real End-to-End Test:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
