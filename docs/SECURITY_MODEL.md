# RaktOra Security Model & Threat Mitigation Guide

## 1. Security Philosophy & Principles

RaktOra is engineered as an emergency healthcare coordination system where data integrity, availability, and identity veracity are paramount. Because RaktOra operates on a strict **₹0 budget**, its security architecture cannot depend on commercial Web Application Firewalls (Cloudflare Enterprise, AWS Shield) or paid identity verification APIs. Instead, security is baked into the application layer through:

1. **Fail-Closed Architecture**: Any unconfigured or ambiguous external integration (e.g., missing DigiLocker credentials) rejects requests with unambiguous error states (HTTP 503) rather than degrading into insecure mock fallbacks.
2. **Cryptographic Identity Grounding**: Genuine government identity tokens (DigiLocker OAuth 2.0) are verified end-to-end on the backend with PKCE and signed JWTs.
3. **Data Minimization (Zero Raw PII Storage)**: No raw Aadhaar numbers, PAN cards, or government identity numbers are ever stored in the database.
4. **Defense in Depth**: Multiple overlapping layers of validation (rate limiting, parameterized queries, RBAC, input sanitization, CSRF tokenization, audit ledgers).

---

## 2. Threat Modeling & Mitigations

| Threat | Risk Level | Attack Vector | Application-Layer Mitigation |
| :--- | :--- | :--- | :--- |
| **DigiLocker Claim Forgery** | Critical | Attacker submits fabricated `digilocker_verified: true` flag in registration payload. | Backend ignores client-provided verification flags. Verification requires a cryptographically signed HMAC-SHA256 JWT claim token generated strictly by the backend's `/api/auth/digilocker/callback` endpoint. |
| **OAuth 2.0 Authorization Code Interception** | High | Code intercepted in transit or via URI redirection. | **RFC 7636 PKCE (Proof Key for Code Exchange)** with SHA-256 (`S256`). A cryptographically random `code_verifier` is stored server-side/in-session and must match the `code_challenge` during backend token exchange. |
| **CSRF in OAuth Handshake** | High | Attacker induces user to complete an authorization flow initiated by the attacker. | High-entropy random `state` parameter generated using `crypto.randomBytes(32)` passed in authorization request and verified on callback. |
| **Identity Duplication / Sybil Attacks** | High | Malicious user creates 50 accounts to hoard or manipulate emergency blood requests. | When verified via DigiLocker, the provider-issued subject (`digilockerid`) is cryptographically hashed: $\text{Hash} = \text{SHA256}(\text{digilockerid})$. The database enforces uniqueness against (`verification_provider`, `verification_reference`). Duplicate verification is rejected. |
| **Credential Brute Force** | High | Automated credential stuffing against `/api/auth/login`. | In-memory sliding window rate limiter limits authentication endpoints to 10 attempts per minute per IP. Stale buckets are pruned via TTL sweep. |
| **SQL Injection (SQLi)** | Critical | Tainted user input passed into database queries. | 100% prepared statements via `mysql2/promise` with parameterized queries (`?`). Raw string concatenation in SQL queries is strictly banned. |
| **Cross-Site Scripting (XSS)** | High | Injection of script tags into emergency request hospital names or patient notes. | React automated JSX escaping on the client, strict JSON API serialization on the backend, and input trimming/sanitization. |
| **Privilege Escalation** | Critical | Regular donor crafts request to access admin inventory endpoints. | Stateless RBAC middleware (`authenticateToken` + `authorizeRole(...)`) strictly verifies signed JWT claims on every protected API route. |
| **Forensic Tampering** | Medium | Malicious insider modifies stock or donation history to cover theft. | Immutable `audit_logs` table logs actor IP, action, resource, timestamp, and status. Audit records have no `UPDATE` or `DELETE` API endpoints. |

---

## 3. DigiLocker OAuth 2.0 & PKCE Implementation Flow

RaktOra strictly adheres to the official DigiLocker Partner API specification (National Informatics Centre / NeGD).

```
[ Citizen Browser ]         [ RaktOra Backend ]           [ DigiLocker Auth Server ]
         |                          |                                 |
  1. Click "DigiLocker Login"       |                                 |
         |------------------------->|                                 |
         |   GET /auth/digilocker/  |                                 |
         |       initiate           | Generate PKCE (verifier,        |
         |                          | challenge) & CSRF state         |
         |                          | Store verifier & state in cache |
         |<-------------------------|                                 |
         | 302 Redirect to DigiLocker Auth URL with challenge & state |
         |                                                            |
         |----------------------------------------------------------->|
         |       Citizen logs in via official DigiLocker portal       |
         |       Citizen consents to share verified profile           |
         |<-----------------------------------------------------------|
         | 302 Redirect to RaktOra Callback URL with code & state     |
         |                                                            |
  2. Hit /auth/digilocker/callback  |                                 |
         |------------------------->|                                 |
         |                          | Validate state parameter        |
         |                          | Exchange code + verifier ------>|
         |                          |                                 | (Direct TLS Server-to-Server)
         |                          |<--------------------------------|
         |                          | Return access_token & id_token  |
         |                          | Retrieve citizen claims         |
         |                          | Compute SHA256(digilockerid)    |
         |                          | Check DB for existing account   |
         |                          | - If exists: Issue RaktOra JWT  |
         |                          | - If new: Issue 15m claim JWT   |
         |<-------------------------|                                 |
  3. Redirect to /login or /register|                                 |
     with secure token              |                                 |
```

### Critical Security Constraints:
1. **No Client-Side Secrets**: `DIGILOCKER_CLIENT_SECRET` resides strictly in backend environment variables and is never transmitted to the browser.
2. **Zero Fake Fallbacks**: If `DIGILOCKER_CLIENT_ID` or `DIGILOCKER_CLIENT_SECRET` are unset, `/initiate` immediately fails with `HTTP 503 Service Unavailable`, displaying clear zero-cost partner onboarding guidance.
3. **No Password or OTP Interception**: RaktOra never renders input fields for DigiLocker PINs, passwords, or Aadhaar OTPs. Authentication occurs exclusively on `digitallocker.gov.in`.

---

## 4. Role-Based Access Control (RBAC) Matrix

RaktOra distinguishes between five discrete organizational roles:

| API Route / Resource | `donor` | `recipient` | `blood_bank` | `hospital` | `admin` | Public / Guest |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/auth/digilocker/status` | Yes | Yes | Yes | Yes | Yes | Yes |
| `GET /api/bloodbanks` (Public Directory)| Yes | Yes | Yes | Yes | Yes | Yes |
| `GET /api/donors` (Search Available) | Read-only | Read-only | Full | Full | Full | Read-only |
| `POST /api/requests` (Create Request) | No | Yes | No | Yes | Yes | No |
| `PATCH /api/requests/:id/status` | No | Owner | No | Owner | Yes | No |
| `POST /api/bloodunits` (Stock Ingest) | No | No | Owner | No | Yes | No |
| `GET /api/bloodunits/fefo` | No | No | Owner | Owner | Yes | No |
| `GET /api/admin/audit-logs` | No | No | No | No | Yes | No |
| `GET /api/admin/users` | No | No | No | No | Yes | No |

---

## 5. Token & Session Management

1. **Authentication Token (`token`)**:
   - Format: Standard RFC 7519 JWT signed with HMAC-SHA256 (`HS256`).
   - Secret: Loaded from `JWT_SECRET` (minimum 32-character high-entropy secret).
   - Payload:
     ```json
     {
       "id": 42,
       "email": "dr.verma@delhiredcross.org",
       "role": "blood_bank",
       "digilocker_verified": true,
       "iat": 1776500000,
       "exp": 1777104800
     }
     ```
   - Lifetime: 7 days default.
2. **Pre-Registration Verification Token (`digilocker_claim`)**:
   - Purpose: Carries genuine verified identity attributes from DigiLocker callback to the registration form without creating an unactivated database record.
   - Lifetime: **15 minutes**.
   - Payload:
     ```json
     {
       "type": "DIGILOCKER_VERIFIED_CLAIM",
       "digilocker_id_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
       "full_name": "Soutik Pradhan",
       "dob": "1998-05-12",
       "gender": "M",
       "iat": 1776500000,
       "exp": 1776500900
     }
     ```
   - Validation: `POST /api/auth/register` cryptographically decodes and verifies this token. If forged or expired, registration is rejected with `HTTP 400 Invalid or expired verification claim`.

---

## 6. Data Minimization & Privacy Protection

Under the **Digital Personal Data Protection Act (DPDPA), 2023** and National Blood Transfusion Council regulations, RaktOra minimizes data storage:

- **Aadhaar / Citizen Identity Numbers**: Under Section 8 of the Aadhaar Act, raw Aadhaar numbers cannot be stored by non-accredited private systems. RaktOra calculates:
  $$\text{verification\_reference} = \text{SHA256}(\text{provider\_subject\_id})$$
  This one-way hash makes reverse-engineering the citizen's government identifier computationally impossible while preserving the ability to prevent duplicate voter/donor accounts.
- **Medical Questionnaires**: Self-screening questions on the frontend are evaluated client-side to inform voluntary donors of statutory guidelines. Questionnaires are not permanently logged in database tables unless associated with a confirmed clinical donation at an accredited blood bank.
- **Audit Log Sanitization**: Password digests, reset tokens, and OAuth authorization codes are stripped prior to writing audit ledger entries.

---

## 7. Operational Security & Configuration Checklist

- [x] Passwords salted and hashed with bcrypt (salt rounds $\ge 10$).
- [x] All database queries use prepared parameterized statements.
- [x] Sliding-window rate limiting on `/api/auth/*` endpoints.
- [x] DigiLocker OAuth uses PKCE `S256` and state verification.
- [x] Identity deduplication uses cryptographic hashes instead of raw PII.
- [x] Non-blocking frontend shell with bounded backoff and zero infinite polling loops.
- [x] Distinct `/health` (Liveness) and `/ready` (Readiness) probes.
- [x] Production routes fail closed if credentials are missing.
- [x] Test mocks are strictly contained in test files and excluded from production code paths.
