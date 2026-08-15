const path = require('path');
const fs = require('fs');

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const backendEnvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

const { validateEnvironment } = require('./config/envValidator');
validateEnvironment();

const db = require('./db');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { securityHeaders, rateLimiter } = require('./middleware/security');
const { createCorsMiddleware } = require('./middleware/corsConfig');

const authRoutes = require('./routes/auth');
const donorRoutes = require('./routes/donors');
const requestRoutes = require('./routes/requests');
const bankRoutes = require('./routes/bloodbanks');
const campRoutes = require('./routes/camps');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const hospitalRoutes = require('./routes/hospitals');
const unitRoutes = require('./routes/bloodunits');
const appointmentRoutes = require('./routes/appointments');
const docsRoutes = require('./routes/docs');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS, Security Headers & JSON Parsing
app.use(createCorsMiddleware());
app.use(securityHeaders);
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', rateLimiter, authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/bloodbanks', bankRoutes);
app.use('/api/camps', campRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/bloodunits', unitRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/docs', docsRoutes);

const features = require('./config/features');

// Public Feature Flags Discovery Endpoint (Safe, no secrets exposed)
app.get('/api/features', (req, res) => {
  res.json({
    success: true,
    features: features.getPublicFeatures()
  });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'RaktOra National Voluntary Blood Network REST API',
    database: 'MySQL / MariaDB (Aiven Connected)',
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend Static Build
const frontendBuildPath = path.join(__dirname, '../frontend/dist');
const indexHtmlPath = path.join(frontendBuildPath, 'index.html');

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(frontendBuildPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(indexHtmlPath, (err) => {
      if (err) {
        next(err);
      }
    });
  });
} else {
  // If frontend build is missing, serve friendly API welcome page on root route
  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      message: 'RaktOra REST API Service is running.',
      frontend: 'Frontend dist not found. Build command: npm run build',
      healthCheck: '/api/health'
    });
  });
}

// Centralized Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RaktOra REST API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
