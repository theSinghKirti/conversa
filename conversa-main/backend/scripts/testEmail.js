const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const { sendEmail, isBrevoHttpConfigured } = require("../utils/emailService.js");

const recipient = process.argv[2];
if (!recipient) {
  console.error("Error: Recipient email address is required.");
  console.error("Usage: node scripts/testEmail.js recipient@example.com");
  process.exit(1);
}

const run = async () => {
  console.log("=== BREVO HTTP API DIAGNOSTIC START ===");
  console.log(`[Config Check] Brevo REST API Configured: ${isBrevoHttpConfigured}`);
  console.log(`[Config Check] BREVO_API_KEY: ${process.env.BREVO_API_KEY ? "Exists" : "Missing"}`);
  console.log(`[Config Check] EMAIL_FROM: ${process.env.EMAIL_FROM || "Missing"}`);
  console.log(`[Config Check] EMAIL_FROM_NAME: ${process.env.EMAIL_FROM_NAME || "Conversa"}`);

  if (!isBrevoHttpConfigured) {
    console.error("ERROR: Brevo Transactional Email REST API is not configured. Cannot dispatch email.");
    process.exit(1);
  }

  // Dispatch email
  const mailOptions = {
    to: recipient,
    subject: "Conversa Brevo REST API Diagnostic Test",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Brevo REST API Test</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2 style="color: #6366f1;">Conversa Brevo REST HTTP Delivery Verification</h2>
  <p>This is a diagnostic email dispatched to verify your new Brevo HTTP REST API integration.</p>
  <p><strong>Method:</strong> Brevo Transactional REST API over HTTPS</p>
  <p>Dispatched At: ${new Date().toISOString()}</p>
</body>
</html>`
  };

  console.log(`Attempting email delivery to: ${recipient}...`);
  const result = await sendEmail(mailOptions);

  if (result.success) {
    console.log("=== BREVO REST DIAGNOSTIC SUCCESS ===");
    console.log("Details:", {
      messageId: result.messageId
    });
  } else {
    console.error("=== BREVO REST DIAGNOSTIC FAILED ===");
    console.error("Details:", {
      error: result.error
    });
    process.exit(1);
  }
};

run();
