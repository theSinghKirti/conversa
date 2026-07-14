const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const nodemailer = require("nodemailer");

// 1. Retrieve Brevo SMTP configuration
const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT) || 587;
const SMTP_LOGIN = process.env.SMTP_LOGIN;
const SMTP_KEY = process.env.SMTP_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

// 2. Fail clearly if Brevo credentials are missing
const isBrevoConfigured = !!SMTP_LOGIN && !!SMTP_KEY && !!EMAIL_FROM;

// Safe error logging function
const logSafeError = (contextName, error) => {
  if (!error) return;
  console.error(`[SMTP Error] [${contextName}] Failed:`, {
    code: error.code,
    command: error.command,
    responseCode: error.responseCode,
    response: error.response,
    message: error.message
  });
};

if (!isBrevoConfigured) {
  console.error("\n==================================================");
  console.error("FATAL ERROR: Brevo SMTP Configuration is missing.");
  console.error("Please configure the following environment variables:");
  console.error("- SMTP_LOGIN");
  console.error("- SMTP_KEY");
  console.error("- EMAIL_FROM");
  console.error("==================================================\n");
}

// 3. Create Brevo Nodemailer Transporter
const transporter = isBrevoConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // Port 587 requires secure: false with STARTTLS
      auth: {
        user: SMTP_LOGIN,
        pass: SMTP_KEY,
      },
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    })
  : null;

/**
 * Checks connection connection to Brevo SMTP
 */
const verifyTransporter = async () => {
  if (!transporter) {
    console.error("[SMTP Verification] Cannot verify connection: Transporter is not configured.");
    return false;
  }
  console.log("[SMTP Verification] Checking connection to Brevo SMTP...");
  try {
    await transporter.verify();
    console.log("[SMTP Verification] Brevo SMTP is ready to deliver emails.");
    return true;
  } catch (error) {
    logSafeError("Verification", error);
    console.warn("[SMTP Verification] WARNING: SMTP validation failed. Server will start but email delivery will fail.");
    return false;
  }
};

/**
 * Sends an email using the Brevo SMTP transporter.
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

  if (!isBrevoConfigured || !transporter) {
    const errorMsg = "SMTP delivery failed: Brevo variables (SMTP_LOGIN, SMTP_KEY, EMAIL_FROM) are not configured.";
    console.error(`[sendEmail] Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }

  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logSafeError("sendEmail", error);
    return { success: false, error: `Failed to deliver email: ${error.message}` };
  }
};

module.exports = {
  sendEmail,
  verifyTransporter,
  isBrevoConfigured
};
