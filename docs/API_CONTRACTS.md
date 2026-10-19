# RaktOra RESTful API Specifications & Interface Contracts

## 1. General API Conventions

### Base URLs
- **Local Development**: `http://localhost:5000` (API) / `http://localhost:3000` (Vite Frontend proxying `/api`, `/ready`, `/health`)
- **Headers Required**:
  - `Content-Type: application/json` (for all `POST`, `PUT`, `PATCH` requests)
  - `Authorization: Bearer <JWT_TOKEN>` (for all authenticated endpoints)

### Standard Response Envelope
Successful responses return structured JSON:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional descriptive human-readable message"
}
```

### Standard Error Response Envelope
```json
{
  "success": false,
  "error": "Error code or short summary",
  "message": "Detailed context or diagnostic message",
  "details": []
}
```

---

## 2. System Probes & Health Checks

### 2.1. Liveness Probe
- **Endpoint**: `GET /health`
- **Access**: Public / Unauthenticated
- **Purpose**: Verifies that the Node.js Express process is active and accepting HTTP socket connections.
- **Response**: `HTTP 200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-10-19T10:35:00.000Z",
  "uptime": 1420.5
}
```

### 2.2. Readiness Probe
- **Endpoint**: `GET /ready`
- **Access**: Public / Unauthenticated
- **Purpose**: Verifies downstream dependencies (database pool connectivity, schema readiness).
- **Responses**:
  - **Healthy (`HTTP 200 OK`)**:
    ```json
    {
      "status": "ready",
      "database": "connected",
      "timestamp": "2026-10-19T10:35:00.000Z"
    }
    ```
  - **Unhealthy (`HTTP 503 Service Unavailable`)**:
    ```json
    {
      "status": "not_ready",
      "database": "disconnected",
      "error": "Database connectivity failed: Connection refused"
    }
    ```

---

## 3. Authentication & DigiLocker Endpoints

### 3.1. DigiLocker Public Status
- **Endpoint**: `GET /api/auth/digilocker/status`
- **Access**: Public
- **Description**: Returns whether real DigiLocker credentials are configured on this server instance and provides zero-cost partner onboarding guidance.
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "data": {
    "configured": false,
    "provider": "DIGILOCKER",
    "budget": "INR_0_PERMANENT",
    "onboarding": {
      "portal": "https://partners.digitallocker.gov.in",
      "status": "PENDING_CREDENTIALS",
      "requirements": [
        "Register at partners.digitallocker.gov.in",
        "Sign MoU or register as an authorized health/emergency nonprofit partner",
        "Obtain client_id and client_secret",
        "Register exact callback URL: http://localhost:5000/api/auth/digilocker/callback"
      ],
      "env_variables": [
        "DIGILOCKER_CLIENT_ID",
        "DIGILOCKER_CLIENT_SECRET",
        "DIGILOCKER_REDIRECT_URI",
        "ENABLE_DIGILOCKER"
      ]
    }
  }
}
```

---

### 3.2. Initiate DigiLocker OAuth 2.0 Flow
- **Endpoint**: `GET /api/auth/digilocker/initiate`
- **Access**: Public
- **Description**: Generates an RFC 7636 PKCE code challenge and CSRF state parameter, then redirects citizen to official DigiLocker OAuth portal.
- **Responses**:
  - **When Configured**: `HTTP 302 Found` redirecting to `https://digitallocker.gov.in/public/oauth2/1/authorize?...`
  - **When Unconfigured (`HTTP 503 Service Unavailable`)**:
```json
{
  "success": false,
  "error": "DIGILOCKER_NOT_CONFIGURED",
  "message": "DigiLocker authentication is currently pending authorized provider credentials.",
  "onboarding": {
    "portal": "https://partners.digitallocker.gov.in",
    "instructions": "Set DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET in backend/.env once approved."
  }
}
```

---

### 3.3. DigiLocker OAuth Callback
- **Endpoint**: `GET /api/auth/digilocker/callback?code=...&state=...`
- **Access**: Public (called by DigiLocker identity provider redirect)
- **Description**: Validates CSRF state, exchanges authorization code using stored PKCE code verifier, retrieves verified citizen identity, and:
  - If citizen already has a RaktOra account: issues standard session JWT and redirects to frontend `/login?digilocker_token=...`.
  - If citizen is new: issues short-lived (15m) `digilocker_claim` JWT and redirects to `/register?digilocker_claim=...`.
- **Responses**:
  - `HTTP 302 Redirect` to Frontend callback URLs.
  - On validation error: `HTTP 400 Bad Request` or `HTTP 302 Redirect` to `/login?error=INVALID_STATE`.

---

### 3.4. Citizen Registration
- **Endpoint**: `POST /api/auth/register`
- **Access**: Public
- **Request Body**:
```json
{
  "full_name": "Soutik Pradhan",
  "email": "soutik@example.org",
  "password": "SecurePassword123!",
  "phone": "9876543210",
  "role": "donor",
  "state": "Delhi",
  "city": "New Delhi",
  "pincode": "110001",
  "blood_group": "O+",
  "age": 26,
  "gender": "Male",
  "weight": 68.5,
  "digilocker_claim": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
*Note*: `digilocker_claim` is optional. If provided, the backend cryptographically verifies the token, records `digilocker_verified: 1`, computes the `verification_reference` hash, and prevents duplicate registration.

- **Response (`HTTP 201 Created`)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 12,
    "full_name": "Soutik Pradhan",
    "email": "soutik@example.org",
    "role": "donor",
    "digilocker_verified": true
  }
}
```

---

### 3.5. Citizen / Entity Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public (Rate-limited to 10 req/min)
- **Request Body**:
```json
{
  "email": "soutik@example.org",
  "password": "SecurePassword123!"
}
```
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 12,
    "full_name": "Soutik Pradhan",
    "email": "soutik@example.org",
    "role": "donor",
    "digilocker_verified": true
  }
}
```

---

### 3.6. Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Access**: Authenticated (`Bearer <token>`)
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "user": {
    "id": 12,
    "full_name": "Soutik Pradhan",
    "email": "soutik@example.org",
    "phone": "9876543210",
    "role": "donor",
    "state": "Delhi",
    "city": "New Delhi",
    "digilocker_verified": true,
    "donor_profile": {
      "blood_group": "O+",
      "is_available": true,
      "total_donations": 3,
      "last_donation_date": "2026-06-15"
    }
  }
}
```

---

## 4. Donors API

### 4.1. Search Available Donors
- **Endpoint**: `GET /api/donors`
- **Access**: Public / Authenticated
- **Query Parameters**:
  - `blood_group`: (e.g., `A+`, `O-`)
  - `state`: (e.g., `Delhi`)
  - `city`: (e.g., `New Delhi`)
  - `available`: `true` | `false`
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "full_name": "Ananya Sharma",
      "blood_group": "O+",
      "city": "New Delhi",
      "state": "Delhi",
      "is_available": 1,
      "digilocker_verified": 1,
      "total_donations": 4
    }
  ],
  "total": 1
}
```

---

## 5. Blood Requests API

### 5.1. Create Emergency Blood Request
- **Endpoint**: `POST /api/requests`
- **Access**: Authenticated (`recipient`, `hospital`, `admin`)
- **Request Body**:
```json
{
  "patient_name": "Rajesh Kumar",
  "blood_group": "B+",
  "units_needed": 2,
  "hospital_name": "AIIMS New Delhi",
  "hospital_address": "Ansari Nagar, New Delhi",
  "urgency": "CRITICAL",
  "contact_phone": "9811223344",
  "doctor_name": "Dr. V. K. Paul"
}
```
- **Response (`HTTP 201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": 85,
    "status": "PENDING",
    "patient_name": "Rajesh Kumar",
    "blood_group": "B+",
    "units_needed": 2,
    "urgency": "CRITICAL",
    "created_at": "2026-10-19T10:35:00.000Z"
  }
}
```

### 5.2. Match Blood Request with Compatible Donors
- **Endpoint**: `GET /api/requests/:id/matches`
- **Access**: Authenticated
- **Description**: Applies deterministic ABO/Rh compatibility matrices and geographic proximity to list candidate voluntary donors and blood banks.
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "data": {
    "request_id": 85,
    "target_blood_group": "B+",
    "compatible_groups": ["B+", "B-", "O+", "O-"],
    "matched_donors": [
      {
        "id": 5,
        "name": "Soutik Pradhan",
        "blood_group": "O+",
        "phone": "9876543210",
        "city": "New Delhi",
        "digilocker_verified": 1
      }
    ],
    "matched_stock": [
      {
        "blood_bank_name": "Red Cross Central Blood Bank",
        "blood_group": "B+",
        "units_available": 14
      }
    ]
  }
}
```

---

## 6. Blood Units & FEFO Inventory Tracking

### 6.1. Retrieve Units Sorted by FEFO (First-Expiry, First-Out)
- **Endpoint**: `GET /api/bloodunits/fefo`
- **Access**: Authenticated (`blood_bank`, `hospital`, `admin`)
- **Query Parameters**:
  - `blood_group`: (e.g., `A+`)
  - `component_type`: (e.g., `PRBC`)
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 104,
      "unit_number": "DEL-PRBC-2026-0891",
      "blood_group": "A+",
      "component_type": "PRBC",
      "expiry_date": "2026-10-24",
      "days_remaining": 5,
      "status": "AVAILABLE",
      "blood_bank_name": "Delhi Red Cross Blood Center"
    }
  ]
}
```

---

## 7. Administrative & Audit API

### 7.1. Retrieve Immutable Audit Ledger
- **Endpoint**: `GET /api/admin/audit-logs`
- **Access**: Admin only (`role: 'admin'`)
- **Query Parameters**: `limit=50&offset=0`
- **Response (`HTTP 200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": 312,
      "user_id": 12,
      "action": "DIGILOCKER_AUTH_SUCCESS",
      "resource_type": "Users",
      "ip_address": "127.0.0.1",
      "status": "SUCCESS",
      "details": {
        "auth_type": "SSO_LOGIN"
      },
      "created_at": "2026-10-19T10:30:15.000Z"
    }
  ]
}
```
