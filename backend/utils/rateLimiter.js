/**
 * In-Memory Rate Limiter with TTL-based expiration and automated background cleanup.
 *
 * NOTE ON PRODUCTION SCALING:
 * This rate limiter maintains state in memory on a single Node.js process instance.
 * It is optimal and cost-free for single-instance hosting (e.g. Render Free Tier / College deployment).
 *
 * If the application is scaled horizontally across multiple instances / clusters in the future,
 * in-memory state will not be shared across processes. For multi-instance production environments,
 * replace or back this limiter with a shared distributed store such as Redis (e.g., ioredis / rate-limiter-flexible).
 */

class InMemoryRateLimiter {
  /**
   * @param {Object} options
   * @param {number} [options.windowMs=60000] - Time window size in milliseconds
   * @param {number} [options.max=60] - Maximum requests allowed per window
   * @param {number} [options.cleanupIntervalMs=60000] - Interval for automatic background sweeps
   */
  constructor({ windowMs = 60000, max = 60, cleanupIntervalMs = 60000 } = {}) {
    this.windowMs = windowMs;
    this.max = max;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.store = new Map();

    // Single unreferenced background timer for memory cleanup (does not hold event loop open)
    this.cleanupTimer = setInterval(() => {
      this.pruneExpired();
    }, this.cleanupIntervalMs);

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Evaluates and increments the rate limit count for a given key.
   *
   * @param {string} key - Unique identifier (e.g. IP address or user ID)
   * @param {number} [customMax] - Optional custom max count for this check
   * @param {number} [customWindowMs] - Optional custom window size for this check
   * @returns {{ allowed: boolean, count: number, remaining: number, resetTime: number }}
   */
  consume(key, customMax = this.max, customWindowMs = this.windowMs) {
    const now = Date.now();
    const entry = this.store.get(key);

    // If entry does not exist or has expired, start a new window
    if (!entry || now >= entry.expiresAt) {
      const resetTime = now + customWindowMs;
      this.store.set(key, {
        count: 1,
        startTime: now,
        expiresAt: resetTime
      });
      return {
        allowed: true,
        count: 1,
        remaining: Math.max(0, customMax - 1),
        resetTime
      };
    }

    // Existing active window
    entry.count += 1;
    const allowed = entry.count <= customMax;
    const remaining = Math.max(0, customMax - entry.count);

    return {
      allowed,
      count: entry.count,
      remaining,
      resetTime: entry.expiresAt
    };
  }

  /**
   * Sweeps the in-memory Map and removes all expired entries to prevent memory leaks.
   *
   * @returns {number} The count of deleted expired entries
   */
  pruneExpired() {
    const now = Date.now();
    let prunedCount = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        prunedCount++;
      }
    }
    return prunedCount;
  }

  /**
   * Clears all stored entries and terminates the background cleanup interval.
   */
  close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.store.clear();
  }

  /**
   * Number of keys currently tracked in memory.
   */
  get size() {
    return this.store.size;
  }
}

module.exports = {
  InMemoryRateLimiter
};
