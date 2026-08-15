const { InMemoryRateLimiter } = require('../utils/rateLimiter');

// In-Memory Rate Limiter for Auth & Sensitive endpoints (60 req/min, 60-sec TTL background sweep)
const authRateLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  cleanupIntervalMs: 60 * 1000
});

/**
 * Security Headers Middleware (Sets XSS, Content-Type, FrameGuard, HSTS, Referrer, and Permissions headers)
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
}

/**
 * Rate Limiter Middleware for Auth & Registration Routes
 */
function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const result = authRateLimiter.consume(ip);

  if (!result.allowed) {
    return res.status(429).json({
      success: false,
      message: 'Too many security requests. Please wait a minute before trying again.'
    });
  }

  next();
}

module.exports = {
  securityHeaders,
  rateLimiter,
  authRateLimiter
};
