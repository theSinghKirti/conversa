const express = require("express");
const router = express.Router();

const {
  login,
  authUser,
  sendotp,
  sendVerificationOtp,
  verifyEmail,
} = require("../Controllers/auth-controller.js");
const fetchuser = require("../middleware/fetchUser.js");

// Public account creation is disabled. The only onboarding path is POST /application/apply.
// The route is kept so old clients receive a clear 403 rather than a silent 404.
router.post("/register", (req, res) => {
  return res.status(403).json({
    success: false,
    error: "Public account creation is disabled. Please submit a membership application.",
  });
});
router.post("/login", login);
router.post("/getotp", sendotp);
router.get("/me", fetchuser, authUser);
router.post("/send-verification-otp", fetchuser, sendVerificationOtp);
router.post("/verify-email", fetchuser, verifyEmail);

module.exports = router;
