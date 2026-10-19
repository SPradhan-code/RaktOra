# RaktOra Comprehensive Testing Strategy & Verification Guide

## 1. Quality Assurance Philosophy

RaktOra prioritizes patient safety, data integrity, and strict security compliance. Because the platform operates under a **₹0 budget**, testing is performed using **Node.js built-in native test runner (`node:test` and `node:assert/strict`)**, eliminating costly external testing framework dependencies while delivering fast, deterministic execution.

### Fundamental Testing Rules:
1. **Zero Mock Infiltration into Production**: Mock identities, simulated provider callbacks, and fake users are strictly confined to test suites in `backend/tests/`. Production routes fail closed if credentials are absent.
2. **Automated Concurrency Testing**: Race condition testing on blood unit allocation ensures no single unit of blood is double-allocated during simultaneous hospital emergency requests.
3. **Fail-Closed Verification**: All third-party integration tests must verify that endpoints gracefully return HTTP 503 with actionable onboarding metadata when environment credentials are unset.

---

## 2. Test Suite Architecture & Directory Structure

```
backend/tests/
├── digilocker_auth.test.js       # DigiLocker PKCE, CSRF state, deduplication, claim forgery
├── health_readiness.test.js       # Distinct /health and /ready probes, DB drop simulation
├── feature_flags.test.js          # ENABLE_DIGILOCKER flag behavior
├── fefo_concurrency.test.js       # Concurrency race conditions & FEFO stock allocation
├── db_constraints.test.js         # Age, weight, blood group, & unique reference DB constraints
├── security.test.js               # SQLi prevention, rate limiting, RBAC permission matrix
├── auth.test.js                   # Standard password auth, token issuance, and sessions
├── api.test.js                    # General HTTP API envelope and error compliance
├── donors.test.js                 # Donor profiles, NBTC compliance, and search filters
├── requests.test.js               # Emergency blood requisition lifecycle and matching
├── bloodbanks.test.js             # Blood bank directory and operating hours
├── bloodunits.test.js             # Individual unit testing, quarantine, and expiration
├── stock.test.js                  # Aggregate stock counters and atomic decrements
├── appointments.test.js           # Slot booking and donation completion
├── hospitals.test.js              # Hospital requisition management
├── camps.test.js                  # Voluntary donation camp coordination
├── notifications.test.js          # Proximity alerts and dispatch events
└── offline_queue.test.js          # Local synchronization queue logic
```

---

## 3. Test Suite Details

### 3.1. DigiLocker Authentication Suite (`digilocker_auth.test.js`)
Validates every aspect of the zero-cost DigiLocker integration boundary:
- **`GET /api/auth/digilocker/status`**: Returns unconfigured status with onboarding instructions when credentials are not supplied.
- **Fail-Closed `/initiate`**: Asserts HTTP 503 is returned when `DIGILOCKER_CLIENT_ID` is missing.
- **RFC 7636 PKCE Generation**: Tests that `code_verifier` contains $\ge 43$ high-entropy characters and `code_challenge` matches standard Base64URL-encoded SHA-256 digest.
- **Callback Provider Error Handling**: Asserts graceful redirect to frontend error page when DigiLocker provider returns `access_denied`.
- **CSRF State Validation**: Asserts that tampering with the OAuth `state` parameter immediately triggers a security rejection (`INVALID_STATE`).
- **Claim Token Verification**: Rejects forged registration requests lacking valid backend HMAC-SHA256 signatures.
- **Identity Deduplication**: Verifies that when a valid DigiLocker subject hash already exists in `Users.verification_reference`, attempting to register a second account is blocked.

### 3.2. FEFO & Concurrency Suite (`fefo_concurrency.test.js`)
Simulates 20 concurrent requests competing for the last unit of O-negative PRBC.
- Asserts that exactly 1 request succeeds with `HTTP 200` while 19 requests receive `OUT_OF_STOCK`.
- Asserts that units with earlier expiry dates are allocated before units with later expiry dates.

### 3.3. Database Constraint Verification (`db_constraints.test.js`)
- Rejects donor registration with age < 18 or > 65.
- Rejects donor registration with weight < 45.0 kg.
- Enforces uniqueness of `email` and `verification_reference`.

---

## 4. Running Tests in Windows PowerShell

Ensure you are in the project root or backend directory.

### 4.1. Run Full Backend Test Suite
```powershell
cd d:\RaktOra
node --test backend/tests/*.test.js
```
*Expected Result:*
```
ℹ tests 100
ℹ suites 18
ℹ pass 100
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 452.12
```

### 4.2. Run DigiLocker Test Suite Specifically
```powershell
node --test backend/tests/digilocker_auth.test.js
```

### 4.3. Run Health & Readiness Test Suite Specifically
```powershell
node --test backend/tests/health_readiness.test.js
```

### 4.4. Verify Frontend Production Build
```powershell
cd frontend
npm run build
cd ..
```
*Expected Result:* Clean compilation into `frontend/dist` with 0 syntax or bundle errors.

---

## 5. Mock Isolation Standards

When authoring new tests:
1. Never import mock services into files outside the `tests/` directory.
2. In unit test suites, use Node.js test contexts or dependency-injected test doubles.
3. Clean up all environment variable mutations in test hooks:
   ```javascript
   test.afterEach(() => {
     process.env.DIGILOCKER_CLIENT_ID = originalClientId;
     process.env.DIGILOCKER_CLIENT_SECRET = originalClientSecret;
   });
   ```
