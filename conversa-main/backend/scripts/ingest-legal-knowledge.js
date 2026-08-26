const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load env vars
dotenv.config({ path: path.join(__dirname, "../.env") });

const { resolveMongoConnection } = require("./mongoConnectionConfig.js");
const { mongoUri, dbName } = resolveMongoConnection({ allowLocalFallback: true });

const { processDocument } = require("../services/legalAdvisory/rag/documentProcessor.js");
const { embedBatch, getActiveProvider } = require("../services/legalAdvisory/rag/embeddingService.js");
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

  console.log(`Connecting to MongoDB (database: ${dbName || "[default]"})…`);
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

  const stats = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const filePath of jsonFiles) {
    const relativePath = path.relative(knowledgeDir, filePath);
    console.log(`-------------------------------------------------`);
    console.log(`Processing: ${relativePath}`);

    try {
      const rawContent = fs.readFileSync(filePath, "utf-8");
      const docObj = JSON.parse(rawContent);

      // 1. Process and chunk document
      const chunks = processDocument(docObj, relativePath);

      if (!Array.isArray(chunks) || chunks.length === 0) {
        console.log(`  -> No chunks produced. Skipping.`);
        stats.skipped++;
        continue;
      }

      console.log(`  -> Produced ${chunks.length} chunk(s).`);

      // 2. Clean up previous chunks for this source (idempotency)
      const deleted = await deleteBySource(docObj.source);
      if (deleted > 0) {
        console.log(`  -> Cleaned up ${deleted} existing chunk(s) for source "${docObj.source}".`);
        stats.updated += deleted;
      }

      // 3. Generate embeddings
      const activeProvider = getActiveProvider();
      console.log(`  -> Generating ${activeProvider.provider} (${activeProvider.model}, ${activeProvider.expectedDims} dims) vectors…`);
      const textsToEmbed = chunks.map((c) => `${c.title}. ${c.content}`);
      const embeddings = await embedBatch(textsToEmbed, { delayMs: 200 });

      // 4. Validate and attach embeddings and metadata to chunks
      const chunksWithEmbeddings = chunks.map((chunk, index) => {
        const vec = embeddings[index];
        if (!Array.isArray(vec) || vec.length !== 1024) {
          const err = new Error(
            `Invalid embedding vector for chunk "${chunk.chunkId || `chunk_${index}`}": expected 1024 numbers, got ${Array.isArray(vec) ? vec.length : typeof vec}`
          );
          err.code = "EMBEDDING_DIMENSION_INVALID";
          throw err;
        }
        return {
          ...chunk,
          embedding: vec,
          embeddingProvider: "huggingface",
          embeddingModel: activeProvider.model || "BAAI/bge-large-en-v1.5",
          embeddingDimensions: 1024,
        };
      });

      // 5. Upsert to vector store
      await upsertChunks(chunksWithEmbeddings);
      console.log(`  -> Successfully stored ${chunksWithEmbeddings.length} chunk(s) in vector store.`);

      stats.inserted += chunksWithEmbeddings.length;
      stats.processed++;
    } catch (err) {
      console.error(`  ❌ FAILED processing ${relativePath} (Source: "${docObj?.source || "unknown"}"):`, err.message);
      stats.failed++;
      throw err;
    }
  }

  console.log(`\n=================================================`);
  console.log(` Ingestion Summary`);
  console.log(`=================================================`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  const dbStats = await getStats();
  console.log("\nKnowledge Base Stats by Domain:");
  console.table(dbStats.byDomain);

  await mongoose.disconnect();
  console.log("\nDone! MongoDB connection closed.");
}

runIngestion().catch((err) => {
  console.error("Fatal error during ingestion:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
