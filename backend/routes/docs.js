const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const openapiPath = path.resolve(__dirname, '../docs/openapi.json');
let openapiSpec = null;

try {
  if (fs.existsSync(openapiPath)) {
    openapiSpec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
  }
} catch (e) {
  console.error('[OPENAPI LOAD ERROR]:', e.message);
}

// 1. Raw OpenAPI 3.0 JSON specification endpoint
router.get('/swagger.json', (req, res) => {
  if (!openapiSpec) {
    return res.status(500).json({ success: false, message: 'OpenAPI specification not found.' });
  }
  res.setHeader('Content-Type', 'application/json');
  return res.json(openapiSpec);
});

// 2. Interactive Swagger UI HTML Page
router.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RaktOra REST API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.11.0/favicon-32x32.png" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #fafafa;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .topbar {
      display: none;
    }
    .swagger-ui .info .title {
      color: #e11d48;
      font-weight: 800;
    }
    .header-banner {
      background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
      color: white;
      padding: 20px 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
    }
    .header-banner h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header-banner p {
      margin: 4px 0 0 0;
      font-size: 13px;
      opacity: 0.9;
    }
    .header-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>🩸 RaktOra Developer API</h1>
      <p>National Voluntary Blood Network & Smart FEFO Inventory Engine</p>
    </div>
    <div class="header-badge">OpenAPI 3.0.3</div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/docs/swagger.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.send(html);
});

module.exports = router;
