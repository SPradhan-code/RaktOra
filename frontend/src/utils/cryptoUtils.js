/**
 * Security & Input Validation Helpers
 */

/**
 * Returns plain data without payload encryption.
 */
export async function encryptPayload(data) {
  return data;
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
