const nodemailer = require("nodemailer");

// 1. Check if EMAIL and PASSWORD environment variables are configured
const isEmailConfigured = !!process.env.EMAIL;
const isPasswordConfigured = !!process.env.PASSWORD;

console.log(`[SMTP Config Check] EMAIL configured: ${isEmailConfigured}`);
console.log(`[SMTP Config Check] PASSWORD configured: ${isPasswordConfigured}`);

// 2. Normalise password by removing all spaces (Gmail App Passwords often have spaces)
const rawPassword = process.env.PASSWORD || "";
const normalisedPassword = rawPassword.replace(/\s+/g, "");

// 3. Configure Gmail SMTP transport with requested parameters and custom timeouts
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL || "",
    pass: normalisedPassword,
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

// 4. Improved Safe SMTP Error Logger
const logSafeSmtpError = (contextName, error) => {
  if (!error) return;
  console.error(`[SMTP Error] [${contextName}] Failed:`, {
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    response: error.response,
    message: error.message
  });
};

// 5. Transporter Verification Helper
const verifyTransporter = async () => {
  console.log("[SMTP Verification] Checking connection to Gmail SMTP...");
  try {
    // We run verify with a Promise and a timeout of 10s to prevent hanging startup
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("SMTP verification connection timed out")), 10000)
    );
    await Promise.race([verifyPromise, timeoutPromise]);
    console.log("[SMTP Verification] SMTP is ready to deliver emails.");
    return true;
  } catch (error) {
    logSafeSmtpError("Verification", error);
    console.warn("[SMTP Verification] WARNING: SMTP validation failed. Server will start but email delivery will fail.");
    return false;
  }
};

module.exports = {
  transporter,
  verifyTransporter,
  logSafeSmtpError,
  EMAIL: process.env.EMAIL
};
