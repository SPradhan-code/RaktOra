# 🏛️ RaktOra Technical Architecture & System Design

This document details the architectural principles, security models, data flows, and concurrency guarantees implemented across the **RaktOra** platform.

---

## 1. System Topology

```text
                                  ┌─────────────────────────────┐
                                  │      Client Browsers        │
                                  │   (Mobile & Desktop SPA)    │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
                                  ┌─────────────────────────────┐
                                  │       Render Edge CDN       │
                                  │     (HTTPS & TLS Term.)     │
                                  └──────────────┬──────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                               Express.js Web & API Server                                   │
│                                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │   Static Asset Engine   │  │   Liveness / Readiness  │  │     Security Middlewares    │  │
│  │   (Serves React dist)   │  │   GET /health, /ready   │  │  CORS, Helmet, RateLimiter  │  │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                               REST Routing Subsystem                                  │  │
│  │  /api/auth  •  /api/donors  •  /api/requests  •  /api/bloodbanks  •  /api/bloodunits  │  │
│  │  /api/appointments  •  /api/hospitals  •  /api/camps  •  /api/admin  •  /api/docs    │  │
│  └───────────────────────────────────────────┬───────────────────────────────────────────┘  │
│                                              │                                              │
│  ┌───────────────────────────────────────────┴───────────────────────────────────────────┐  │
│  │                               Core Domain Services                                    │  │
│  │  ├── FEFO Inventory Allocation Engine (InnoDB Atomic Row Locking)                     │  │
│  │  ├── Medical Eligibility Engine (90-day donation cooldown, donor vitals)              │  │
│  │  ├── Geocoding & Haversine Distance Calculator (GPS Donor Dispatch)                   │  │
│  │  ├── Cryptographic Signature Verifier (Timing-Safe Buffer Comparison)                 │  │
│  │  └── Centralized Audit Logger (Actor ID, Entity Type, Mutation Diff)                  │  │
│  └───────────────────────────────────────────┬───────────────────────────────────────────┘  │
└──────────────────────────────────────────────┼──────────────────────────────────────────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────────┐
                              │    MySQL 8.0 Cloud Database     │
                              │     (Aiven Managed Cluster)     │
                              │  InnoDB, ACID Transactions, SSL │
                              └─────────────────────────────────┘
```

---

## 2. Authentication & Authorization Model

### 2.1 Role-Based Access Control (RBAC)
RaktOra strictly divides permissions into five distinct user roles:

| Role | Scope & Permissions |
|---|---|
| `donor` | Manages donor profile, availability toggle, view donation history, book bank appointments. |
| `recipient` | Submits emergency blood requests, tracks fulfillment status, views nearby blood banks. |
| `blood_bank` | Manages blood unit inventory, executes FEFO issuance, manages donation camps & donor appointments. |
| `hospital` | Raises high-volume institutional batch requests, updates hospital verification details. |
| `admin` | System-wide analytics, user verification overrides, hospital license approvals, audit logs. |

### 2.2 Token Lifecycle & Security
* **JWT Issuance**: Signed using HS256 with `JWT_SECRET` (minimum 16 chars in production).
* **Transmission**: Stored client-side in `localStorage` (`bloodconnect_token`) and attached to requests via `Authorization: Bearer <token>`.
* **Cookie Support**: Express sets `HttpOnly`, `SameSite=Lax` cookie for web clients.
* **Account Lockout Protection**: Accounts are automatically locked for 15 minutes after 5 consecutive failed login attempts to prevent brute-force attacks.

### 2.3 Timing-Safe Administrator Registration
To protect against timing attacks when registering admin accounts, the secret comparison utilizes Node.js cryptographic timing-safe buffer equality:
```javascript
const providedSecretBuf = Buffer.from(String(admin_secret || '').trim());
const expectedSecretBuf = Buffer.from(String(configuredAdminSecret).trim());

const isValid = (
  providedSecretBuf.length === expectedSecretBuf.length &&
  crypto.timingSafeEqual(providedSecretBuf, expectedSecretBuf)
);
```

---

## 3. FEFO Blood Inventory & Concurrency Strategy

The **First-Expiry-First-Out (FEFO)** algorithm ensures that units expiring soonest are issued first, preventing blood component spoilage while guaranteeing concurrency safety.

### 3.1 Race Condition Prevention with Row Locking
When multiple fulfillment requests occur concurrently for the same blood group, RaktOra wraps the query inside a managed database transaction with InnoDB `FOR UPDATE` row-level locks:

```sql
SELECT id, unit_id, blood_group, expiry_date, status
FROM blood_units
WHERE blood_bank_id = ? 
  AND blood_group = ? 
  AND status = 'AVAILABLE'
  AND testing_status = 'PASSED'
  AND expiry_date >= CURDATE()
ORDER BY expiry_date ASC
LIMIT ?
FOR UPDATE;
```

### 3.2 Transaction Integrity
1. Lock candidate units for exclusive modification.
2. Verify total locked units meet or exceed required quantity.
3. Transition unit status: `AVAILABLE` $\rightarrow$ `ISSUED`.
4. Decrement aggregate stock count in `BloodStock` atomically.
5. Create immutable `AuditLog` entry.
6. Commit transaction; if any step fails, automatically rollback.

---

## 4. Appointment Authorization Protection (IDOR Defense)

To prevent Insecure Direct Object References (IDOR), appointment status modifications, cancellations, and rescheduling are guarded by strict ownership checks:
* **Donors** can only view and reschedule their own appointments (`donor_id = current_user.donor_id`).
* **Blood Banks** can only view and update appointments booked specifically at their facility (`blood_bank_id = current_user.blood_bank_id`).
* **Super Administrators** retain system-wide administrative oversight.

---

## 5. Health & Readiness Architecture

RaktOra separates **Liveness** from **Readiness** to support container orchestrators and client startup gates:

### 5.1 Liveness Probe (`GET /health`)
* **Purpose**: Verifies that the Node.js process and HTTP server are accepting connections.
* **Database Dependency**: None (fast, instant response).
* **Render Integration**: Used as `healthCheckPath` in `render.yaml` for rolling zero-downtime deployments.
* **Payload**:
  ```json
  {
    "status": "ok",
    "service": "raktora-api",
    "timestamp": "2026-08-16T07:45:00.000Z"
  }
  ```

### 5.2 Readiness Probe (`GET /ready`)
* **Purpose**: Verifies that essential downstream dependencies (MySQL connection pool) are fully operational.
* **Query**: `SELECT 1` ping using `db.queryOne`.
* **Responses**:
  * `200 OK`: `{ "status": "ready", "service": "raktora-api", "database": "connected" }`
  * `503 Service Unavailable`: `{ "status": "unready", "service": "raktora-api", "database": "unavailable" }`

---

## 6. Frontend StartupGate & Cold-Start Strategy

Render free instances spin down after inactivity. When a user visits the platform during cold start:

```text
User navigates to RaktOra
           │
           ▼
HTML/JS Assets Load Immediately (Vite Bundle)
           │
           ▼
StartupGate Mounts & Displays Branded Shell
           │
           ├── Initial Readiness Probe (GET /ready)
           │
     ┌─────┴─────┐
     ▼           ▼
[200 OK]    [Timeout / 503]
     │           │
     │           ▼
     │      Display Waking Up Screen
     │      (Dynamic elapsed-time status messages)
     │           │
     │           ▼
     │      Exponential Backoff Retries:
     │      1s ➔ 2s ➔ 3s ➔ 4s ➔ max 5s
     │           │
     ├───────────┘ (Backend becomes ready)
     │
     ▼
Seamlessly Transition into Main App
(AuthProvider mounts and checks user session)
```

* **No Infinite Loops**: Maximum wait time of **75 seconds**.
* **Clean Fallback**: On timeout, presents a "Try Again" recovery action that restarts the probe sequence without full page reload.
* **Honest Telemetry**: Status updates are derived purely from elapsed seconds (0-10s: *Connecting*, 10-30s: *Starting up*, 30s+: *Still starting*).

---

## 7. Database Connection Pool & SSL

* **Engine**: `mysql2/promise` connection pool (`connectionLimit: 10`, `waitForConnections: true`).
* **SSL/TLS**: Supports Aiven Cloud CA certificates via `DB_SSL_CA_PATH` or dynamic fallback `rejectUnauthorized: false` for cloud-hosted instances.
* **Safe Diagnostics**: Logs non-sensitive connection parameters (host, port, user, db, SSL flag) without exposing passwords or tokens.
