const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MONGO_URI, MONGO_DB_NAME } = require("../secrets.js");
const MembershipApplication = require("../Models/MembershipApplication.js");
const User = require("../Models/User.js");
const Conversation = require("../Models/Conversation.js");

const BASE_URL = "http://localhost:5500";

async function main() {
  console.log("=== STARTING INTEGRATION & STABILIZATION TEST ===");

  // 1. Connect to Database and Clean Up previous test data
  console.log("Connecting to DB...");
  await mongoose.connect(MONGO_URI, { dbName: MONGO_DB_NAME });
  console.log("Connected. Cleaning up old test data...");

  const testEmail = "audit.integration@example.com";
  const testPhone = "9988776655";

  await MembershipApplication.deleteMany({ email: testEmail });
  await User.deleteMany({ email: { $in: [testEmail, testEmail + "bot"] } });
  
  // Clean up any conversations involving test email prefix
  // Since we deleted the users, we will also clean up conversations that refer to them
  console.log("Cleanup finished.");

  // 2. Submit Membership Application
  console.log("\n--- Step 1: Submitting Membership Application ---");
  const applyPayload = {
    name: "Audit Integration User",
    email: testEmail,
    phone: testPhone,
    city: "Bengaluru",
    state: "Karnataka",
    occupation: "Integration Engineer",
    organisation: "Google DeepMind",
    education: "Master of Science",
    bloodGroup: "O+",
    communityDetails: "Integration stabilization test run.",
    consentAccepted: true,
  };

  const applyRes = await fetch(`${BASE_URL}/application/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(applyPayload),
  });

  const applyData = await applyRes.json();
  console.log("Apply Status:", applyRes.status);
  console.log("Apply Response:", applyData);

  if (applyRes.status !== 201 || !applyData.success) {
    throw new Error("Application submission failed");
  }

  const applicationId = applyData.application.applicationId;
  console.log("Generated Application ID:", applicationId);

  // 3. Login as Admin
  console.log("\n--- Step 2: Login as Admin ---");
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@conversa.dev",
      password: "Admin@1234!",
    }),
  });

  const adminLoginData = await adminLoginRes.json();
  console.log("Admin Login Status:", adminLoginRes.status);
  if (adminLoginRes.status !== 200 || !adminLoginData.authtoken) {
    throw new Error("Admin login failed");
  }
  const adminToken = adminLoginData.authtoken;
  console.log("Admin Logged In successfully.");

  // 4. Approve Application
  console.log("\n--- Step 3: Admin Approves Application ---");
  const approveRes = await fetch(`${BASE_URL}/admin/applications/${applicationId}/approve`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "auth-token": adminToken,
    },
  });

  const approveData = await approveRes.json();
  console.log("Approve Status:", approveRes.status);
  console.log("Approve Response:", approveData);

  if (approveRes.status !== 200 || !approveData.success) {
    throw new Error("Approve application failed");
  }

  const memberId = approveData.application.memberId;
  console.log("Generated Member ID:", memberId);

  // 5. Request Activation OTP
  console.log("\n--- Step 4: Request Activation OTP ---");
  const otpReqRes = await fetch(`${BASE_URL}/activation/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId,
      email: testEmail,
    }),
  });

  const otpReqData = await otpReqRes.json();
  console.log("OTP Request Status:", otpReqRes.status);
  console.log("OTP Request Response:", otpReqData);

  if (otpReqRes.status !== 200 || !otpReqData.success) {
    throw new Error("OTP request failed");
  }

  // 6. Force-set OTP in database to bypass Nodemailer
  console.log("\n--- Step 5: Injecting known OTP to database ---");
  const knownOtp = "777888";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(knownOtp, salt);

  await MembershipApplication.updateOne(
    { applicationId },
    {
      activationOtpHash: hash,
      activationOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      activationOtpAttempts: 0,
    }
  );
  console.log("OTP hash injected into application document.");

  // 7. Verify OTP to Activate Account
  console.log("\n--- Step 6: Verifying OTP to Activate ---");
  const verifyRes = await fetch(`${BASE_URL}/activation/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      memberId,
      email: testEmail,
      otp: knownOtp,
    }),
  });

  const verifyData = await verifyRes.json();
  console.log("Verify OTP Status:", verifyRes.status);
  console.log("Verify OTP Response:", verifyData);

  if (verifyRes.status !== 200 || !verifyData.success) {
    throw new Error("Verification failed");
  }

  const memberToken = verifyData.authtoken;
  const activatedUserId = verifyData.user._id;

  // 8. Verify User & Bot Conversation exists in Database
  console.log("\n--- Step 7: Verifying user & AI bot conversation ---");
  const dbUser = await User.findById(activatedUserId).lean();
  console.log("Database User details:");
  console.log("  Name:", dbUser.name);
  console.log("  Role:", dbUser.role);
  console.log("  Account Status:", dbUser.accountStatus);
  console.log("  Auth Method:", dbUser.authMethod);
  console.log("  City:", dbUser.city);
  console.log("  Occupation:", dbUser.occupation);

  if (!dbUser || dbUser.role !== "MEMBER" || dbUser.accountStatus !== "ACTIVE") {
    throw new Error("Activated user details mismatch in DB");
  }

  const dbBot = await User.findOne({ email: testEmail + "bot", isBot: true }).lean();
  console.log("AI Bot Created:", !!dbBot);
  if (!dbBot) {
    throw new Error("AI Bot was not created");
  }

  const conversationCount = await Conversation.countDocuments({
    members: { $all: [dbUser._id, dbBot._id] },
  });
  console.log("Bot Conversation Count:", conversationCount);
  if (conversationCount !== 1) {
    throw new Error("Bot conversation was not created or duplicate found");
  }
  console.log("✅ Bot and initial conversation verified successfully!");

  // 9. Fetch Conversations for Activated User
  console.log("\n--- Step 8: Fetching conversations for activated user ---");
  const convListRes = await fetch(`${BASE_URL}/conversation`, {
    method: "GET",
    headers: { "auth-token": memberToken },
  });

  const convListData = await convListRes.json();
  console.log("Conversations Status:", convListRes.status);
  console.log("Conversations Count:", convListData.length);
  if (convListRes.status !== 200 || convListData.length !== 1) {
    throw new Error("Conversations retrieval failed or list is not exactly 1 (the bot)");
  }
  console.log("Conversation members:", convListData[0].members.map(m => m.name));

  // 10. Query Member Directory
  console.log("\n--- Step 9: Querying Member Directory ---");
  const dirRes = await fetch(`${BASE_URL}/directory/members`, {
    method: "GET",
    headers: { "auth-token": memberToken },
  });

  const dirData = await dirRes.json();
  console.log("Directory Status:", dirRes.status);
  console.log("Directory Total Members:", dirData.pagination.total);
  if (dirRes.status !== 200 || !dirData.success) {
    throw new Error("Directory query failed");
  }

  // 11. Retrieve Single Profile with masking
  console.log("\n--- Step 10: Retrieving Single Member Details ---");
  const detailRes = await fetch(`${BASE_URL}/directory/members/${memberId}`, {
    method: "GET",
    headers: { "auth-token": memberToken },
  });

  const detailData = await detailRes.json();
  console.log("Detail Status:", detailRes.status);
  console.log("Detail Data:", detailData.member);
  if (detailRes.status !== 200 || !detailData.success) {
    throw new Error("Single member details retrieval failed");
  }

  // Check default mask: email and phone should be null because showEmail=false, showPhone=false
  console.log("Checking visibility masks (defaults should be null):");
  console.log("  Email:", detailData.member.email);
  console.log("  Phone:", detailData.member.phone);
  if (detailData.member.email !== null || detailData.member.phone !== null) {
    throw new Error("Privacy mask failed to hide email or phone by default");
  }

  // 12. Modify Privacy Settings
  console.log("\n--- Step 11: Modifying Privacy Settings ---");
  const updatePrivRes = await fetch(`${BASE_URL}/directory/me/privacy`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "auth-token": memberToken,
    },
    body: JSON.stringify({
      showEmail: true,
      showPhone: true,
    }),
  });

  const updatePrivData = await updatePrivRes.json();
  console.log("Update Privacy Status:", updatePrivRes.status);
  console.log("Update Privacy Response:", updatePrivData);
  if (updatePrivRes.status !== 200 || !updatePrivData.success) {
    throw new Error("Updating privacy settings failed");
  }

  // Get Detail again to verify they are now visible
  const detailSharedRes = await fetch(`${BASE_URL}/directory/members/${memberId}`, {
    method: "GET",
    headers: { "auth-token": memberToken },
  });

  const detailSharedData = await detailSharedRes.json();
  console.log("Checking visibility after share (should be visible):");
  console.log("  Email:", detailSharedData.member.email);
  console.log("  Phone:", detailSharedData.member.phone);
  if (detailSharedData.member.email !== testEmail || detailSharedData.member.phone !== testPhone) {
    throw new Error("Privacy update failed to reveal shared email/phone");
  }

  // 13. Test Account Deletion
  console.log("\n--- Step 12: Testing Account Deletion ---");
  const deleteRes = await fetch(`${BASE_URL}/user/delete`, {
    method: "DELETE",
    headers: { "auth-token": memberToken },
  });

  const deleteData = await deleteRes.json();
  console.log("Delete Status:", deleteRes.status);
  console.log("Delete Response:", deleteData);
  if (deleteRes.status !== 200 || !deleteData.success) {
    throw new Error("Account deletion failed");
  }

  // 14. Verify deletion status
  const dbUserAfterDel = await User.findById(activatedUserId).lean();
  console.log("DB User isDeleted after deletion:", dbUserAfterDel.isDeleted);
  console.log("DB User name after deletion:", dbUserAfterDel.name);
  if (!dbUserAfterDel.isDeleted || dbUserAfterDel.name !== "Deleted Conversa User") {
    throw new Error("Deletion flag or name anonymization failed");
  }

  console.log("\n=============================================");
  console.log("🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!");
  console.log("=============================================");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ TEST FAILED:", err);
  mongoose.disconnect().then(() => process.exit(1));
});
