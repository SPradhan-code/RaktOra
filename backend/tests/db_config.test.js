const { test, describe } = require('node:test');
const assert = require('node:assert');

// Require DB configuration helper
const { getDbConfig, getSafeDbDiagnostics } = require('../db');

describe('🛡️ Database Connection Pool Security & Configuration Suite', () => {

  test('1. [SQL Injection Hardening] multipleStatements is explicitly disabled (false) on main connection pool', () => {
    const { connectionConfig } = getDbConfig();
    assert.strictEqual(
      connectionConfig.multipleStatements,
      false,
      'Main application connection pool MUST have multipleStatements set to false to prevent stacked SQL injection attacks'
    );
  });

  test('2. [Connection Limits & Resilience] Pool specifies connection limits and queuing', () => {
    const { connectionConfig } = getDbConfig();
    assert.strictEqual(connectionConfig.waitForConnections, true);
    assert.strictEqual(connectionConfig.connectionLimit, 10);
    assert.strictEqual(connectionConfig.queueLimit, 0);
  });

  test('3. [Safe Diagnostics - Zero Credential Leakage] Diagnostics omit plain passwords', () => {
    const diag = getSafeDbDiagnostics();
    assert.ok(diag.host, 'Diagnostics must include host information');
    assert.strictEqual(diag.password, undefined, 'Diagnostics MUST NEVER expose database passwords');
    assert.ok(diag.sslEnabled === 'YES' || diag.sslEnabled === 'NO', 'Diagnostics must report SSL status');
  });

  test('4. [Aiven Cloud Compatibility] SSL configuration is maintained', () => {
    const { connectionConfig, safeDiagnostics } = getDbConfig();
    assert.ok(connectionConfig.ssl !== undefined, 'SSL configuration property must be present for cloud database compatibility');
    assert.strictEqual(typeof safeDiagnostics.sslEnabled, 'boolean');
  });
});
