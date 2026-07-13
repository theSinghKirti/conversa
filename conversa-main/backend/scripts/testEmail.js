const path = require("path");
const dotenv = require("dotenv");
// Load local .env if available
dotenv.config({ path: path.join(__dirname, "../.env") });

const { transporter, verifyTransporter, logSafeSmtpError } = require("../utils/emailTransporter.js");

const recipient = process.argv[2];
if (!recipient) {
  console.error("Error: Recipient email address is required.");
  console.error("Usage: node scripts/testEmail.js recipient@example.com");
  process.exit(1);
}

const run = async () => {
  console.log("=== SMTP DIAGNOSTIC START ===");
  console.log(`Testing SMTP with user: ${process.env.EMAIL || "Not configured"}`);
  
  // 1. Verify SMTP connection
  const isReady = await verifyTransporter();
  if (!isReady) {
    console.error("SMTP transporter verification failed. Cannot proceed with sending email.");
    process.exit(1);
  }

  // 2. Try sending test email
  const mailOptions = {
    from: `"Conversa SMTP Test" <${process.env.EMAIL}>`,
    to: recipient,
    subject: "Conversa SMTP Diagnostic Test Email",
    text: "Hello! This is a diagnostic test email to verify that Conversa's SMTP configuration is working properly on Render.",
    html: "<p>Hello! This is a diagnostic test email to verify that Conversa's SMTP configuration is working properly on Render.</p>"
  };

  console.log(`Sending diagnostic email to: ${recipient}...`);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("SMTP Send Email Success:", {
      messageId: info.messageId,
      response: info.response,
      envelope: info.envelope
    });
    console.log("=== SMTP DIAGNOSTIC SUCCESS ===");
  } catch (error) {
    logSafeSmtpError("DiagnosticTestEmail", error);
    console.error("=== SMTP DIAGNOSTIC FAILED ===");
    process.exit(1);
  }
};

run();
