const https = require('https');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

/**
 * Base64URL encoding helper (RFC 7636 compliant for PKCE)
 */
function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates cryptographically secure 64-character PKCE code_verifier
 */
function generateCodeVerifier() {
  return base64UrlEncode(crypto.randomBytes(32));
}

/**
 * Generates S256 PKCE code_challenge from code_verifier
 */
function generateCodeChallenge(codeVerifier) {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Generates random hex CSRF state token
 */
function generateStateToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Constructs official DigiLocker OAuth 2.0 Authorization URL
 */
function getDigiLockerAuthUrl(state, codeChallenge) {
  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET;
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI || 'http://localhost:5000/api/auth/digilocker/callback';
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');

  if (!clientId || !clientSecret) {
    if (process.env.DIGILOCKER_DEV_MODE === 'true') {
      console.log('[DIGILOCKER SERVICE - DEV MODE] Client credentials missing, but DIGILOCKER_DEV_MODE=true.');
      return {
        success: true,
        auth_url: `/api/auth/digilocker/dev-callback?state=${state}`,
        devMode: true,
        message: 'DigiLocker Development Mode Enabled'
      };
    }
    console.error('[DIGILOCKER SERVICE CONFIG ERROR] DIGILOCKER_CLIENT_ID or DIGILOCKER_CLIENT_SECRET missing.');
    return {
      success: false,
      error: 'DigiLocker service configuration missing. DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET are required.'
    };
  }

  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  }).toString();

  const authUrl = `${baseUrl}/public/oauth2/1/authorize?${query}`;

  return {
    success: true,
    auth_url: authUrl
  };
}

/**
 * Exchanges authorization code for DigiLocker OAuth access token
 */
async function exchangeDigiLockerCode(code, codeVerifier) {
  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET;
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI || 'http://localhost:5000/api/auth/digilocker/callback';
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');

  if (!clientId || !clientSecret) {
    return { success: false, error: 'DigiLocker service unconfigured. Missing client credentials.' };
  }

  const postData = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  }).toString();

  const parsedUrl = new URL(`${baseUrl}/public/oauth2/1/token`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          // Safe fallback: DigiLocker API response was non-JSON HTML/plain-text
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && parsed && parsed.access_token) {
          resolve({
            success: true,
            access_token: parsed.access_token,
            digilocker_id: parsed.digilockerid || parsed.eaadhaar?.reference_id || null,
            name: parsed.name || 'DigiLocker Verified User'
          });
        } else {
          const errorMsg = parsed?.error_description || parsed?.error || `DigiLocker token HTTP ${res.statusCode}`;
          console.error(`[DIGILOCKER TOKEN ERROR] HTTP ${res.statusCode}:`, body);
          resolve({ success: false, error: `DigiLocker Token Error: ${errorMsg}` });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[DIGILOCKER NETWORK ERROR]:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Retrieves issued document metadata from DigiLocker API
 */
async function fetchDigiLockerUserDocuments(accessToken) {
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');
  const parsedUrl = new URL(`${baseUrl}/public/oauth2/1/file/issued`);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          // Safe fallback: DigiLocker API response was non-JSON HTML/plain-text
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, documents: parsed?.items || [] });
        } else {
          resolve({ success: false, error: `DigiLocker File HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.end();
  });
}

module.exports = {
  generateCodeVerifier,
  generateCodeChallenge,
  generateStateToken,
  getDigiLockerAuthUrl,
  exchangeDigiLockerCode,
  fetchDigiLockerUserDocuments
};
