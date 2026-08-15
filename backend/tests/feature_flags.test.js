const { test, describe } = require('node:test');
const assert = require('node:assert');

const features = require('../config/features');

describe('🚩 Centralized Feature Flags & Integration Gating Suite', () => {

  test('1. [Secure Defaults] All optional external integrations default to false (disabled)', () => {
    // Fresh check without env overrides
    assert.strictEqual(features.ENABLE_SMS_OTP, false, 'SMS OTP must default to false');
    assert.strictEqual(features.ENABLE_EMAIL_OTP, false, 'Email OTP must default to false');
    assert.strictEqual(features.ENABLE_DIGILOCKER, false, 'DigiLocker must default to false');
    assert.strictEqual(features.ENABLE_GOVT_IDENTITY_VERIFICATION, false, 'Govt ID verification must default to false');
    assert.strictEqual(features.ENABLE_GEOCODING, false, 'Geocoding must default to false');
  });

  test('2. [Public Features Sanitization] getPublicFeatures() returns safe booleans with zero secret exposure', () => {
    const publicFeatures = features.getPublicFeatures();
    
    assert.ok(publicFeatures, 'Public features object must exist');
    assert.strictEqual(typeof publicFeatures.enableSmsOtp, 'boolean');
    assert.strictEqual(typeof publicFeatures.enableEmailOtp, 'boolean');
    assert.strictEqual(typeof publicFeatures.enableDigilocker, 'boolean');
    assert.strictEqual(typeof publicFeatures.enableGovtIdentityVerification, 'boolean');
    assert.strictEqual(typeof publicFeatures.enableGeocoding, 'boolean');

    // Ensure no sensitive keys are leaked
    assert.strictEqual(publicFeatures.RESEND_API_KEY, undefined);
    assert.strictEqual(publicFeatures.MSG91_AUTH_KEY, undefined);
    assert.strictEqual(publicFeatures.DIGILOCKER_CLIENT_SECRET, undefined);
    assert.strictEqual(publicFeatures.JWT_SECRET, undefined);
  });

  test('3. [Feature Check Helper] isEnabled() returns accurate boolean state', () => {
    assert.strictEqual(features.isEnabled('ENABLE_SMS_OTP'), false);
    assert.strictEqual(features.isEnabled('NON_EXISTENT_FEATURE'), false);
  });

  test('4. [Email OTP Gating] Calling send-email-otp when disabled returns 400 with standard disabled message', async () => {
    const express = require('express');
    const authRoutes = require('../routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/send-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'donor@example.com' })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.enabled, false);
      assert.strictEqual(data.message, 'This integration is not enabled in the current deployment.');
    } finally {
      server.close();
    }
  });

  test('5. [SMS OTP Gating] Calling send-phone-otp when disabled returns 400 with standard disabled message', async () => {
    const express = require('express');
    const authRoutes = require('../routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/send-phone-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210' })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.enabled, false);
      assert.strictEqual(data.message, 'This integration is not enabled in the current deployment.');
    } finally {
      server.close();
    }
  });

  test('6. [DigiLocker Gating] Calling digilocker/initiate when disabled returns 400 with standard disabled message', async () => {
    const express = require('express');
    const authRoutes = require('../routes/auth');

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/digilocker/initiate`);

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.enabled, false);
      assert.strictEqual(data.message, 'This integration is not enabled in the current deployment.');
    } finally {
      server.close();
    }
  });
});
