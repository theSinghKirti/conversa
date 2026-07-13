const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const nodemailer = require("nodemailer");

// 1. Retrieve Resend configuration from environment
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

const isResendConfigured = !!RESEND_API_KEY && !!EMAIL_FROM;

// 2. Retrieve optional local Nodemailer fallback credentials
const isNodemailerConfigured = !!process.env.EMAIL && !!process.env.PASSWORD;

let transporter = null;
if (!isResendConfigured && isNodemailerConfigured) {
  const rawPassword = process.env.PASSWORD || "";
  const normalisedPassword = rawPassword.replace(/\s+/g, "");
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.EMAIL,
      pass: normalisedPassword,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  });
}

// 3. Safe error reporting logger
const logSafeError = (contextName, error) => {
  if (!error) return;
  console.error(`[Email Error] [${contextName}] Failed:`, {
    message: error.message,
    code: error.code,
    status: error.status,
    response: error.response
  });
};

/**
 * Sends an email using the Resend HTTPS REST API, falling back to Nodemailer or console mock.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
const sendEmail = async ({ to, subject, html }) => {
  // Bypass if target email is mock domain
  if (to.endsWith("@example.com")) {
    console.log(`\n==================================================`);
    console.log(`[DEV/TEST ONLY] BYPASS EMAIL TO: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`==================================================\n`);
    return { success: true, messageId: "mock-message-id" };
  }

  // A. Primary Flow: Resend HTTP API
  if (isResendConfigured) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [to],
          subject: subject,
          html: html,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, messageId: data.id };
      } else {
        logSafeError("ResendAPI", {
          message: data.message || "Failed to send email via Resend API",
          status: response.status,
          code: data.name
        });
        return { success: false, error: data.message || "Resend API error" };
      }
    } catch (error) {
      logSafeError("ResendHTTP", error);
      return { success: false, error: error.message };
    }
  }

  // B. Optional Fallback Flow: Nodemailer SMTP
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"Conversa Local" <${process.env.EMAIL}>`,
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

  // C. Local Sandbox / Development Fallback: Console print only
  console.log(`\n==================================================`);
  console.log(`[SMTP/Resend Not Configured] MOCK EMAIL TO: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`==================================================\n`);
  return { success: true, messageId: "mock-console-id" };
};

module.exports = {
  sendEmail,
  isResendConfigured,
  isNodemailerConfigured
};
