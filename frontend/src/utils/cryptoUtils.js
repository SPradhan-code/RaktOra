// Client-side End-to-End Encryption & Security Utility using Web Crypto API

const E2E_SECRET = 'bloodconnect_e2e_secret_key_2026';

/**
 * Generates an HMAC-SHA256 signature for outgoing payload verification
 */
export async function generateClientSignature(payload) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(E2E_SECRET);
    const messageData = encoder.encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    return '';
  }
}

/**
 * Encrypts sensitive payload using AES-256-GCM prior to network dispatch
 */
export async function encryptPayload(data) {
  try {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(jsonString);

    // Derive 256-bit AES key from secret
    const keyMaterial = await window.crypto.subtle.digest('SHA-256', encoder.encode(E2E_SECRET));
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encodedData
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(encryptedBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    return {
      _encrypted: true,
      iv: ivHex,
      cipher: cipherHex,
      signature: await generateClientSignature(jsonString)
    };
  } catch (err) {
    return data;
  }
}

/**
 * Validates Aadhaar format (12 digits)
 */
export function validateAadhaarFormat(aadhaar) {
  if (!aadhaar) return false;
  const clean = aadhaar.toString().replace(/[\s-]/g, '');
  return /^\d{12}$/.test(clean);
}

/**
 * Validates Drug License format
 */
export function validateLicenseFormat(license) {
  if (!license) return false;
  return license.toString().trim().length >= 6;
}
