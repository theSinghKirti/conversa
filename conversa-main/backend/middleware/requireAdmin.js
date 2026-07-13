const User = require("../Models/User.js");

/**
 * requireAdmin middleware
 *
 * Must be used AFTER the fetchuser middleware.
 * fetchuser already verified the JWT and placed { id } on req.user.
 * This middleware re-fetches the user to read the live role from the database,
 * so a role downgrade takes effect immediately without waiting for token expiry.
 *
 * Returns:
 *   401  – no authenticated user on request (fetchuser not run first, or token missing)
 *   403  – user authenticated but role !== ADMIN
 */
const requireAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: "Authentication required.",
    });
  }

  try {
    const user = await User.findById(req.user.id).select("role isDeleted");

    if (!user || user.isDeleted) {
      return res.status(401).json({
        success: false,
        error: "Authentication required.",
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        error: "Admin access required.",
      });
    }

    // Attach full role to request so controllers can use it if needed
    req.user.role = user.role;
    next();
  } catch (error) {
    console.error("requireAdmin error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = requireAdmin;
