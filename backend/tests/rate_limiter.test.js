const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');

const { InMemoryRateLimiter } = require('../utils/rateLimiter');

describe('⏱️ In-Memory Rate Limiter & TTL Eviction Suite', () => {
  let limiter;

  afterEach(() => {
    if (limiter) {
      limiter.close();
      limiter = null;
    }
  });

  test('1. [Allowance within Limit] Allows requests up to max threshold and tracks remaining count', () => {
    limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 3, cleanupIntervalMs: 5000 });

    const r1 = limiter.consume('client_ip_1');
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r1.count, 1);
    assert.strictEqual(r1.remaining, 2);

    const r2 = limiter.consume('client_ip_1');
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r2.count, 2);
    assert.strictEqual(r2.remaining, 1);

    const r3 = limiter.consume('client_ip_1');
    assert.strictEqual(r3.allowed, true);
    assert.strictEqual(r3.count, 3);
    assert.strictEqual(r3.remaining, 0);
  });

  test('2. [Rejection on Threshold Exceeded] Rejects subsequent requests once max is exceeded within window', () => {
    limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 2, cleanupIntervalMs: 5000 });

    limiter.consume('client_ip_2'); // count 1
    limiter.consume('client_ip_2'); // count 2

    const r3 = limiter.consume('client_ip_2'); // count 3 (exceeded)
    assert.strictEqual(r3.allowed, false);
    assert.strictEqual(r3.count, 3);
    assert.strictEqual(r3.remaining, 0);

    const r4 = limiter.consume('client_ip_2'); // count 4 (exceeded)
    assert.strictEqual(r4.allowed, false);
  });

  test('3. [Key Isolation] Different clients track independent rate limit windows', () => {
    limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 2, cleanupIntervalMs: 5000 });

    limiter.consume('client_A');
    limiter.consume('client_A');
    const rA3 = limiter.consume('client_A');
    assert.strictEqual(rA3.allowed, false, 'Client A must be blocked');

    // Client B must still be permitted
    const rB1 = limiter.consume('client_B');
    assert.strictEqual(rB1.allowed, true, 'Client B must be permitted independently');
    assert.strictEqual(rB1.count, 1);
  });

  test('4. [Lazy Window Reset] Automatically resets window for a key after windowMs expires', async () => {
    // 50ms short window
    limiter = new InMemoryRateLimiter({ windowMs: 50, max: 1, cleanupIntervalMs: 5000 });

    const r1 = limiter.consume('client_expire_test');
    assert.strictEqual(r1.allowed, true);

    const r2 = limiter.consume('client_expire_test');
    assert.strictEqual(r2.allowed, false);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 60));

    const r3 = limiter.consume('client_expire_test');
    assert.strictEqual(r3.allowed, true, 'Request after window expiration must be allowed');
    assert.strictEqual(r3.count, 1);
  });

  test('5. [TTL Memory Sweep & Eviction] pruneExpired() safely frees expired keys from memory map', async () => {
    limiter = new InMemoryRateLimiter({ windowMs: 50, max: 5, cleanupIntervalMs: 5000 });

    limiter.consume('expired_client_1');
    limiter.consume('expired_client_2');
    assert.strictEqual(limiter.size, 2);

    // Wait for entries to expire
    await new Promise(r => setTimeout(r, 60));

    // Add active entry with longer custom window (5000ms)
    limiter.consume('active_client', 5, 5000);
    assert.strictEqual(limiter.size, 3);

    // Run sweep
    const prunedCount = limiter.pruneExpired();
    assert.strictEqual(prunedCount, 2, 'Exactly 2 expired entries must be pruned');
    assert.strictEqual(limiter.size, 1, 'Only 1 active entry must remain in store');
    assert.ok(limiter.store.has('active_client'), 'Active client key must be preserved');
  });

  test('6. [Graceful Shutdown & Timer Unref] close() clears store and cleans up timer', () => {
    limiter = new InMemoryRateLimiter({ windowMs: 1000, max: 5, cleanupIntervalMs: 1000 });
    limiter.consume('shutdown_client');
    assert.strictEqual(limiter.size, 1);

    limiter.close();
    assert.strictEqual(limiter.size, 0, 'Store must be empty after close()');
  });
});
