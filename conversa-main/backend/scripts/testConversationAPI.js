const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { createConversation } = require("../Controllers/conversation-controller");
const User = require("../Models/User");
const Conversation = require("../Models/Conversation");
const { MONGO_URI } = require("../secrets");

const runTests = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to database for tests.\n");

    // Clean up past test users
    await User.deleteMany({ email: { $in: ["test.usera@conversa.local", "test.userb@conversa.local", "test.userc@conversa.local"] } });
    
    // Create test users
    const userA = await User.create({
      name: "User A",
      email: "test.usera@conversa.local",
      password: "password123",
      accountStatus: "ACTIVE",
      isEmailVerified: true
    });

    const userB = await User.create({
      name: "User B",
      email: "test.userb@conversa.local",
      password: "password123",
      accountStatus: "ACTIVE",
      isEmailVerified: true
    });

    const inactiveUser = await User.create({
      name: "Inactive User",
      email: "test.userc@conversa.local",
      password: "password123",
      accountStatus: "SUSPENDED",
      isEmailVerified: true
    });

    console.log("Created test users User A, User B (ACTIVE) and Inactive User (SUSPENDED).");

    // Helper to mock request/response
    const mockRes = () => {
      const res = {};
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.jsonData = data;
        return res;
      };
      res.send = (data) => {
        res.sendData = data;
        return res;
      };
      return res;
    };

    let testCount = 0;
    let passCount = 0;

    const assert = (condition, message) => {
      testCount++;
      if (condition) {
        passCount++;
        console.log(`PASS: ${message}`);
      } else {
        console.error(`FAIL: ${message}`);
      }
    };

    // 1. self-conversation rejected
    {
      const req = {
        user: { id: userA._id.toString() },
        body: { receiverId: userA._id.toString() }
      };
      const res = mockRes();
      await createConversation(req, res);
      assert(
        res.statusCode === 400 && res.jsonData.error === "You cannot start a conversation with yourself.",
        "Self-conversation rejected with HTTP 400"
      );
    }

    // 2. missing receiver rejected
    {
      const req = {
        user: { id: userA._id.toString() },
        body: {}
      };
      const res = mockRes();
      await createConversation(req, res);
      assert(
        res.statusCode === 400 && res.jsonData.error === "Receiver ID is required",
        "Missing receiver ID rejected with HTTP 400"
      );
    }

    // 3. nonexistent receiver rejected
    {
      const req = {
        user: { id: userA._id.toString() },
        body: { receiverId: new mongoose.Types.ObjectId().toString() }
      };
      const res = mockRes();
      await createConversation(req, res);
      assert(
        res.statusCode === 404 && res.jsonData.error === "Receiver user not found or is inactive",
        "Nonexistent receiver rejected with HTTP 404"
      );
    }

    // 4. inactive receiver rejected
    {
      const req = {
        user: { id: userA._id.toString() },
        body: { receiverId: inactiveUser._id.toString() }
      };
      const res = mockRes();
      await createConversation(req, res);
      assert(
        res.statusCode === 404 && res.jsonData.error === "Receiver user not found or is inactive",
        "Inactive receiver rejected with HTTP 404"
      );
    }

    // 5. valid two-user conversation created
    let firstConvId;
    {
      const req = {
        user: { id: userA._id.toString() },
        body: { receiverId: userB._id.toString() }
      };
      const res = mockRes();
      await createConversation(req, res);
      if (res.statusCode === 200 && res.jsonData._id) {
        firstConvId = res.jsonData._id;
      }
      assert(
        res.statusCode === 200 && firstConvId,
        "Valid two-user conversation created successfully"
      );
    }

    // 6. existing conversation reused
    {
      const req = {
        user: { id: userA._id.toString() },
        body: { receiverId: userB._id.toString() }
      };
      const res = mockRes();
      await createConversation(req, res);
      assert(
        res.statusCode === 200 && res.jsonData._id.toString() === firstConvId.toString(),
        "Existing conversation reused instead of creating duplicate"
      );
    }

    // 7. Duplicate IDs rejected at Mongoose validator level
    try {
      await Conversation.create({
        members: [userA._id, userA._id],
        unreadCounts: [
          { userId: userA._id, count: 0 },
          { userId: userA._id, count: 0 }
        ]
      });
      assert(false, "Schema-level duplicate members validator failed");
    } catch (validationError) {
      assert(
        validationError.errors && validationError.errors.members,
        "Database-safe schema guard blocks duplicate member ID creation"
      );
    }

    // Clean up test data
    console.log("\nCleaning up test users and created conversations...");
    await User.deleteMany({ email: { $in: ["test.usera@conversa.local", "test.userb@conversa.local", "test.userc@conversa.local"] } });
    if (firstConvId) {
      await Conversation.deleteOne({ _id: firstConvId });
    }

    await mongoose.connection.close();
    console.log(`\nTest Execution Complete: ${passCount}/${testCount} assertions passed.`);
    if (passCount !== testCount) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
};

runTests();
