const cors = require('cors');

/**
 * Parses and returns the list of allowed frontend origins for CORS.
 * Supports Render deployment URLs, custom domains, and local development ports.
 */
function getAllowedOrigins() {
  const defaultLocalOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];

  const envOrigins = [];

  // Parse comma-separated ALLOWED_ORIGINS (e.g. "https://raktora.onrender.com,https://mycustomdomain.com")
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(origin => {
      const trimmed = origin.trim().replace(/\/$/, '');
      if (trimmed) envOrigins.push(trimmed);
    });
  }

  // Parse FRONTEND_URL if provided
  if (process.env.FRONTEND_URL) {
    const trimmed = process.env.FRONTEND_URL.trim().replace(/\/$/, '');
    if (trimmed && !envOrigins.includes(trimmed)) {
      envOrigins.push(trimmed);
    }
  }

  // Parse RENDER_EXTERNAL_URL if provided (automatic Render service origin)
  if (process.env.RENDER_EXTERNAL_URL) {
    const trimmed = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
    if (trimmed && !envOrigins.includes(trimmed)) {
      envOrigins.push(trimmed);
    }
  }

  return Array.from(new Set([...defaultLocalOrigins, ...envOrigins]));
}

/**
 * Creates dynamic CORS middleware suitable for Render deployment and local development.
 */
function createCorsMiddleware() {
  const allowedOrigins = getAllowedOrigins();

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server, same-origin)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/$/, '');

      // In non-production environments, be flexible for local development
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // In production, check against explicitly configured allowed origins
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // Block unapproved cross-origin requests
      const error = new Error(`CORS policy: Origin ${origin} is not allowed access.`);
      error.statusCode = 403;
      return callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie']
  });
}

module.exports = {
  getAllowedOrigins,
  createCorsMiddleware
};
