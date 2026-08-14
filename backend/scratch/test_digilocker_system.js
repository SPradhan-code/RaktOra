const {
  generateCodeVerifier,
  generateCodeChallenge,
  generateStateToken,
  getDigiLockerAuthUrl
} = require('../services/digilockerService');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('    RaktOra DigiLocker OAuth 2.0 Verification Test Suite       ');
console.log('================================================================\n');

// TEST GROUP 1: PKCE & State Generation
const verifier = generateCodeVerifier();
const challenge = generateCodeChallenge(verifier);
const state = generateStateToken();

assert(typeof verifier === 'string' && verifier.length >= 43, 'Generate RFC 7636 compliant PKCE code_verifier');
assert(typeof challenge === 'string' && challenge.length > 0, 'Generate SHA-256 PKCE code_challenge');
assert(typeof state === 'string' && state.length === 32, 'Generate 32-hex character CSRF state token');

// TEST GROUP 2: Unconfigured Credentials Handling (DIGILOCKER_DEV_MODE=false)
process.env.DIGILOCKER_DEV_MODE = 'false';
delete process.env.DIGILOCKER_CLIENT_ID;
delete process.env.DIGILOCKER_CLIENT_SECRET;

const unconfigRes = getDigiLockerAuthUrl(state, challenge);
assert(unconfigRes.success === false, 'Returns success=false when DIGILOCKER_CLIENT_ID is missing');
assert(unconfigRes.error && unconfigRes.error.includes('DigiLocker service configuration missing'), 'Provides clear error message when credentials are unconfigured');

// TEST GROUP 3: Controlled Development Mode Handling (DIGILOCKER_DEV_MODE=true)
process.env.DIGILOCKER_DEV_MODE = 'true';
const devRes = getDigiLockerAuthUrl(state, challenge);
assert(devRes.success === true && devRes.devMode === true, 'Allows controlled development mode callback when DIGILOCKER_DEV_MODE=true');
assert(devRes.auth_url && devRes.auth_url.includes('/api/auth/digilocker/dev-callback'), 'Dev mode returns dev-callback auth URL');

// TEST GROUP 4: Configured OAuth Authorization URL Construction
process.env.DIGILOCKER_DEV_MODE = 'false';
process.env.DIGILOCKER_CLIENT_ID = 'test_client_id_123';
process.env.DIGILOCKER_CLIENT_SECRET = 'test_client_secret_xyz';
process.env.DIGILOCKER_REDIRECT_URI = 'http://localhost:5000/api/auth/digilocker/callback';
process.env.DIGILOCKER_API_BASE_URL = 'https://api.digitallocker.gov.in';

const validAuthRes = getDigiLockerAuthUrl(state, challenge);
assert(validAuthRes.success === true, 'Returns success=true when valid credentials are provided');
assert(validAuthRes.auth_url && validAuthRes.auth_url.startsWith('https://api.digitallocker.gov.in/public/oauth2/1/authorize'), 'Constructs official DigiLocker authorization URL');
assert(validAuthRes.auth_url.includes('client_id=test_client_id_123'), 'Includes client_id parameter');
assert(validAuthRes.auth_url.includes('code_challenge_method=S256'), 'Includes PKCE S256 challenge method');

console.log('\n================================================================');
console.log(` SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log('================================================================\n');

process.exit(failed > 0 ? 1 : 0);
