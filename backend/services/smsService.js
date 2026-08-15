const https = require('https');

/**
 * Validates Indian phone number format (+91 or 10-digit starting with 6-9)
 */
function sanitizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = phone.toString().replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    return digits;
  }
  return null;
}

/**
 * Sends SMS OTP via MSG91 REST API
 * Environment Variables required:
 * - MSG91_AUTH_KEY
 * - MSG91_TEMPLATE_ID
 * - MSG91_SENDER_ID
 */
async function sendSmsOtp(phone, otpCode) {
  const formattedPhone = sanitizeIndianPhone(phone);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid Indian phone number format. Use 10-digit number or +91 format.' };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || 'RAKTOR';

  if (!authKey || !templateId) {
    if (process.env.OTP_DEV_MODE === 'true') {
      console.log(`[SMS SERVICE - DEV MODE] MSG91 keys missing, but OTP_DEV_MODE=true. SMS OTP for +${formattedPhone}: ${otpCode}`);
      return { success: true, devMode: true, message: 'OTP dispatched (Development Mode)' };
    }
    console.error(`[SMS SERVICE CONFIG ERROR] MSG91_AUTH_KEY or MSG91_TEMPLATE_ID environment variables missing.`);
    return { success: false, error: 'SMS service configuration missing. MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required.' };
  }

  const postData = JSON.stringify({
    template_id: templateId,
    short_url: '0',
    recipients: [
      {
        mobiles: formattedPhone,
        var1: otpCode
      }
    ]
  });

  const queryParams = new URLSearchParams({
    template_id: templateId,
    mobile: formattedPhone,
    authkey: authKey,
    otp: otpCode
  }).toString();

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'control.msg91.com',
      port: 443,
      path: `/api/v5/otp?${queryParams}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          // Safe fallback: MSG91 API error response was non-JSON HTML/plain-text
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && (!parsed || parsed.type !== 'error')) {
          resolve({ success: true, message: parsed?.message || 'SMS OTP sent successfully' });
        } else {
          const errorMsg = parsed?.message || parsed?.error || `MSG91 status ${res.statusCode}`;
          console.error(`[SMS SERVICE ERROR] MSG91 status ${res.statusCode}:`, body);
          resolve({ success: false, error: `MSG91 SMS Error: ${errorMsg}` });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[SMS SERVICE NETWORK ERROR]:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  sanitizeIndianPhone,
  sendSmsOtp
};
