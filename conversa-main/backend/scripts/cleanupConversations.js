const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Conversation = require("../Models/Conversation");
const User = require("../Models/User");
const { MONGO_URI } = require("../secrets");

const cleanup = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for conversation cleanup checks.\n");

    // 1. Specifically print members for conversation 6a54fb109a2cc60b63fa2ba4
    const targetId = "6a54fb109a2cc60b63fa2ba4";
    const targetConv = await Conversation.findById(targetId);
    if (targetConv) {
      console.log(`[TARGET CHECK] Conversation ${targetId} exists in database.`);
      console.log(`- Raw members array in DB:`, targetConv.members);
    } else {
      console.log(`[TARGET CHECK] Conversation ${targetId} not found in database.`);
    }
    console.log("--------------------------------------------------\n");

    const conversations = await Conversation.find().populate("members");
    const toDelete = [];

    for (const conv of conversations) {
      let isCorrupted = false;
      let reason = "";

      // We handle case where members is empty or undefined
      const rawMembers = conv.members || [];
      const distinctIds = [...new Set(rawMembers.filter(m => m !== null).map(m => m._id.toString()))];

      // Check condition: members has fewer than 2 distinct IDs
      if (distinctIds.length < 2) {
        isCorrupted = true;
        reason = "Fewer than 2 distinct members";
      }
      
      // Check condition: members contains duplicate IDs
      const rawStringIds = rawMembers.filter(m => m !== null).map(m => m._id.toString());
      if (new Set(rawStringIds).size !== rawStringIds.length || rawMembers.length !== distinctIds.length) {
        isCorrupted = true;
        reason = "Contains duplicate IDs";
      }

      // Check condition: populated receiver no longer exists (populated as null)
      if (rawMembers.some(m => m === null)) {
        isCorrupted = true;
        reason = "Populated receiver user no longer exists (deleted)";
      }

      if (isCorrupted) {
        const rawIdsOutput = rawMembers.map(m => m ? m._id.toString() : "null");
        console.log(`[CORRUPTED] Conv ID: ${conv._id} | Reason: ${reason} | Raw members in DB:`, rawIdsOutput);
        toDelete.push(conv._id);
      }
    }

    console.log("\n--------------------------------------------------");
    const shouldExecute = process.argv.includes("--execute") || process.argv.includes("cleanup");
    if (shouldExecute) {
      if (toDelete.length > 0) {
        console.log(`\nExecuting cleanup: Deleting ${toDelete.length} corrupted conversations...`);
        const result = await Conversation.deleteMany({ _id: { $in: toDelete } });
        console.log(`Successfully deleted ${result.deletedCount} conversations.`);
      } else {
        console.log("\nNo corrupted conversations to delete.");
      }
    } else {
      console.log(`\nDry run complete. Found ${toDelete.length} corrupted conversations.`);
      console.log("To delete these corrupted records, run the script with the execution flag:");
      console.log("  node backend/scripts/cleanupConversations.js --execute");
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error("Cleanup script error:", err);
    process.exit(1);
  }
};

cleanup();
