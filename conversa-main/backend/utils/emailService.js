const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const nodemailer = require("nodemailer");

// 1. Retrieve Brevo REST parameters
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Conversa";

const isBrevoHttpConfigured = !!BREVO_API_KEY && !!EMAIL_FROM;

// 2. Retrieve optional local SMTP fallback configurations
const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_LOGIN = process.env.SMTP_LOGIN;
const SMTP_KEY = process.env.SMTP_KEY;

const isSmtpFallbackConfigured = !!SMTP_LOGIN && !!SMTP_KEY;

// Nodemailer SMTP fallback transporter configuration
let fallbackTransporter = null;
if (!isBrevoHttpConfigured && isSmtpFallbackConfigured) {
  fallbackTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // STARTTLS
    auth: {
      user: SMTP_LOGIN,
      pass: SMTP_KEY,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });
}

// 3. Safe error logger (no API key or OTP values exposed)
const logSafeError = (contextName, error) => {
  if (!error) return;
  console.error(`[Email Error] [${contextName}] Failed:`, {
    message: error.message,
    status: error.status,
    code: error.code,
    response: error.response
  });
};

/**
 * Checks connection connection to SMTP fallback if needed.
 * Returns true automatically for REST API since no connection state is held.
 */
const verifyTransporter = async () => {
  if (isBrevoHttpConfigured) {
    console.log("[SMTP Verification] Brevo Transactional Email REST API is active (no startup connection check needed).");
    return true;
  }
  if (fallbackTransporter) {
    console.log("[SMTP Verification] Checking connection to SMTP Fallback Relay...");
    try {
      await fallbackTransporter.verify();
      console.log("[SMTP Verification] SMTP Fallback is ready.");
      return true;
    } catch (error) {
      logSafeError("Fallback Verification", error);
      return false;
    }
  }
  console.warn("[SMTP Verification] WARNING: Neither Brevo API key nor local SMTP fallback credentials configured.");
  return false;
};

/**
 * Sends an email using Brevo HTTP REST API in production or local fallbacks.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendEmail = async ({ to, subject, html }) => {
  // Bypass if target email is a mock domain
  if (to.endsWith("@example.com")) {
    console.log(`\n==================================================`);
    console.log(`[DEV/TEST ONLY] BYPASS EMAIL TO: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`==================================================\n`);
    return { success: true, messageId: "mock-message-id" };
  }

  // A. Primary Flow: Brevo Transactional HTTP REST API
  if (isBrevoHttpConfigured) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
          accept: "application/json"
        },
        body: JSON.stringify({
          sender: {
            email: EMAIL_FROM,
            name: EMAIL_FROM_NAME
          },
          to: [{ email: to }],
          subject,
          htmlContent: html
        })
      });

      const responseBody = await response.text();
      let data = {};
      try {
        data = JSON.parse(responseBody);
      } catch (e) {
        data = { message: responseBody };
      }

      if (response.ok) {
        return { success: true, messageId: data.messageId };
      } else {
        logSafeError("BrevoHTTP_API", {
          message: data.message || "Non-2xx response from Brevo HTTP API",
          status: response.status,
          code: data.code
        });
        return { success: false, error: data.message || `Brevo HTTP API ${response.status} error` };
      }
    } catch (error) {
      logSafeError("BrevoHTTP_Network", error);
      return { success: false, error: error.message };
    }
  }

  // B. Optional Local SMTP Fallback
  if (fallbackTransporter) {
    try {
      const info = await fallbackTransporter.sendMail({
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
        to,
        subject,
        html,
      });
      console.log(`[Nodemailer Fallback] Sent email to ${to}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logSafeError("NodemailerFallback", error);
      return { success: false, error: error.message };
    }
  }

  // C. Fail clearly if in production but unconfigured
  if (process.env.NODE_ENV === "production") {
    const errorMsg = "Email delivery failed: BREVO_API_KEY and EMAIL_FROM are not configured in production environment.";
    console.error(`[sendEmail] Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  // D. Sandbox / Development Mock fallback
  console.log(`\n==================================================`);
  console.log(`[Brevo Not Configured] MOCK EMAIL TO: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`==================================================\n`);
  return { success: true, messageId: "mock-console-id" };
};

module.exports = {
  sendEmail,
  verifyTransporter,
  isBrevoHttpConfigured
};
