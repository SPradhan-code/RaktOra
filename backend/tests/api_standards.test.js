const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const app = require('../server');

describe('🌐 API Standards, Health & Response Formatting Suite', () => {
  let server;
  let baseUrl;

  before(() => {
    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    if (server) server.close();
  });

  test('1. [Health Check Endpoint] GET /api/health returns status 200 and online metadata', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.status, 'online');
    assert.ok(data.app.includes('RaktOra'));
    assert.ok(data.database.includes('Aiven'));
    assert.ok(data.timestamp);
  });

  test('2. [Public Features Discovery] GET /api/features returns standard boolean feature set', async () => {
    const res = await fetch(`${baseUrl}/api/features`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(typeof data.features.enableSmsOtp, 'boolean');
    assert.strictEqual(typeof data.features.enableEmailOtp, 'boolean');
    assert.strictEqual(typeof data.features.enableDigilocker, 'boolean');
    assert.strictEqual(typeof data.features.enableGovtIdentityVerification, 'boolean');
    assert.strictEqual(typeof data.features.enableGeocoding, 'boolean');
  });

  test('3. [Structured 404 Response] Requesting unknown route returns clean JSON 404 without leaking server stack', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-endpoint-${Date.now()}`);
    assert.strictEqual(res.status, 404);

    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('Route Not Found'));
  });
});
