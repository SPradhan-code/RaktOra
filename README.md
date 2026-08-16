# 🩸 RaktOra — National Voluntary Blood Network & Smart FEFO Engine

[![RaktOra CI](https://github.com/SPradhan-code/RaktOra/actions/workflows/ci.yml/badge.svg)](https://github.com/SPradhan-code/RaktOra/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![Database](https://img.shields.io/badge/database-MySQL%20%2F%20MariaDB-blue.svg)](https://aiven.io)
[![License: ISC](https://img.shields.io/badge/License-ISC-red.svg)](LICENSE)

**RaktOra** is a mission-critical, full-stack voluntary blood donor management and supply-chain logistics platform designed for national-scale emergency blood request matching, blood bank inventory tracking with **FEFO (First-Expiry-First-Out)** allocation, real-time appointment scheduling, and automated medical eligibility evaluation.

---

## 🌟 Key Features

* **Instant Emergency Blood Matching**: Real-time broadcast and automated compatibility routing (ABO/Rh antigen matrix) for urgent patient requests.
* **Smart FEFO Inventory Allocation**: Atomic database concurrency locks prevent over-fulfillment and prioritize older viable blood units to eliminate wastage.
* **Role-Based Workflows (5 Dashboards)**: Dedicated portals for **Donors**, **Recipients**, **Blood Banks**, **Hospitals**, and **Super Administrators**.
* **Medical Eligibility Engine**: Instant pre-donation health screening checking age, weight, donation interval cooldowns (90 days), and risk questionnaires.
* **Graceful Cold-Start Startup Gate**: Client-side startup orchestrator (`StartupGate`) with automatic `/ready` probing, exponential backoff, and branded feedback during Render backend wakeups.
* **Comprehensive Security Hardening**: Timing-safe admin keys, rate limiting with TTL memory eviction, parameterized queries, and strict production CORS policies.
* **Interactive API Documentation**: Live Swagger UI & OpenAPI 3.0.3 specification available at `/api/docs`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | React 18, Vite 5, Tailwind CSS, React Router v6, Lucide React |
| **Backend REST API** | Node.js 20, Express 5, Axios, Multer |
| **Database & Cache** | MySQL 8 / MariaDB (Aiven Cloud & Local), Connection Pooling, `schema_migrations` |
| **Security & Auth** | JWT (JSON Web Tokens), Bcrypt.js, Timing-Safe Cryptographic Buffer Equality |
| **Testing & CI/CD** | Node.js Native Test Runner (`node:test`), GitHub Actions, Render Cloud |

---

## 🏛️ High-Level Architecture

```text
                               ┌────────────────────────────────┐
                               │       Web Clients / Users      │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │   RaktOra Frontend (React 18)  │
                               │   StartupGate & Auth Context   │
                               └───────────────┬────────────────┘
                                               │
                                               ▼
 ┌─────────────────────────────────────────────────────────────────────────────────────────┐
 │                                Express.js Backend API                                   │
 │  ├── Liveness & Readiness Probes: GET /health | GET /ready                              │
 │  ├── Security: CORS Whitelist, Helmet Headers, Rate Limiting, Timing-Safe Admin Auth    │
 │  ├── REST Routes: /api/auth, /api/donors, /api/requests, /api/bloodbanks, /api/camps     │
 │  └── Core Services: FEFO Concurrency Engine, Eligibility Engine, Audit Logger           │
 └─────────────────────────────────────────────┬───────────────────────────────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │  MySQL Database Pool (Aiven)   │
                               │  InnoDB Locking & Migrations   │
                               └────────────────────────────────┘
```

For comprehensive technical diagrams and concurrency model details, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🚀 Live Deployment Pipeline

RaktOra runs an automated continuous delivery pipeline:

$$\text{Antigravity IDE} \longrightarrow \text{GitHub} \xrightarrow{\text{GitHub Actions CI}} \text{Render Web Service} \longrightarrow \text{Production}$$

* **Production URL**: Configured on Render (e.g. `https://bloodconnect.onrender.com`).
* **Deployment Type**: Unified Full-Stack Node.js Service (Express serves both REST API routes and compiled React production assets).
* **Liveness Probe**: `GET /health` (monitored automatically by Render for zero-downtime rolling deploys).
* **Readiness Probe**: `GET /ready` (probed by frontend `StartupGate` to ensure database availability).

---

## 💻 Local Development Quickstart

### Prerequisites
* Node.js `>= 20.0.0`
* npm `>= 10.0.0`
* Local MySQL instance or cloud connection string (e.g., Aiven MySQL)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/SPradhan-code/RaktOra.git
cd RaktOra

# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Configure Environment Variables
Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```
Populate `backend/.env` with your database credentials and a strong `JWT_SECRET` (at least 16 characters in production):
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bloodconnect_db
DB_PORT=3306
DB_SSL=false
JWT_SECRET=super-secret-jwt-key-for-local-dev-only
```

### 3. Run Database Migrations
```bash
npm run migrate
```

### 4. (Optional) Seed Sample Test Data
```bash
npm run seed
```

### 5. Start Development Servers
* **Backend API Server**:
  ```bash
  cd backend
  npm run dev
  # Runs on http://localhost:5000
  ```
* **Frontend Vite Dev Server**:
  ```bash
  cd frontend
  npm run dev
  # Runs on http://localhost:5173
  ```

---

## 🧪 Testing & Quality Gates

RaktOra maintains a comprehensive automated testing suite built on Node.js native test runner:

```bash
# Run all backend tests (90 tests across 14 suites)
npm test
```

### Test Suite Coverage:
* 🩺 **Health & Readiness Architecture**: Probes `/health` and `/ready` with mocked pool states.
* 🩸 **FEFO Blood Issuance & Concurrency**: Validates atomic row locking under concurrent fulfillment requests.
* 🔐 **Cryptographic Signatures & Admin Security**: Tests timing-safe comparisons and password policies.
* 🌐 **API Standards & Route Protection**: Verifies RBAC, IDOR prevention, and error formatting.
* 🛡️ **Rate Limiter & CORS Whitelisting**: Verifies TTL sweep and environment-driven origin filtering.

---

## 🏗️ Production Build

To compile the React frontend into static production assets:
```bash
npm run build
```
This builds `frontend/dist`, which Express will automatically serve when `NODE_ENV=production`.

---

## 📚 Documentation Directory

* 📖 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**: Deep-dive into RBAC, FEFO concurrency, and database connection pooling.
* 🚀 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Complete guide to deploying RaktOra on Render and configuring environment variables.
* ✅ **[docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md)**: Pre-flight and post-deployment verification checklist.
* 🔧 **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)**: Incident response and solutions for cold-starts, CORS, and database errors.

---

## 🔒 Security & Privacy

* **Zero Plaintext Secrets**: Passwords hashed with bcrypt (10 rounds), OTPs stored as SHA-256 digests.
* **Timing-Safe Evaluation**: `crypto.timingSafeEqual` prevents side-channel timing attacks on administrative secrets.
* **Fail-Closed Registrations**: Administrator registration fails closed (403 Forbidden) if `ADMIN_REGISTRATION_SECRET` is unset.
* **CORS Allowlist Enforcement**: Strict origin matching in production with `credentials: true`.

---

## 📄 License

This project is licensed under the ISC License.
