const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const { resolveMongoConnection } = require("./mongoConnectionConfig.js");
const { mongoUri, dbName } = resolveMongoConnection({ allowLocalFallback: true });

const { embedBatch } = require("../services/legalAdvisory/rag/embeddingService.js");
const { upsertPrecedents } = require("../services/legalAdvisory/precedentSearchTool.js");

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

async function runPrecedentIngestion() {
  console.log("=================================================");
  console.log(" Legal Precedent Ingestion Script");
  console.log("=================================================\n");

  console.log(`Connecting to MongoDB (database: ${dbName || "[default]"})…`);
  await mongoose.connect(mongoUri, { dbName });
  console.log("Connected to MongoDB successfully.\n");

  const precedentsDir = path.join(__dirname, "../data/legal-precedents");
  const jsonFiles = findJsonFiles(precedentsDir);

  if (jsonFiles.length === 0) {
    console.log(`No precedent .json files found in ${precedentsDir}. Exiting.`);
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${jsonFiles.length} precedent file(s) to process:\n`);

  const stats = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const filePath of jsonFiles) {
    const relativePath = path.relative(precedentsDir, filePath);
    console.log(`-------------------------------------------------`);
    console.log(`Processing: ${relativePath}`);

    try {
      const rawContent = fs.readFileSync(filePath, "utf-8");
      const precedentsArray = JSON.parse(rawContent);

      if (!Array.isArray(precedentsArray) || precedentsArray.length === 0) {
        console.log(`  -> File is empty or not an array. Skipping.`);
        stats.skipped++;
        continue;
      }

      console.log(`  -> Found ${precedentsArray.length} precedent(s). Generating text-embedding-004 vectors…`);

      const textsToEmbed = precedentsArray.map(
        (p) => `${p.caseName}. ${p.court} (${p.dateOrYear}). Domain: ${p.legalDomain}. Summary: ${p.summary} ${p.keyHoldings}`
      );

      const embeddings = await embedBatch(textsToEmbed, { delayMs: 200 });

      const precedentsWithEmbeddings = precedentsArray.map((p, idx) => ({
        ...p,
        embedding: embeddings[idx],
      }));

      const writeResult = await upsertPrecedents(precedentsWithEmbeddings);
      console.log(`  -> Successfully upserted ${precedentsWithEmbeddings.length} precedent(s) to vector store.`);

      stats.inserted += Number(writeResult?.upsertedCount || 0);
      stats.updated += Number(writeResult?.modifiedCount || 0);
      stats.processed++;
    } catch (err) {
      console.error(`  ❌ FAILED processing ${relativePath}:`, err.message);
      stats.failed++;
    }
  }

  console.log(`\n=================================================`);
  console.log(` Precedent Ingestion Complete`);
  console.log(`=================================================`);
  console.log(`Processed: ${stats.processed}`);
  console.log(`Inserted: ${stats.inserted}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  await mongoose.disconnect();
  console.log("\nDone! MongoDB connection closed.");
}

runPrecedentIngestion().catch((err) => {
  console.error("Fatal error during precedent ingestion:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
