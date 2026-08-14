const { decrypt, verifySignature } = require('../utils/encryption');

// Simple Rate Limiting Map (IP -> { count, startTime })
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 60; // 60 req/min limit for auth & sensitive routes

/**
 * Security Headers Middleware (Sets XSS, Content-Type, FrameGuard, HSTS headers)
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  next();
}

/**
 * Rate Limiter Middleware for Auth & Registration Routes
 */
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  if (now - record.startTime > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, startTime: now });
    return next();
  }

  record.count += 1;
  if (record.count > MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      message: 'Too many security requests. Please wait a minute before trying again.'
    });
  }

  next();
}

/**
 * Middleware to decrypt incoming encrypted payloads if present
 */
function decryptIncomingPayload(req, res, next) {
  if (req.body && req.body._encryptedPayload) {
    try {
      const decryptedJson = decrypt(req.body._encryptedPayload);
      const parsed = JSON.parse(decryptedJson);
      req.body = { ...parsed, ...req.body };
      delete req.body._encryptedPayload;
    } catch (err) {
      console.warn('Failed to decrypt incoming payload, proceeding with body');
    }
  }
  next();
}

module.exports = {
  securityHeaders,
  rateLimiter,
  decryptIncomingPayload
};
