const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const app = require('../server');
const db = require('../db');

describe('🩺 Health & Readiness Architecture Test Suite', () => {
  let server;
  let baseUrl;
  const originalQueryOne = db.queryOne;

  before(() => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    db.queryOne = originalQueryOne;
    if (server) server.close();
  });

  test('1. [Liveness - GET /health] Returns 200 OK with status "ok", service name, and timestamp without auth', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'raktora-api');
    assert.ok(data.timestamp);
    assert.strictEqual(typeof data.timestamp, 'string');
    // Ensure no sensitive internal details or credentials are leaked
    assert.strictEqual(data.password, undefined);
    assert.strictEqual(data.dbPassword, undefined);
    assert.strictEqual(data.connectionString, undefined);
  });

  test('2. [Readiness - GET /ready] Returns 200 OK when database dependency is functional', async () => {
    db.queryOne = async () => [{ 1: 1 }];

    const res = await fetch(`${baseUrl}/ready`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'ready');
    assert.strictEqual(data.service, 'raktora-api');
    assert.strictEqual(data.database, 'connected');
    assert.ok(data.timestamp);
    // Ensure no sensitive host or secret leakage
    assert.strictEqual(data.host, undefined);
    assert.strictEqual(data.user, undefined);
  });

  test('3. [Readiness Failure - GET /ready] Returns 503 when database query throws error', async () => {
    db.queryOne = async () => {
      throw new Error('Connection refused (test mock)');
    };

    const res = await fetch(`${baseUrl}/ready`);
    assert.strictEqual(res.status, 503);

    const data = await res.json();
    assert.strictEqual(data.status, 'unready');
    assert.strictEqual(data.service, 'raktora-api');
    assert.strictEqual(data.database, 'unavailable');
    // Ensure no raw exception stack or internal error message is leaked to client
    assert.strictEqual(data.stack, undefined);
    assert.strictEqual(data.message, undefined);
  });

  test('4. [Backward Compatibility - GET /api/health] Returns online status and metadata', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'online');
    assert.ok(data.app.includes('RaktOra'));
    assert.ok(data.timestamp);
  });

  test('5. [API Alias - GET /api/ready] Returns 200 OK matching /ready schema', async () => {
    db.queryOne = async () => [{ 1: 1 }];

    const res = await fetch(`${baseUrl}/api/ready`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'ready');
    assert.strictEqual(data.service, 'raktora-api');
    assert.strictEqual(data.database, 'connected');
  });
});
