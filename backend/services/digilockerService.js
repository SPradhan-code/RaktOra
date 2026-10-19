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
 * Generates cryptographically secure 43-128 character PKCE code_verifier
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
 * Generates cryptographically secure random 32-byte hex CSRF state token
 */
function generateStateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hashes provider-issued unique identity reference (e.g. digilockerid) using SHA-256.
 * Provides stable deduplication while avoiding plain-text exposure of external identity references.
 */
function hashProviderIdentity(providerSubject) {
  if (!providerSubject || typeof providerSubject !== 'string') {
    return null;
  }
  return crypto.createHash('sha256').update(providerSubject.trim()).digest('hex');
}

/**
 * Checks whether valid production DigiLocker credentials are configured in the environment.
 * Ensures placeholder or empty strings are rejected.
 */
function isDigiLockerConfigured() {
  const clientId = process.env.DIGILOCKER_CLIENT_ID;
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET;

  if (!clientId || !clientSecret) return false;
  const trimmedId = clientId.trim();
  const trimmedSecret = clientSecret.trim();

  // Reject placeholder values
  const placeholders = ['your_client_id_here', 'your_client_secret_here', 'placeholder', 'dummy', 'xxxx'];
  if (placeholders.some(p => trimmedId.toLowerCase().includes(p) || trimmedSecret.toLowerCase().includes(p))) {
    return false;
  }

  return trimmedId.length > 3 && trimmedSecret.length > 5;
}

/**
 * Returns structured status of the DigiLocker integration boundary and onboarding guide.
 * Does not leak secrets.
 */
function getDigiLockerStatus() {
  const configured = isDigiLockerConfigured();
  return {
    configured,
    provider: 'DigiLocker (National Digital Locker System, MeitY, Govt of India)',
    authProtocol: 'OAuth 2.0 Authorization Code Grant with PKCE (S256)',
    onboardingRequirements: [
      '1. Organizational registration at partners.digitallocker.gov.in or apisetu.gov.in',
      '2. Approval from National e-Governance Division (NeGD) / Ministry of Electronics & IT',
      '3. Verified Static IP whitelisting & Domain Ownership verification',
      '4. Production Client ID and Client Secret issuance'
    ],
    zeroCostBoundaryStatus: configured
      ? 'READY_FOR_AUTHENTICATION'
      : 'PENDING_PARTNER_CREDENTIALS',
    message: configured
      ? 'DigiLocker OAuth service is configured.'
      : 'DigiLocker authentication is currently unavailable: pending authorized provider onboarding and credentials. In accordance with zero-cost and strict identity guidelines, mock logins and fake OTPs are disabled.'
  };
}

/**
 * Constructs official DigiLocker OAuth 2.0 Authorization URL with PKCE
 */
function getDigiLockerAuthUrl(state, codeChallenge) {
  if (!isDigiLockerConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'DigiLocker integration is unconfigured. Authorized partner credentials (DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET) are missing.',
      statusDetails: getDigiLockerStatus()
    };
  }

  const clientId = process.env.DIGILOCKER_CLIENT_ID.trim();
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI || 'http://localhost:5000/api/auth/digilocker/callback';
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');

  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'openid'
  }).toString();

  const authUrl = `${baseUrl}/public/oauth2/1/authorize?${query}`;

  return {
    success: true,
    configured: true,
    auth_url: authUrl,
    redirect_uri: redirectUri
  };
}

/**
 * Exchanges authorization code for DigiLocker OAuth access token
 */
async function exchangeDigiLockerCode(code, codeVerifier) {
  if (!isDigiLockerConfigured()) {
    return {
      success: false,
      configured: false,
      error: 'DigiLocker integration is unconfigured. Missing partner credentials.'
    };
  }

  const clientId = process.env.DIGILOCKER_CLIENT_ID.trim();
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET.trim();
  const redirectUri = process.env.DIGILOCKER_REDIRECT_URI || 'http://localhost:5000/api/auth/digilocker/callback';
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');

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
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'RaktOra-Blood-Network/1.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          // Response was non-JSON HTML or error text
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && parsed && parsed.access_token) {
          const rawId = parsed.digilockerid || parsed.sub || (parsed.eaadhaar && parsed.eaadhaar.reference_id) || null;
          const identityHash = rawId ? hashProviderIdentity(rawId) : null;

          resolve({
            success: true,
            access_token: parsed.access_token,
            raw_digilocker_id: rawId,
            identity_hash: identityHash,
            name: parsed.name || 'DigiLocker Verified User',
            dob: parsed.dob || null,
            gender: parsed.gender || null
          });
        } else {
          const errorMsg = parsed?.error_description || parsed?.error || `HTTP ${res.statusCode}`;
          console.error(`[DIGILOCKER TOKEN EXCHANGE ERROR] HTTP ${res.statusCode}:`, errorMsg);
          resolve({
            success: false,
            error: `DigiLocker authorization code exchange failed: ${errorMsg}`
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[DIGILOCKER NETWORK ERROR]:', err.message);
      resolve({ success: false, error: `DigiLocker connection error: ${err.message}` });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'DigiLocker token exchange request timed out.' });
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
        'Accept': 'application/json',
        'User-Agent': 'RaktOra-Blood-Network/1.0'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          // Safe fallback
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, documents: parsed?.items || [] });
        } else {
          resolve({ success: false, error: `DigiLocker documents retrieval failed: HTTP ${res.statusCode}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ success: false, error: 'DigiLocker documents request timed out.' });
    });

    req.end();
  });
}

/**
 * Revokes DigiLocker OAuth token if supported by provider
 */
async function revokeDigiLockerToken(accessToken) {
  if (!accessToken) return { success: true };
  const baseUrl = (process.env.DIGILOCKER_API_BASE_URL || 'https://api.digitallocker.gov.in').replace(/\/$/, '');
  const clientId = process.env.DIGILOCKER_CLIENT_ID ? process.env.DIGILOCKER_CLIENT_ID.trim() : '';

  const postData = new URLSearchParams({
    token: accessToken,
    client_id: clientId
  }).toString();

  const parsedUrl = new URL(`${baseUrl}/public/oauth2/1/revoke`);

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
      resolve({ success: res.statusCode >= 200 && res.statusCode < 300 });
    });

    req.on('error', () => {
      // Fail safely on revocation
      resolve({ success: false });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ success: false });
    });

    req.write(postData);
    req.end();
  });
}

module.exports = {
  isDigiLockerConfigured,
  getDigiLockerStatus,
  generateCodeVerifier,
  generateCodeChallenge,
  generateStateToken,
  hashProviderIdentity,
  getDigiLockerAuthUrl,
  exchangeDigiLockerCode,
  fetchDigiLockerUserDocuments,
  revokeDigiLockerToken
};
