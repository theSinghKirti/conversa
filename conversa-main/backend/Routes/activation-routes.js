const express = require("express");
const router = express.Router();

const {
  requestActivationOtp,
  verifyActivationOtp,
} = require("../Controllers/activation-controller.js");

// POST /activation/request-otp  – request verification code
router.post("/request-otp", requestActivationOtp);

// POST /activation/verify-otp   – submit verification code and create account
router.post("/verify-otp", verifyActivationOtp);

module.exports = router;
