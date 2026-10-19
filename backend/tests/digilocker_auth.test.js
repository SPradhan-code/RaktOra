const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const features = require('../config/features');
const digilockerService = require('../services/digilockerService');

describe('🇮🇳 Genuine DigiLocker Authentication & Zero-Cost Boundary Suite', () => {
  let app;
  let server;
  let baseUrl;
  let mockUsers;

  const originalClientId = process.env.DIGILOCKER_CLIENT_ID;
  const originalClientSecret = process.env.DIGILOCKER_CLIENT_SECRET;
  const originalEnableDigiLocker = features.ENABLE_DIGILOCKER;

  before(() => {
    mockUsers = new Map();

    db.queryOne = async (sql, params) => {
      if (sql.includes('verification_provider = "DIGILOCKER" AND verification_reference = ?')) {
        const [ref] = params;
        for (const u of mockUsers.values()) {
          if (u.verification_provider === 'DIGILOCKER' && u.verification_reference === ref) {
            return { ...u };
          }
        }
        return null;
      }
      if (sql.includes('FROM Users WHERE email = ? OR phone = ?')) {
        const [email, phone] = params;
        for (const u of mockUsers.values()) {
          if (u.email.toLowerCase() === email.toLowerCase() || u.phone === phone) {
            return { ...u };
          }
        }
        return null;
      }
      return null;
    };

    db.execute = async (sql, params) => {
      if (sql.includes('INSERT INTO Users')) {
        const id = mockUsers.size + 1;
        const [
          fullName, email, hash, phone, role, state, city, pincode,
          isEmailVerified, isPhoneVerified, isAadhaarVerified, isDigiLockerVerified,
          emailAt, phoneAt, aadhaarAt, digilockerAt,
          providerName, providerRef
        ] = params;

        const u = {
          id,
          full_name: fullName,
          email: email.toLowerCase(),
          password_hash: hash,
          phone,
          role,
          state,
          city,
          pincode,
          is_verified: 1,
          email_verified: isEmailVerified,
          phone_verified: isPhoneVerified,
          aadhaar_verified: isAadhaarVerified,
          digilocker_verified: isDigiLockerVerified,
          verification_provider: providerName,
          verification_reference: providerRef,
          account_status: 'active'
        };
        mockUsers.set(id, u);
        return { insertId: id };
      }
      if (sql.includes('INSERT INTO Donors')) {
        return { insertId: 1 };
      }
      return { affectedRows: 1 };
    };

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    process.env.DIGILOCKER_CLIENT_ID = originalClientId;
    process.env.DIGILOCKER_CLIENT_SECRET = originalClientSecret;
    features.ENABLE_DIGILOCKER = originalEnableDigiLocker;
    if (server) server.close();
  });

  test('1. [Public Status Endpoint] GET /api/auth/digilocker/status returns boundary and onboarding guide without exposing secrets', async () => {
    const res = await fetch(`${baseUrl}/api/auth/digilocker/status`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.onboardingRequirements));
    assert.ok(data.onboardingRequirements.length >= 3);
    assert.strictEqual(data.client_secret, undefined);
    assert.strictEqual(data.secret, undefined);
  });

  test('2. [Zero-Cost Boundary Enforcement] GET /api/auth/digilocker/initiate fails with 503 when credentials are unconfigured', async () => {
    features.ENABLE_DIGILOCKER = true;
    delete process.env.DIGILOCKER_CLIENT_ID;
    delete process.env.DIGILOCKER_CLIENT_SECRET;

    const res = await fetch(`${baseUrl}/api/auth/digilocker/initiate`);
    assert.strictEqual(res.status, 503);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.configured, false);
    assert.ok(data.message.includes('pending authorized provider access'));
    // Ensure no fake/mock callback is issued
    assert.strictEqual(data.auth_url, undefined);
    assert.strictEqual(data.devMode, undefined);
  });

  test('3. [Genuine PKCE Generation] Generates S256 code challenge and official authorize URL when configured', async () => {
    features.ENABLE_DIGILOCKER = true;
    process.env.DIGILOCKER_CLIENT_ID = 'test_partner_client_id_2026';
    process.env.DIGILOCKER_CLIENT_SECRET = 'test_partner_client_secret_xyz';

    const res = await fetch(`${baseUrl}/api/auth/digilocker/initiate`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.configured, true);
    assert.ok(data.auth_url);
    assert.ok(data.auth_url.includes('response_type=code'));
    assert.ok(data.auth_url.includes('code_challenge_method=S256'));
    assert.ok(data.auth_url.includes('client_id=test_partner_client_id_2026'));
    assert.ok(data.state);
  });

  test('4. [Callback Provider Error Handling] User consent denial or provider error redirects safely to /login', async () => {
    features.ENABLE_DIGILOCKER = true;
    process.env.DIGILOCKER_CLIENT_ID = 'test_partner_client_id_2026';
    process.env.DIGILOCKER_CLIENT_SECRET = 'test_partner_client_secret_xyz';

    const res = await fetch(`${baseUrl}/api/auth/digilocker/callback?error=access_denied&error_description=User+cancelled`, {
      redirect: 'manual'
    });

    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.includes('/login?digilocker_error='));
    assert.ok(location.includes('User'));
  });

  test('5. [CSRF State Validation] Callback with unknown or forged state token is rejected', async () => {
    features.ENABLE_DIGILOCKER = true;
    process.env.DIGILOCKER_CLIENT_ID = 'test_partner_client_id_2026';
    process.env.DIGILOCKER_CLIENT_SECRET = 'test_partner_client_secret_xyz';

    const res = await fetch(`${baseUrl}/api/auth/digilocker/callback?code=mock_auth_code_123&state=forged_state_token`, {
      redirect: 'manual'
    });

    assert.strictEqual(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.includes('/login?digilocker_error='));
    assert.ok(location.includes('Invalid') || location.includes('expired'));
  });

  test('6. [Forged Verification Claim Blocked] Registering with digilocker_claim containing invalid signature is rejected', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Imposter User',
        email: 'imposter@example.com',
        password: 'Password@123',
        phone: '9988776655',
        role: 'donor',
        state: 'Maharashtra',
        city: 'Mumbai',
        digilocker_claim: 'forged.invalid.jwt.token'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Invalid or expired DigiLocker verification'));
  });

  test('7. [Genuine Verified Claim Registration] User with backend-signed claim registers as digilocker_verified', async () => {
    const validClaim = jwt.sign(
      {
        type: 'DIGILOCKER_VERIFIED_CLAIM',
        identity_hash: 'c8742b6a715893d9e33ef726a4571932f913d8b5840dfef78b277d3f8f117a23',
        holder_name: 'Ananya Deshmukh',
        verified: true
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Ananya Deshmukh',
        email: 'ananya.verified@example.com',
        password: 'Password@123',
        phone: '9876543211',
        role: 'donor',
        state: 'Maharashtra',
        city: 'Pune',
        pincode: '411001',
        digilocker_claim: validClaim
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.full_name, 'Ananya Deshmukh');

    // Confirm that the user record in database is marked digilocker_verified with provider reference
    const savedUser = Array.from(mockUsers.values()).find(u => u.email === 'ananya.verified@example.com');
    assert.ok(savedUser);
    assert.strictEqual(savedUser.digilocker_verified, 1);
    assert.strictEqual(savedUser.verification_provider, 'DIGILOCKER');
    assert.strictEqual(savedUser.verification_reference, 'c8742b6a715893d9e33ef726a4571932f913d8b5840dfef78b277d3f8f117a23');
  });

  test('8. [Deduplication Enforcement] Duplicate registration with the same DigiLocker identity is rejected', async () => {
    const duplicateClaim = jwt.sign(
      {
        type: 'DIGILOCKER_VERIFIED_CLAIM',
        identity_hash: 'c8742b6a715893d9e33ef726a4571932f913d8b5840dfef78b277d3f8f117a23', // Same identity hash
        holder_name: 'Ananya Clone',
        verified: true
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Ananya Clone',
        email: 'ananya.clone@example.com',
        password: 'Password@123',
        phone: '9876543299', // Different phone number!
        role: 'donor',
        state: 'Maharashtra',
        city: 'Pune',
        digilocker_claim: duplicateClaim
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('already registered with this DigiLocker identity'));
  });
});
