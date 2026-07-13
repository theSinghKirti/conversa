const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const { sendEmail, isResendConfigured, isNodemailerConfigured } = require("../utils/emailService.js");

const recipient = process.argv[2];
if (!recipient) {
  console.error("Error: Recipient email address is required.");
  console.error("Usage: node scripts/testEmail.js recipient@example.com");
  process.exit(1);
}

const run = async () => {
  console.log("=== EMAIL DIAGNOSTIC START ===");
  console.log(`[Config Check] Resend Configured: ${isResendConfigured}`);
  console.log(`[Config Check] Nodemailer Fallback Configured: ${isNodemailerConfigured}`);

  if (!isResendConfigured && !isNodemailerConfigured) {
    console.warn("WARNING: Neither Resend nor Nodemailer are configured. Falling back to console-only mock.");
  }

  // Define diagnostic payload
  const mailOptions = {
    to: recipient,
    subject: "Conversa Email Service Diagnostic Test",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Diagnostic Test</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2 style="color: #6366f1;">Conversa Delivery Verification</h2>
  <p>This is a diagnostic email dispatched to verify your new email integration.</p>
  <p><strong>Method:</strong> ${isResendConfigured ? "Resend HTTPS API" : isNodemailerConfigured ? "Nodemailer SMTP Fallback" : "Console Sandbox Mock"}</p>
  <p>Dispatched At: ${new Date().toISOString()}</p>
</body>
</html>`
  };

  console.log(`Attempting email delivery to: ${recipient}...`);
  const result = await sendEmail(mailOptions);

  if (result.success) {
    console.log("=== EMAIL DIAGNOSTIC SUCCESS ===");
    console.log("Details:", {
      messageId: result.messageId
    });
  } else {
    console.error("=== EMAIL DIAGNOSTIC FAILED ===");
    console.error("Details:", {
      error: result.error
    });
    process.exit(1);
  }
};

run();
