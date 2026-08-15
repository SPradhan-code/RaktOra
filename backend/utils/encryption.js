const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Secret key for AES-256-GCM encryption (32 bytes derived from ENCRYPTION_KEY or JWT_SECRET)
function getDerivedKey() {
  const secretSource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'bloodconnect_fallback_secure_dev_key_2026';
  return crypto.createHash('sha256').update(secretSource).digest();
}

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts plain text string using AES-256-GCM.
 * Returns formatted string: iv:authTag:encryptedData
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
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
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.warn('[ENCRYPTION WARNING] Decryption failed for ciphertext string:', err.message);
    return cipherText;
  }
}

/**
 * Generates an HMAC-SHA256 signature for payload verification
 */
function generateSignature(payload) {
  if (payload === undefined || payload === null) return '';
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  const key = getDerivedKey();
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Verifies HMAC-SHA256 payload signature safely.
 * Enforces timing-safe comparison without throwing on length mismatches or malformed encodings.
 */
function verifySignature(payload, signature) {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  const trimmed = signature.trim();
  // An HMAC-SHA256 hex string must be exactly 64 hexadecimal characters (32 bytes)
  if (trimmed.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return false;
  }

  try {
    const expected = generateSignature(payload);
    if (!expected) return false;

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(trimmed, 'hex');

    // Pre-check buffer byte length before calling crypto.timingSafeEqual
    if (expectedBuf.length !== providedBuf.length || expectedBuf.length !== 32) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (err) {
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  generateSignature,
  verifySignature
};
