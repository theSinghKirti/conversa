/**
 * backfill-directory-profiles.js
 *
 * Scans all ACTIVE membership applications that have an associated activatedUser,
 * finds their User profile in the database, and backfills missing directory fields:
 *   - phone, city, state, occupation, organisation, education, bloodGroup, communityDetails
 *
 * Safe to run multiple times (will not overwrite non-empty fields).
 *
 * Usage:
 *   npm run backfill:directory
 */

const connectDB = require("../db.js");
const MembershipApplication = require("../Models/MembershipApplication.js");
const User = require("../Models/User.js");

const run = async () => {
  await connectDB();

  console.log("Starting directory profiles backfill...");

  // Find active applications with activatedUser reference
  const activeApps = await MembershipApplication.find({
    status: "ACTIVE",
    activatedUser: { $exists: true, $ne: null },
  }).lean();

  console.log(`Found ${activeApps.length} active applications to process.`);

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const app of activeApps) {
    processedCount++;
    try {
      const user = await User.findById(app.activatedUser);

      if (!user) {
        console.warn(`[WARNING] Associated User not found for app ID: ${app.applicationId}`);
        failedCount++;
        continue;
      }

      let needsUpdate = false;

      // Safe fields to copy
      const fields = [
        "phone",
        "city",
        "state",
        "occupation",
        "organisation",
        "education",
        "bloodGroup",
        "communityDetails",
      ];

      for (const field of fields) {
        const appValue = app[field];
        // If app has the value, and user value is missing or empty, copy it
        if (appValue && (user[field] === undefined || user[field] === null || user[field] === "")) {
          user[field] = appValue;
          needsUpdate = true;
        }
      }

      // Also ensure memberId and membershipApplication are correctly referenced
      if (!user.memberId && app.memberId) {
        user.memberId = app.memberId;
        needsUpdate = true;
      }

      if (!user.membershipApplication) {
        user.membershipApplication = app._id;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.error(`[ERROR] Processing failed for app ID ${app.applicationId}:`, err.message);
      failedCount++;
    }
  }

  console.log("\nBackfill execution complete.");
  console.log(`---------------------------------`);
  console.log(`  Processed : ${processedCount}`);
  console.log(`  Updated   : ${updatedCount}`);
  console.log(`  Skipped   : ${skippedCount}`);
  console.log(`  Failed    : ${failedCount}`);
  console.log(`---------------------------------`);

  process.exit(0);
};

run().catch((err) => {
  console.error("Backfill failed to execute:", err.message);
  process.exit(1);
});
