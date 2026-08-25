function resolveMongoConnection({ allowLocalFallback = false } = {}) {
  const mongoUri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;

  if (process.env.NODE_ENV === "production") {
    if (!mongoUri) {
      throw new Error("MONGO_URI is required for production ingestion.");
    }
    if (!dbName) {
      throw new Error("MONGO_DB_NAME is required for production ingestion.");
    }

    return { mongoUri, dbName };
  }

  if (mongoUri) {
    return { mongoUri, dbName: dbName || undefined };
  }

  if (allowLocalFallback && process.env.NODE_ENV !== "production") {
    return {
      mongoUri: "mongodb://localhost:27017/",
      dbName: dbName || "conversa",
    };
  }

  throw new Error("MONGO_URI is required for this command.");
}

module.exports = { resolveMongoConnection };
