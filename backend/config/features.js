/**
 * Centralized Feature Configuration Module
 *
 * Controls optional external integrations, third-party APIs, and government identity services.
 * All optional integrations default to FALSE (disabled) unless explicitly enabled in environment variables.
 */

function parseBooleanEnv(val, defaultVal = false) {
  if (val === undefined || val === null || val === '') return defaultVal;
  const clean = String(val).trim().toLowerCase();
  return clean === 'true' || clean === '1';
}

const features = {
  // SMS Service (e.g. MSG91 Indian SMS Gateway)
  ENABLE_SMS_OTP: parseBooleanEnv(process.env.ENABLE_SMS_OTP, false),

  // Transactional Email Service (e.g. Resend API)
  ENABLE_EMAIL_OTP: parseBooleanEnv(process.env.ENABLE_EMAIL_OTP, false),

  // Official DigiLocker OAuth 2.0 Integration
  ENABLE_DIGILOCKER: parseBooleanEnv(process.env.ENABLE_DIGILOCKER, false),

  // Government Offline Identity / Aadhaar e-KYC Verification
  ENABLE_GOVT_IDENTITY_VERIFICATION: parseBooleanEnv(process.env.ENABLE_GOVT_IDENTITY_VERIFICATION, false),

  // External Geocoding & Maps API Provider
  ENABLE_GEOCODING: parseBooleanEnv(process.env.ENABLE_GEOCODING, false),

  /**
   * Helper to check if a specific feature flag is currently active
   * @param {string} flag
   * @returns {boolean}
   */
  isEnabled(flag) {
    return !!this[flag];
  },

  /**
   * Returns a sanitized dictionary of enabled features safe to expose publicly.
   * NEVER exposes API keys, tokens, or sensitive credentials.
   */
  getPublicFeatures() {
    return {
      enableSmsOtp: this.ENABLE_SMS_OTP,
      enableEmailOtp: this.ENABLE_EMAIL_OTP,
      enableDigilocker: this.ENABLE_DIGILOCKER,
      enableGovtIdentityVerification: this.ENABLE_GOVT_IDENTITY_VERIFICATION,
      enableGeocoding: this.ENABLE_GEOCODING
    };
  }
};

module.exports = features;
