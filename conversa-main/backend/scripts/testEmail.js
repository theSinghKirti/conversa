const path = require("path");
const dotenv = require("dotenv");
// Load environment variables relative to current directory
dotenv.config({ path: path.join(__dirname, "../.env") });

const { sendEmail, verifyTransporter, isBrevoConfigured } = require("../utils/emailService.js");

const recipient = process.argv[2];
if (!recipient) {
  console.error("Error: Recipient email address is required.");
  console.error("Usage: node scripts/testEmail.js recipient@example.com");
  process.exit(1);
}

const run = async () => {
  console.log("=== BREVO SMTP DIAGNOSTIC START ===");
  console.log(`[Config Check] Brevo SMTP Configured: ${isBrevoConfigured}`);
  console.log(`[Config Check] SMTP_HOST: ${process.env.SMTP_HOST || "smtp-relay.brevo.com"}`);
  console.log(`[Config Check] SMTP_PORT: ${process.env.SMTP_PORT || "587"}`);
  console.log(`[Config Check] SMTP_LOGIN: ${process.env.SMTP_LOGIN || "Not configured"}`);
  console.log(`[Config Check] EMAIL_FROM: ${process.env.EMAIL_FROM || "Not configured"}`);

  if (!isBrevoConfigured) {
    console.error("ERROR: Brevo SMTP is not configured. Cannot dispatch email.");
    process.exit(1);
  }

  // 1. Verify connection
  const verified = await verifyTransporter();
  if (!verified) {
    console.error("ERROR: SMTP connection verification failed. Cannot proceed with sending email.");
    process.exit(1);
  }

  // 2. Dispatch email
  const mailOptions = {
    to: recipient,
    subject: "Conversa Brevo SMTP Diagnostic Test",
    html: `<!DOCTYPE html>
<html>
<head>
  <title>Brevo SMTP Test</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h2 style="color: #6366f1;">Conversa Brevo SMTP Delivery Verification</h2>
  <p>This is a diagnostic email dispatched to verify your new Brevo SMTP integration.</p>
  <p><strong>Method:</strong> Brevo SMTP Port 587 (STARTTLS)</p>
  <p>Dispatched At: ${new Date().toISOString()}</p>
</body>
</html>`
  };

  console.log(`Attempting email delivery to: ${recipient}...`);
  const result = await sendEmail(mailOptions);

  if (result.success) {
    console.log("=== BREVO SMTP DIAGNOSTIC SUCCESS ===");
    console.log("Details:", {
      messageId: result.messageId
    });
  } else {
    console.error("=== BREVO SMTP DIAGNOSTIC FAILED ===");
    console.error("Details:", {
      error: result.error
    });
    process.exit(1);
  }
};

run();
