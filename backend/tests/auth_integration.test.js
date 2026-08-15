const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const authRoutes = require('../routes/auth');
const adminRoutes = require('../routes/admin');

describe('🔐 Authentication, Registration & RBAC Integration Suite', () => {
  let app;
  let server;
  let baseUrl;
  let mockUsers;
  let mockDonors;

  before(async () => {
    mockUsers = new Map();
    mockDonors = new Map();
    let autoId = 1;

    // Mock db queries to test auth endpoints reliably without live Aiven dependencies
    db.queryOne = async (sql, params) => {
      if (sql.includes('FROM Users WHERE email = ? OR phone = ?')) {
        const [email, phone] = params;
        for (const u of mockUsers.values()) {
          if (u.email.toLowerCase() === email.toLowerCase() || u.phone === phone) {
            return { ...u };
          }
        }
        return null;
      }
      if (sql.includes('FROM Users WHERE LOWER(email) = ? OR phone = ?')) {
        const [identifier] = params;
        for (const u of mockUsers.values()) {
          if (u.email.toLowerCase() === identifier.toLowerCase() || u.phone === identifier) {
            return { ...u };
          }
        }
        return null;
      }
      if (sql.includes('FROM Donors WHERE user_id = ?')) {
        return mockDonors.get(params[0]) || null;
      }
      return null;
    };

    db.query = async (sql, params) => {
      return [];
    };

    db.execute = async (sql, params) => {
      if (sql.includes('INSERT INTO Users')) {
        const id = autoId++;
        const [fullName, email, hash, phone, role, state, city, pincode] = params;
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
          email_verified: 0,
          phone_verified: 0,
          failed_login_attempts: 0,
          locked_until: null,
          account_status: 'active'
        };
        mockUsers.set(id, u);
        return { insertId: id };
      }
      if (sql.includes('INSERT INTO Donors')) {
        const [userId, bg, age, gender, weight, address, avail, emergencyContact, relationship] = params;
        mockDonors.set(userId, { user_id: userId, blood_group: bg, age, gender, weight, is_available: avail });
        return { insertId: userId };
      }
      if (sql.includes('UPDATE Users SET failed_login_attempts = ?')) {
        return { affectedRows: 1 };
      }
      return { affectedRows: 1 };
    };

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
  });

  test('1. [Successful Registration] Registers a valid donor and returns sanitized user object without password_hash', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Rahul Sharma',
        email: 'rahul.donor@example.com',
        password: 'Password@123',
        phone: '9876543210',
        role: 'donor',
        state: 'Maharashtra',
        city: 'Mumbai',
        pincode: '400001',
        blood_group: 'O+',
        age: 25,
        gender: 'Male',
        weight: 68
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token, 'JWT Token must be generated');
    assert.strictEqual(data.user.email, 'rahul.donor@example.com');
    assert.strictEqual(data.user.password_hash, undefined, 'password_hash must NEVER be exposed');
  });

  test('2. [Duplicate Registration Blocked] Rejects registration if email already exists', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Rahul Duplicate',
        email: 'rahul.donor@example.com',
        password: 'Password@123',
        phone: '9123456789',
        role: 'donor',
        state: 'Maharashtra',
        city: 'Mumbai'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('already registered'));
  });

  test('3. [Password Policy Enforced] Rejects weak passwords during registration', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Weak Pass User',
        email: 'weak@example.com',
        password: '123',
        phone: '9998887776',
        role: 'donor',
        state: 'Delhi',
        city: 'New Delhi'
      })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Password must be at least 8 characters'));
  });

  test('4. [Successful Login] Authenticates registered user with valid credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rahul.donor@example.com',
        password: 'Password@123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token);
    assert.strictEqual(data.user.role, 'donor');
    assert.strictEqual(data.user.password_hash, undefined);
  });

  test('5. [Invalid Password] Rejects authentication with wrong password (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rahul.donor@example.com',
        password: 'WrongPassword@999'
      })
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Invalid email/phone or password'));
  });

  test('6. [Protected Route - Missing Token] Rejects unauthorized access without JWT (401)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Access token required'));
  });

  test('7. [Protected Route - Invalid/Forged Token] Rejects access with tampered token (403)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer forged.fake.jwt.token' }
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Invalid or expired token'));
  });

  test('8. [Role-Based Access Control] Donor cannot access admin dashboard endpoints (403)', async () => {
    const donorToken = jwt.sign(
      { id: 1, email: 'rahul.donor@example.com', role: 'donor', full_name: 'Rahul Sharma' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });

    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Access denied'));
  });
});
