const { transporter, logSafeSmtpError, EMAIL } = require("./emailTransporter.js");
const { FRONTEND_URL } = require("../secrets.js");

/**
 * Sends a community membership approval & account activation invitation email.
 *
 * @param {Object} application – MembershipApplication mongoose document
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendActivationInvite = async (application) => {
  if (!EMAIL || !process.env.PASSWORD) {
    console.error("sendActivationInvite error: EMAIL or PASSWORD environment variables not configured.");
    return { success: false, error: "SMTP settings not configured on server" };
  }

  const encodedMemberId = encodeURIComponent(application.memberId);
  const encodedEmail = encodeURIComponent(application.email);
  const activationUrl = `${FRONTEND_URL}/activate?memberId=${encodedMemberId}&email=${encodedEmail}`;

  const mailOptions = {
    from: `"Conversa Community" <${EMAIL}>`,
    to: application.email,
    subject: "Your Community Membership Has Been Approved",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Membership Approved</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#6366f1;padding:36px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:0.5px;">Conversa</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Verified Community Platform</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello ${application.name},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
                We are pleased to inform you that your application for community membership has been approved!
              </p>

              <!-- Member ID Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center" style="background-color:#f5f3ff;border:2px dashed #8b5cf6;border-radius:10px;padding:20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">Assigned Member ID</p>
                    <p style="margin:0;font-size:28px;font-weight:800;letter-spacing:2px;color:#6366f1;">${application.memberId}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                To activate your account and access the directory, click the button below. You will be prompted to verify your email with an OTP (One-Time Password) to complete activation.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${activationUrl}" target="_blank" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 30px;border-radius:6px;box-shadow:0 2px 4px rgba(99,102,241,0.25);">
                      Activate Member Account
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;word-break:break-all;">
                If the button doesn't work, copy and paste this link in your browser:<br/>
                <a href="${activationUrl}" style="color:#6366f1;text-decoration:underline;">${activationUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} Conversa. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  try {
    if (application.email.endsWith("@example.com")) {
      console.log(`\n==================================================`);
      console.log(`[DEV/TEST ONLY] ACTIVATION LINK FOR ${application.email}:`);
      console.log(`${activationUrl}`);
      console.log(`==================================================\n`);
      return { success: true };
    }
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    if (application.email.endsWith("@example.com")) {
      console.log(`\n==================================================`);
      console.log(`[DEV/TEST ONLY] ACTIVATION LINK FOR ${application.email}:`);
      console.log(`${activationUrl} (SMTP failed)`);
      console.log(`==================================================\n`);
      return { success: true };
    }
    logSafeSmtpError("sendActivationInvite", error);
    return { success: false, error: "Failed to deliver activation invitation email. System SMTP service might be temporarily unavailable or misconfigured." };
  }
};

module.exports = sendActivationInvite;
