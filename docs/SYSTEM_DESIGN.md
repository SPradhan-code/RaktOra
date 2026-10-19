# 📘 RaktOra System Design: Zero-Cost Architecture & DigiLocker-First Identity

## 1. Executive Summary & Zero-Cost Philosophy

**RaktOra** is a national voluntary blood donation and emergency inventory management platform built under a **strict ₹0 permanent budget constraint**. The system is designed to operate completely free of paid third-party API dependencies, commercial SMS gateways, proprietary cloud lock-in, and paid AI services, without requiring any billing or payment details.

### Core Philosophy
1. **Zero Financial Overhead**: The system functions end-to-end utilizing open-source runtimes (Node.js/Express, React/Vite, MySQL/MariaDB) and zero-cost hosting infrastructure.
2. **Genuine DigiLocker-First Authentication**: Primary identity verification is engineered for official Government of India DigiLocker OAuth 2.0 (with PKCE), eliminating the recurring per-message SMS OTP fee when authorized.
3. **No Mock or Fabricated Authentications in Production**: In accordance with medical ethics and real-world security standards, test identities and mocks are restricted strictly to automated unit/integration test suites. No simulated logins, mock callbacks, or hardcoded bypasses exist on public routes.
4. **Honest Provider Boundary**: If authorized DigiLocker partner access has not yet been provisioned, the system fails closed gracefully, informing the citizen transparently while maintaining full accessibility to informational modules.
5. **Deterministic Local Intelligence**: Compatibility matching (ABO/Rh matrix), donor triage, emergency broadcast batching, and FEFO (First-Expired, First-Out) blood inventory allocation are computed deterministically on local infrastructure without paid external AI APIs.

---

## 2. High-Level Modular Monolith Architecture

RaktOra is structured as an **idempotent modular monolith**, combining low operational complexity with strict separation of domain concerns.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Frontend (React + Vite)                          │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │    Resilient Shell      │  │   ServiceStatusBanner   │  │   Router    │  │
│  │  (Renders Immediately)  │  │   (Liveness / Readiness)│  │   & Pages   │  │
│  └─────────────────────────┘  └─────────────────────────┘  └─────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / JSON REST API
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Backend (Express.js Monolith)                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Security & Traffic Gate                       │  │
│  │    CORS Allowlist • Security Headers • In-Memory Rate Limiter (TTL)   │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         REST API Controllers                          │  │
│  │   /api/auth       •  /api/donors        •  /api/requests              │  │
│  │   /api/bloodbanks •  /api/bloodunits    •  /api/appointments          │  │
│  │   /api/hospitals  •  /api/camps         •  /api/admin                 │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         Domain Logic Services                         │  │
│  │  ├── DigiLocker OAuth 2.0 PKCE Engine (RFC 7636)                      │  │
│  │  ├── Deterministic ABO/Rh Compatibility Engine                        │  │
│  │  ├── Local Haversine Distance & Priority Batching                     │  │
│  │  ├── NBTC Medical Eligibility Engine (90-day cooldown rules)          │  │
│  │  └── FEFO Atomic Inventory Manager (InnoDB Row Locking)               │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Connection Pool (SSL / TLS)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Relational Persistence (MySQL 8.0 / MariaDB)                │
│                                                                             │
│     Users • Donors • BloodRequests • BloodBanks • BloodStock • AuditLogs    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Separation of Concerns

1. **Presentation Layer (`frontend/src`)**:
   - **Shell Autonomy**: The client shell (`Navbar`, `Footer`, informational pages) loads and renders immediately, independent of whether the backend or database is online.
   - **Status Observability**: The `StartupGate` component monitors backend `/health` (Liveness) and `/ready` (Readiness) asynchronously, displaying non-blocking status notifications without freezing the UI.
   - **Identity Client**: Initiates standard browser redirects to the official DigiLocker OAuth gateway and securely receives single-use authorization callbacks.

2. **API & Security Gateway (`backend/routes` & `backend/middleware`)**:
   - **Rate Limiting**: Sliding window rate limiter with background TTL eviction protects `/api/auth` from brute-force attacks without requiring Redis.
   - **State Validation**: CSRF state tokens and PKCE code verifiers are tracked with 10-minute automatic memory eviction.
   - **RBAC Enforcement**: Server-side role enforcement (Donor, Recipient, Blood Bank, Hospital, Admin) verified on every protected route.

3. **Domain Services Layer (`backend/services`)**:
   - **DigiLocker Service**: Manages RFC 7636 PKCE code challenges, authorization URL generation, secure token exchanges, and SHA-256 identity deduplication hashing.
   - **Eligibility Engine**: Enforces National Blood Transfusion Council (NBTC) criteria (18–65 years, weight ≥ 45kg, 90-day donation interval, medical risk exclusions) deterministically in code.
   - **Haversine Geolocation Engine**: Calculates spherical distances between donors and emergency requests locally, sorting dispatch tiers by proximity.

4. **Persistence Layer (`backend/db.js` & `database/schema.sql`)**:
   - Parameterized queries to prevent SQL injection.
   - Explicit transactions (`withTransaction`) with atomic row-level locks for inventory operations.
   - Idempotent database migrations tracking schema versions.

---

## 4. Graceful Degradation & Resilience

| Scenario | System Behavior | User Experience |
| :--- | :--- | :--- |
| **Backend Offline** | Frontend renders public routes immediately; `StartupGate` polls `/health` with bounded backoff (max 4 attempts). | User browses Home, About, FAQs; non-intrusive banner alerts: *"Backend service offline. Informational pages remain accessible."* |
| **Database Initializing** | Liveness `/health` returns 200 OK; Readiness `/ready` returns 503 Unready. | Shell remains responsive; banner notifies: *"Database connection is initializing."* |
| **DigiLocker Credentials Unset** | `/api/auth/digilocker/initiate` returns 503; frontend modal displays onboarding instructions. | User is informed that partner registration is pending; can register/sign in with email and password without simulation. |
| **Network Hiccup during Session Restore** | `AuthContext` does not destroy stored JWT on general network errors (only on explicit 401/403). | User does not get abruptly logged out when experiencing intermittent mobile connectivity. |

---

## 5. Medical Limitations & Ethical Boundaries

RaktOra is designed with strict healthcare safety boundaries:
1. **No Automated Medical Certification**: The platform self-assessment tool is an educational screening guide based on NBTC standards. No software can certify medical fitness.
2. **Mandatory On-Site Clinical Review**: Final donor eligibility, hemoglobin checks, and blood pressure screening must be certified on-site by a licensed Medical Officer before phlebotomy.
3. **No Commercial Transaction**: Blood donations in RaktOra are strictly voluntary and non-remunerated in compliance with the National Blood Policy.
