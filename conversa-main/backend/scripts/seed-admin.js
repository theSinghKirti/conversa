/**
 * seed-admin.js
 *
 * Creates (or upserts) an ADMIN user from environment variables.
 * Credentials are NEVER hardcoded – they must be set in the environment.
 *
 * Required environment variables:
 *   ADMIN_NAME     Full name of the admin account
 *   ADMIN_EMAIL    Email address (will be normalised to lowercase)
 *   ADMIN_PASSWORD Plain-text password (will be hashed – never stored raw)
 *
 * Usage:
 *   ADMIN_NAME="Site Admin" ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="SecurePass1!" \
 *     node scripts/seed-admin.js
 *
 * Or set variables in .env and run:
 *   npm run seed:admin
 */

const bcrypt = require("bcryptjs");
const connectDB = require("../db.js");
const User = require("../Models/User.js");

const run = async () => {
  // ── 1. Read and validate environment variables ──────────────────────────
  const rawName = process.env.ADMIN_NAME;
  const rawEmail = process.env.ADMIN_EMAIL;
  const rawPassword = process.env.ADMIN_PASSWORD;

  const missing = [];
  if (!rawName) missing.push("ADMIN_NAME");
  if (!rawEmail) missing.push("ADMIN_EMAIL");
  if (!rawPassword) missing.push("ADMIN_PASSWORD");

  if (missing.length > 0) {
    console.error(`❌  Missing required environment variables: ${missing.join(", ")}`);
    console.error("    Set them before running this script.");
    process.exit(1);
  }

  const name = rawName.trim();
  const email = rawEmail.trim().toLowerCase();

  if (name.length < 3) {
    console.error("❌  ADMIN_NAME must be at least 3 characters.");
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("❌  ADMIN_EMAIL is not a valid email address.");
    process.exit(1);
  }
  if (rawPassword.length < 6) {
    console.error("❌  ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  // ── 2. Connect to database ───────────────────────────────────────────────
  await connectDB();

  // ── 3. Hash password ─────────────────────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

  // ── 4. Upsert admin ──────────────────────────────────────────────────────
  const existing = await User.findOne({ email });

  if (existing) {
    // Ensure the existing account is elevated to ADMIN
    existing.role = "ADMIN";
    existing.name = name;
    existing.password = hashedPassword;
    await existing.save();
    console.log(`✅  Admin account updated: <${email}>`);
    console.log(`    Name : ${name}`);
    console.log(`    Role : ADMIN`);
  } else {
    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "ADMIN",
      about: "Community Administrator",
      isEmailVerified: true, // admin accounts are pre-verified
      profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&bold=true`,
    });
    console.log(`✅  Admin account created: <${email}>`);
    console.log(`    Name : ${name}`);
    console.log(`    Role : ADMIN`);
  }

  console.log("\n⚠️  Keep the admin credentials secure. Do not commit them to version control.");
  process.exit(0);
};

run().catch((err) => {
  console.error("❌  seed-admin failed:", err.message);
  process.exit(1);
});
