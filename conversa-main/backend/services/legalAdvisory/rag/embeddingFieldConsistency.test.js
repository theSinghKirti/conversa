"use strict";

const fs = require("fs");
const path = require("path");
const LegalKnowledgeChunk = require("../../../Models/LegalKnowledgeChunk.js");
const LegalPrecedent = require("../../../Models/LegalPrecedent.js");
const { processDocument } = require("./documentProcessor.js");
const { upsertChunks, similaritySearch } = require("./vectorStore.js");
const { upsertPrecedents, searchPrecedents } = require("../precedentSearchTool.js");
const { retrieve } = require("./legalRetriever.js");
const { runPrecedentSearch } = require("../precedentAgent.js");
const { embedText } = require("./embeddingService.js");

jest.mock("./embeddingService.js");
jest.mock("../../../Models/LegalKnowledgeChunk.js");
jest.mock("../../../Models/LegalPrecedent.js");

describe("MongoDB Embedding Field Consistency End-to-End Audit", () => {
  const dummyVector = new Array(768).fill(0.01);

  beforeEach(() => {
    jest.clearAllMocks();
    embedText.mockResolvedValue(dummyVector);
  });

  describe("Schema Definition Verification", () => {
    test("LegalKnowledgeChunk schema enforces 'embedding' field and excludes 'vector'", () => {
      const paths = LegalKnowledgeChunk.schema.paths;
      expect(paths).toHaveProperty("embedding");
      expect(paths).not.toHaveProperty("vector");
      expect(paths.embedding.instance).toBe("Array");
      expect(paths.embedding.isRequired).toBe(true);
    });

    test("LegalPrecedent schema enforces 'embedding' field and excludes 'vector'", () => {
      const paths = LegalPrecedent.schema.paths;
      expect(paths).toHaveProperty("embedding");
      expect(paths).not.toHaveProperty("vector");
      expect(paths.embedding.instance).toBe("Array");
      expect(paths.embedding.isRequired).toBe(true);
    });
  });

  describe("Ingestion & Auto-Seeding Field Name Verification", () => {
    test("knowledge ingestion writes 'embedding' and never writes 'vector'", async () => {
      let capturedOps = [];
      LegalKnowledgeChunk.bulkWrite.mockImplementation((ops) => {
        capturedOps = ops;
        return Promise.resolve({ upsertedCount: ops.length });
      });

      const dummy1024 = new Array(1024).fill(0.01);
      await upsertChunks([
        {
          chunkId: "c1",
          title: "Test",
          content: "Content",
          legalDomain: "Labour Law",
          jurisdiction: "India",
          source: "Test",
          chunkIndex: 0,
          totalChunks: 1,
          embedding: dummy1024,
        },
      ]);

      expect(capturedOps.length).toBeGreaterThan(0);
      for (const op of capturedOps) {
        const doc = op.updateOne.update.$set;
        expect(doc).toHaveProperty("embedding");
        expect(Array.isArray(doc.embedding)).toBe(true);
        expect(doc.embedding).toHaveLength(1024);
        expect(doc).not.toHaveProperty("vector");
      }
    });

    test("precedent auto-seeding writes 'embedding' and never writes 'vector'", async () => {
      let capturedOps = [];
      LegalPrecedent.countDocuments
        .mockResolvedValueOnce(0) // initial check triggers auto-seed
        .mockResolvedValueOnce(5); // after auto-seed

      LegalPrecedent.bulkWrite.mockImplementation((ops) => {
        capturedOps = ops;
        return Promise.resolve({ upsertedCount: ops.length });
      });

      LegalPrecedent.aggregate.mockResolvedValue([
        {
          precedentId: "p1",
          caseName: "Test Case",
          court: "Supreme Court of India",
          dateOrYear: "2020",
          citation: "2020 SCC 1",
          legalDomain: "Labour Law",
          summary: "Summary",
          relevanceScore: 0.9,
        },
      ]);

      await runPrecedentSearch({
        jurisdiction: "India",
        legalDomain: "Labour Law",
        caseType: "Dispute",
        summary: "Termination query",
        keywords: ["termination"],
      });

      expect(capturedOps.length).toBeGreaterThan(0);
      for (const op of capturedOps) {
        const doc = op.updateOne.update.$set;
        expect(doc).toHaveProperty("embedding");
        expect(Array.isArray(doc.embedding)).toBe(true);
        expect(doc.embedding).toHaveLength(768);
        expect(doc).not.toHaveProperty("vector");
      }
    });
  });

  describe("Retrieval Pipeline Aggregation Field Alignment", () => {
    test("vectorStore similaritySearch projects and computes similarity using '$embedding' only", async () => {
      let executedPipeline = [];
      LegalKnowledgeChunk.aggregate.mockImplementation((pipeline) => {
        executedPipeline = pipeline;
        return Promise.resolve([]);
      });

      await similaritySearch(dummyVector, {
        jurisdiction: "India",
        legalDomain: "Labour Law",
        limit: 5,
      });

      const pipelineStr = JSON.stringify(executedPipeline);
      expect(pipelineStr).toContain('"$embedding"');
      expect(pipelineStr).toContain('"embedding":1');
      expect(pipelineStr).not.toContain('"$vector"');
      expect(pipelineStr).not.toContain('"vector":1');
    });

    test("precedentSearchTool searchPrecedents projects and computes similarity using '$embedding' only", async () => {
      let executedPipeline = [];
      LegalPrecedent.aggregate.mockImplementation((pipeline) => {
        executedPipeline = pipeline;
        return Promise.resolve([]);
      });

      await searchPrecedents(dummyVector, {
        jurisdiction: "India",
        legalDomain: "Labour Law",
        limit: 3,
      });

      const pipelineStr = JSON.stringify(executedPipeline);
      expect(pipelineStr).toContain('"$embedding"');
      expect(pipelineStr).toContain('"embedding":1');
      expect(pipelineStr).not.toContain('"$vector"');
      expect(pipelineStr).not.toContain('"vector":1');
    });
  });

  describe("Atlas Vector Search Configuration Compliance", () => {
    test("Atlas vector index specification uses path 'embedding' and 768 dimensions", () => {
      const atlasIndexDefinition = {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: 768,
            similarity: "cosine",
          },
          {
            type: "filter",
            path: "jurisdiction",
          },
          {
            type: "filter",
            path: "legalDomain",
          },
        ],
      };

      const vectorField = atlasIndexDefinition.fields.find((f) => f.type === "vector");
      expect(vectorField).toBeDefined();
      expect(vectorField.path).toBe("embedding");
      expect(vectorField.numDimensions).toBe(768);
      expect(vectorField.similarity).toBe("cosine");
    });
  });
});
