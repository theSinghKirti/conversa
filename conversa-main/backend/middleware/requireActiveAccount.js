const User = require("../Models/User.js");

/**
 * requireActiveAccount middleware
 *
 * Must be executed AFTER fetchuser (which decodes the JWT and sets req.user.id).
 * This middleware re-fetches the user to read the live accountStatus and role
 * from the database, preventing race conditions (e.g. if an admin suspends the user).
 *
 * Allows access to:
 *   - Admins (role === "ADMIN")
 *   - Active Members (role === "MEMBER" && accountStatus === "ACTIVE")
 *
 * Blocks access for:
 *   - Non-active Members (role === "MEMBER" && accountStatus !== "ACTIVE") -> HTTP 403
 *   - Missing, deleted, or invalid users -> HTTP 401
 */
const requireActiveAccount = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
  }

  try {
    const user = await User.findById(req.user.id);

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    // Admins bypass account status verification checks
    if (user.role === "ADMIN") {
      req.currentUser = user; // Attach full user document to request
      return next();
    }

    if (user.role === "MEMBER") {
      if (user.accountStatus === "ACTIVE") {
        req.currentUser = user; // Attach full user document to request
        return next();
      }
      
      // Suspended or Deactivated members
      return res.status(403).json({
        success: false,
        error: "An active membership is required.",
      });
    }

    // Default block for any unknown roles
    return res.status(403).json({
      success: false,
      error: "An active membership is required.",
    });
  } catch (error) {
    console.error("requireActiveAccount error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = requireActiveAccount;
