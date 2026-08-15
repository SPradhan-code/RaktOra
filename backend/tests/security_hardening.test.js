const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');

const { getAllowedOrigins, createCorsMiddleware } = require('../middleware/corsConfig');
const { securityHeaders } = require('../middleware/security');
const { validateEnvironment } = require('../config/envValidator');

describe('🛡️ Comprehensive Security Hardening & CORS Suite', () => {

  test('1. [CORS Whitelist Resolution] Whitelists local development ports and parses ALLOWED_ORIGINS env', () => {
    process.env.ALLOWED_ORIGINS = 'https://raktora.onrender.com, https://custom.domain.org';
    process.env.FRONTEND_URL = 'https://app.raktora.com';

    const origins = getAllowedOrigins();

    assert.ok(origins.includes('http://localhost:5173'));
    assert.ok(origins.includes('http://localhost:3000'));
    assert.ok(origins.includes('https://raktora.onrender.com'));
    assert.ok(origins.includes('https://custom.domain.org'));
    assert.ok(origins.includes('https://app.raktora.com'));
  });

  test('2. [CORS Allowed Origin Request] Permitted origin receives Access-Control headers and allows credentials', async () => {
    const app = express();
    app.use(createCorsMiddleware());
    app.get('/test-cors', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-cors`, {
        headers: { 'Origin': 'http://localhost:5173' }
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      assert.strictEqual(res.headers.get('access-control-allow-credentials'), 'true');
    } finally {
      server.close();
    }
  });

  test('3. [CORS Non-Origin / Server-to-Server] Permitted for direct API, mobile, or backend calls', async () => {
    const app = express();
    app.use(createCorsMiddleware());
    app.get('/test-no-origin', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-no-origin`);
      assert.strictEqual(res.status, 200);
    } finally {
      server.close();
    }
  });

  test('4. [Enhanced Security Headers] Sets FrameGuard, HSTS, Referrer, and Permissions policies', async () => {
    const app = express();
    app.use(securityHeaders);
    app.get('/test-sec-headers', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test-sec-headers`);

      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok(res.headers.get('permissions-policy').includes('camera=()'));
      assert.ok(res.headers.get('strict-transport-security').includes('max-age=31536000'));
    } finally {
      server.close();
    }
  });

  test('5. [Environment Validator - Strong Secret Validation] Validates JWT secret configuration', () => {
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'strong_and_secure_jwt_secret_key_12345';
      const result = validateEnvironment();
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    } finally {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  test('6. [Environment Validator - Rejection of Insecure Secrets] Flags known weak/trivial secret values', () => {
    const originalSecret = process.env.JWT_SECRET;
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'admin';
      const result = validateEnvironment();
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('insecure default value')));
    } finally {
      process.env.JWT_SECRET = originalSecret;
      process.env.NODE_ENV = originalEnv;
    }
  });
});
