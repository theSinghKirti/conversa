const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

const { MONGO_URI, MONGO_DB_NAME } = process.env;

const { processDocument } = require("../services/legalAdvisory/rag/documentProcessor.js");
const { embedBatch } = require("../services/legalAdvisory/rag/embeddingService.js");
const { upsertChunks, deleteBySource, getStats } = require("../services/legalAdvisory/rag/vectorStore.js");

/**
 * Recursively find all .json files in a directory.
 */
function findJsonFiles(dirPath) {
  let files = [];
  if (!fs.existsSync(dirPath)) return files;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      files = files.concat(findJsonFiles(fullPath));
    } else if (item.isFile() && item.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function runIngestion() {
  console.log("=================================================");
  console.log(" Legal Knowledge RAG Ingestion Script");
  console.log("=================================================\n");

  const mongoUri = MONGO_URI || "mongodb://localhost:27017/";
  const dbName = MONGO_DB_NAME || "conversa";

  console.log(`Connecting to MongoDB at ${mongoUri} (${dbName})…`);
  await mongoose.connect(mongoUri, { dbName });
  console.log("Connected to MongoDB successfully.\n");

  const knowledgeDir = path.join(__dirname, "../data/legal-knowledge");
  const jsonFiles = findJsonFiles(knowledgeDir);

  if (jsonFiles.length === 0) {
    console.log(`No .json files found in ${knowledgeDir}. Exiting.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${jsonFiles.length} legal knowledge document(s) to process:\n`);

  let totalChunksIngested = 0;
  let totalDocsProcessed = 0;

  for (const filePath of jsonFiles) {
    const relativePath = path.relative(knowledgeDir, filePath);
    console.log(`-------------------------------------------------`);
    console.log(`Processing: ${relativePath}`);

    try {
      const rawContent = fs.readFileSync(filePath, "utf-8");
      const docObj = JSON.parse(rawContent);

      // 1. Process and chunk document
      const chunks = processDocument(docObj, relativePath);
      console.log(`  -> Produced ${chunks.length} chunk(s).`);

      // 2. Clean up previous chunks for this source (idempotency)
      const deleted = await deleteBySource(docObj.source);
      if (deleted > 0) {
        console.log(`  -> Cleaned up ${deleted} existing chunk(s) for source "${docObj.source}".`);
      }

      // 3. Generate embeddings
      console.log(`  -> Generating text-embedding-004 vectors (with 200ms rate-limiting delay)…`);
      const textsToEmbed = chunks.map((c) => `${c.title}. ${c.content}`);
      const embeddings = await embedBatch(textsToEmbed, { delayMs: 200 });

      // 4. Attach embeddings to chunks
      const chunksWithEmbeddings = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      }));

      // 5. Upsert to vector store
      await upsertChunks(chunksWithEmbeddings);
      console.log(`  -> Successfully stored ${chunksWithEmbeddings.length} chunk(s) in vector store.`);

      totalChunksIngested += chunksWithEmbeddings.length;
      totalDocsProcessed++;
    } catch (err) {
      console.error(`  ❌ FAILED processing ${relativePath}:`, err.message);
    }
  }

  console.log(`\n=================================================`);
  console.log(` Ingestion Summary`);
  console.log(`=================================================`);
  console.log(`Documents Processed: ${totalDocsProcessed} / ${jsonFiles.length}`);
  console.log(`Total Chunks Stored: ${totalChunksIngested}`);

  const stats = await getStats();
  console.log("\nKnowledge Base Stats by Domain:");
  console.table(stats.byDomain);

  await mongoose.disconnect();
  console.log("\nDone! MongoDB connection closed.");
}

runIngestion().catch((err) => {
  console.error("Fatal error during ingestion:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
