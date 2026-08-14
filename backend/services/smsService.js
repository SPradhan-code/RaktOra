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
    return { success: false, error: 'Invalid Indian phone number format. Must be +91 followed by 10 digits.' };
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || 'RAKTOR';

  if (!authKey || !templateId) {
    console.log(`[SMS SERVICE] Provider MSG91 keys unconfigured. Simulated SMS dispatch to +${formattedPhone}`);
    return { success: true, simulated: true };
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

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'control.msg91.com',
      port: 443,
      path: '/api/v5/otp',
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          console.error(`[SMS SERVICE ERROR] MSG91 status ${res.statusCode}:`, body);
          resolve({ success: false, error: 'SMS Provider API error' });
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
