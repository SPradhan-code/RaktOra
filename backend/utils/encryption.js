const crypto = require('crypto');

// Secret key for AES-256-GCM encryption (32 bytes)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.createHash('sha256').update(process.env.JWT_SECRET || 'bloodconnect_e2e_secret_key_2026').digest();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts plain text string using AES-256-GCM.
 * Returns formatted string: iv:authTag:encryptedData
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption Error:', err.message);
    return text;
  }
}

/**
 * Decrypts string produced by encrypt()
 */
function decrypt(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.includes(':')) return cipherText;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // Return original if not encrypted
    return cipherText;
  }
}

/**
 * Generates an HMAC-SHA256 signature for payload verification
 */
function generateSignature(payload) {
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  return crypto.createHmac('sha256', ENCRYPTION_KEY).update(data).digest('hex');
}

/**
 * Verifies HMAC-SHA256 payload signature
 */
function verifySignature(payload, signature) {
  if (!signature) return false;
  const expected = generateSignature(payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

module.exports = {
  encrypt,
  decrypt,
  generateSignature,
  verifySignature
};
