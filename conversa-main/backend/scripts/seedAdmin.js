/**
 * seedAdmin.js
 *
 * Idempotent admin credential synchronisation script.
 *
 * Behaviour:
 *   - If an admin user with ADMIN_EMAIL exists  → updates password, role, status.
 *   - If no user with ADMIN_EMAIL exists         → creates a fresh admin account.
 *   - Always forces: role=ADMIN, accountStatus=ACTIVE, authMethod=PASSWORD,
 *     isEmailVerified=true, isDeleted=false.
 *   - Verifies bcrypt.compare after saving to confirm login will work.
 *   - Never logs raw password values.
 *   - Safe to run repeatedly — no duplicates created.
 *
 * Usage (Render Shell):
 *   node scripts/seedAdmin.js
 *
 * Required env vars: ADMIN_EMAIL, ADMIN_PASSWORD
 * Optional env var:  ADMIN_NAME (defaults to "Admin")
 */

const bcrypt = require("bcryptjs");
const connectDB = require("../db.js");
const User = require("../Models/User.js");

const run = async () => {
  const email    = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name     = process.env.ADMIN_NAME || "Admin";

  if (!email || !password) {
    console.error("❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    process.exit(1);
  }

  const normalisedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
    console.error("❌ Invalid email format in ADMIN_EMAIL.");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("❌ ADMIN_PASSWORD must be at least 6 characters.");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await connectDB();
  console.log(`Database: ${process.env.MONGO_DB_NAME || "(using URI default)"}`);

  // Hash the configured password
  const salt           = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  console.log("Password hashed. ✓");

  const existingUser = await User.findOne({ email: normalisedEmail });

  if (existingUser) {
    console.log(`User found (id: ${existingUser._id}). Synchronising credentials...`);

    // Always overwrite — ensures stale hashes from old passwords are replaced
    existingUser.role             = "ADMIN";
    existingUser.password         = hashedPassword;
    existingUser.authMethod       = "PASSWORD";
    existingUser.accountStatus    = "ACTIVE";
    existingUser.isEmailVerified  = true;
    existingUser.isDeleted        = false;
    if (name && existingUser.name !== name) existingUser.name = name;

    await existingUser.save();
    console.log(`✅ Synchronised: ${normalisedEmail} → role=ADMIN, authMethod=PASSWORD, status=ACTIVE`);
  } else {
    console.log("No existing user found. Creating new admin account...");
    await User.create({
      name,
      email:            normalisedEmail,
      password:         hashedPassword,
      role:             "ADMIN",
      accountStatus:    "ACTIVE",
      authMethod:       "PASSWORD",
      isEmailVerified:  true,
      about:            "System Administrator",
      profilePic:       `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&bold=true`,
    });
    console.log(`✅ Created new admin: ${normalisedEmail}`);
  }

  // ── Verification step ───────────────────────────────────────────────────────
  // Re-read from DB and confirm bcrypt.compare works — exactly as login does.
  console.log("\nVerifying saved credentials...");
  const saved = await User.findOne({ email: normalisedEmail }).select("+password");

  if (!saved) {
    console.error("❌ Verification failed: user not found after save.");
    process.exit(1);
  }

  const bcryptOk = await bcrypt.compare(password, saved.password);
  if (!bcryptOk) {
    console.error("❌ Verification failed: bcrypt.compare returned false. Password hash mismatch.");
    process.exit(1);
  }

  console.log("bcrypt.compare: ✅ PASS");
  console.log(`role         : ${saved.role}`);
  console.log(`authMethod   : ${saved.authMethod}`);
  console.log(`accountStatus: ${saved.accountStatus}`);
  console.log(`emailVerified: ${saved.isEmailVerified}`);
  console.log(`isDeleted    : ${saved.isDeleted}`);
  console.log("\n✅ Admin seeding complete. Login will succeed.");

  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Unhandled seed error:", err.message);
  process.exit(1);
});
