const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// Load db and app
const db = require('../db');
const app = require('../server');

describe('🔐 Admin Registration Secret Security Suite', () => {
  let server;
  let baseUrl;

  // Save original env value
  const originalEnvSecret = process.env.ADMIN_REGISTRATION_SECRET;
  const TEST_VALID_ADMIN_SECRET = 'Super_Secure_Test_Admin_Key_2026!#$';

  // In-memory mock database state
  const mockUsers = [];

  // Original db methods to restore
  const origQueryOne = db.queryOne;
  const origQuery = db.query;
  const origExecute = db.execute;

  before(async () => {
    // 1. Mock DB methods with in-memory store
    db.queryOne = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      // Check existing email/phone
      if (cleanSql.includes('FROM Users WHERE email = ? OR phone = ?')) {
        const [email, phone] = params;
        return mockUsers.find(u => u.email === email || u.phone === phone) || null;
      }

      return null;
    };

    db.execute = async (sql, params = []) => {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      if (cleanSql.includes('INSERT INTO Users')) {
        const [fullName, email, passwordHash, phone, role, state, city, pincode] = params;
        const newId = mockUsers.length + 1;
        const newUser = { id: newId, full_name: fullName, email, password_hash: passwordHash, phone, role, state, city, pincode };
        mockUsers.push(newUser);
        return { insertId: newId, affectedRows: 1 };
      }

      if (cleanSql.includes('INSERT INTO audit_logs')) {
        return { insertId: Date.now(), affectedRows: 1 };
      }

      return { affectedRows: 1, insertId: Date.now() };
    };

    // 2. Start test server on ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/auth`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore environment variable and db methods
    process.env.ADMIN_REGISTRATION_SECRET = originalEnvSecret;
    db.queryOne = origQueryOne;
    db.query = origQuery;
    db.execute = origExecute;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  async function registerUser(payload) {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  // ==========================================================================
  // TEST SCENARIOS
  // ==========================================================================

  test('1. [Server Fail-Closed] Admin registration fails with 403 when ADMIN_REGISTRATION_SECRET is unset in env', async () => {
    delete process.env.ADMIN_REGISTRATION_SECRET;

    const res = await registerUser({
      full_name: 'Attempted Admin',
      email: 'admin_unset@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980001',
      role: 'admin',
      state: 'Maharashtra',
      city: 'Mumbai',
      admin_secret: 'ADMIN123'
    });

    assert.strictEqual(res.status, 403, 'Must return 403 when server has no secret configured');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /disabled on this server/i);
  });

  test('2. [Missing Key Rejected] Admin registration fails with 403 when no admin_secret is provided in request', async () => {
    process.env.ADMIN_REGISTRATION_SECRET = TEST_VALID_ADMIN_SECRET;

    const res = await registerUser({
      full_name: 'Missing Secret Admin',
      email: 'admin_missing@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980002',
      role: 'admin',
      state: 'Maharashtra',
      city: 'Mumbai',
      admin_secret: ''
    });

    assert.strictEqual(res.status, 403, 'Must return 403 when admin_secret is missing');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Invalid Admin Security Key/i);
  });

  test('3. [Old Hardcoded Key Rejected] Admin registration fails with 403 when using old default "ADMIN123"', async () => {
    process.env.ADMIN_REGISTRATION_SECRET = TEST_VALID_ADMIN_SECRET;

    const res = await registerUser({
      full_name: 'Old Key Admin',
      email: 'admin_oldkey@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980003',
      role: 'admin',
      state: 'Maharashtra',
      city: 'Mumbai',
      admin_secret: 'ADMIN123'
    });

    assert.strictEqual(res.status, 403, 'Old hardcoded keys must be rejected');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Invalid Admin Security Key/i);
  });

  test('4. [Invalid Key Rejected] Admin registration fails with 403 when wrong admin_secret is provided', async () => {
    process.env.ADMIN_REGISTRATION_SECRET = TEST_VALID_ADMIN_SECRET;

    const res = await registerUser({
      full_name: 'Wrong Key Admin',
      email: 'admin_wrongkey@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980004',
      role: 'admin',
      state: 'Maharashtra',
      city: 'Mumbai',
      admin_secret: 'Incorrect_Secret_Key_Attempt_999'
    });

    assert.strictEqual(res.status, 403, 'Incorrect key must be rejected with 403');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Invalid Admin Security Key/i);
  });

  test('5. [Valid Key Succeeded] Admin registration succeeds with 201 when matching ADMIN_REGISTRATION_SECRET is supplied', async () => {
    process.env.ADMIN_REGISTRATION_SECRET = TEST_VALID_ADMIN_SECRET;

    const res = await registerUser({
      full_name: 'Authorized Admin',
      email: 'valid_admin@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980005',
      role: 'admin',
      state: 'Maharashtra',
      city: 'Mumbai',
      admin_secret: TEST_VALID_ADMIN_SECRET
    });

    assert.strictEqual(res.status, 201, 'Valid secret must succeed with 201 Created');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'admin');
    assert.ok(res.data.token, 'Must return signed JWT token upon registration');
  });

  test('6. [Non-Admin Registration Unaffected] Standard donor registration succeeds without any admin_secret', async () => {
    process.env.ADMIN_REGISTRATION_SECRET = TEST_VALID_ADMIN_SECRET;

    const res = await registerUser({
      full_name: 'Regular Donor',
      email: 'regular_donor@test.com',
      password: 'StrongPassword123!',
      phone: '+91 9898980006',
      role: 'donor',
      state: 'Maharashtra',
      city: 'Mumbai',
      blood_group: 'O+'
    });

    assert.strictEqual(res.status, 201, 'Donor registration must succeed without admin_secret');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'donor');
  });
});
