/**
 * seedAdmin.js
 *
 * Creates or updates an ADMIN user securely from environment variables.
 * Idempotent: Can be run multiple times safely.
 */

const bcrypt = require("bcryptjs");
const connectDB = require("../db.js");
const User = require("../Models/User.js");

const run = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.error("❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    process.exit(1);
  }

  const normalisedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
    console.error("❌ Error: Invalid email format.");
    process.exit(1);
  }

  // Validate password length
  if (password.length < 6) {
    console.error("❌ Error: Password must be at least 6 characters long.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await connectDB();

  console.log("Hashing password...");
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  console.log(`Checking for existing user with email: ${normalisedEmail}`);
  const existingUser = await User.findOne({ email: normalisedEmail });

  if (existingUser) {
    console.log("User found. Updating to ADMIN status and setting password...");
    existingUser.role = "ADMIN";
    existingUser.password = hashedPassword;
    existingUser.accountStatus = "ACTIVE";
    existingUser.isEmailVerified = true;
    existingUser.isDeleted = false;
    await existingUser.save();
    console.log(`✅ Success: Updated user ${normalisedEmail} to ADMIN.`);
  } else {
    console.log("User not found. Creating a new ADMIN account...");
    await User.create({
      name,
      email: normalisedEmail,
      password: hashedPassword,
      role: "ADMIN",
      accountStatus: "ACTIVE",
      authMethod: "PASSWORD",
      isEmailVerified: true,
      about: "System Administrator",
      profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&bold=true`,
    });
    console.log(`✅ Success: Created new ADMIN user ${normalisedEmail}.`);
  }

  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Unhandled seed error:", err.message);
  process.exit(1);
});
