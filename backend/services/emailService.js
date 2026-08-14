const https = require('https');

/**
 * Sends a transactional OTP email via Resend REST API
 * Environment Variables required:
 * - RESEND_API_KEY
 * - EMAIL_FROM (optional, defaults to RaktOra <onboarding@resend.dev>)
 */
async function sendEmailOtp(toEmail, otpCode) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'RaktOra Verification <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(`[EMAIL SERVICE] Provider RESEND_API_KEY not configured. Simulated dispatch to ${toEmail}`);
    return { success: true, simulated: true };
  }

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #e11d48; padding: 24px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; tracking-tight: -0.025em;">RaktOra</h1>
        <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">National Voluntary Blood Network</p>
      </div>
      <div style="padding: 32px 24px; text-align: center; color: #1e293b;">
        <h2 style="font-size: 18px; font-weight: 700; margin-top: 0;">Email Verification Code</h2>
        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">Your 6-digit security code for account verification is:</p>
        <div style="background-color: #fff1f2; border: 2px dashed #fda4af; border-radius: 12px; padding: 16px; margin: 24px 0; display: inline-block;">
          <span style="font-family: monospace; font-size: 32px; font-weight: 800; color: #e11d48; letter-spacing: 6px;">${otpCode}</span>
        </div>
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">This OTP is valid for <strong>5 minutes</strong> and can only be used once. Do not share this code with anyone.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
        © ${new Date().getFullYear()} RaktOra Blood Donor Portal. Built for voluntary emergency blood services.
      </div>
    </div>
  `;

  const postData = JSON.stringify({
    from: fromEmail,
    to: [toEmail],
    subject: `RaktOra Email Verification Code`,
    html: htmlContent
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, status: res.statusCode });
        } else {
          console.error(`[EMAIL SERVICE ERROR] Resend API status ${res.statusCode}:`, body);
          resolve({ success: false, error: 'Provider returned error status' });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[EMAIL SERVICE NETWORK ERROR]:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sendEmailOtp
};
