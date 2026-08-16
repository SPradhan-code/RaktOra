# ✅ RaktOra Production Release Checklist

Use this practical, operational checklist before pushing code to GitHub and after deploying updates to Render.

---

## 1. Pre-Push Quality Verification (Local Workspace)

Perform these checks before pushing commits to `main`:

* [ ] **Backend Test Suite**: All unit and integration tests pass cleanly:
  ```bash
  npm test
  ```
* [ ] **Security & Auth Tests**: Timing-safe signature verifier, IDOR protection, and rate-limiting suites pass:
  ```bash
  node --test backend/tests/security_hardening.test.js backend/tests/appointment_auth.test.js
  ```
* [ ] **Health & Readiness Architecture**: Liveness and readiness suites execute cleanly:
  ```bash
  node --test backend/tests/health_readiness.test.js
  ```
* [ ] **Clean Frontend Production Build**: Vite compiles production assets without TypeScript/JSX syntax errors:
  ```bash
  npm run build --prefix frontend
  ```
* [ ] **Secret Safety**: No `.env` files or real production credentials are staged for Git commit:
  ```bash
  git status
  ```
* [ ] **Environment Documentation**: Any newly introduced environment variable is documented in `.env.example`.

---

## 2. Post-Deployment Verification (Render Cloud)

Verify these items after Render completes the deployment:

* [ ] **Render Build & Start**: Build log ends with successful frontend build and server startup confirmation:
  ```text
  RaktOra REST API running on http://localhost:10000
  ```
* [ ] **Liveness Probe**: `GET /health` returns HTTP 200 OK:
  ```bash
  curl -I https://your-service.onrender.com/health
  ```
* [ ] **Readiness Probe**: `GET /ready` returns HTTP 200 OK with `database: connected`:
  ```bash
  curl -I https://your-service.onrender.com/ready
  ```
* [ ] **Frontend Loading & Shell**: Web page loads cleanly over HTTPS on desktop and mobile.
* [ ] **StartupGate Cold-Start Behavior**: If backend is waking up, branded startup screen appears with time-based status progression and automatically navigates when ready.
* [ ] **Authentication Flow**: User registration and login work; JWT token is stored and authenticated.
* [ ] **Emergency Blood Request**: Submitting an emergency request creates records and calculates antigen compatibility correctly.
* [ ] **Blood Inventory & FEFO Issuance**: Blood bank inventory view and unit allocations function without concurrency errors.
* [ ] **Appointment Scheduling**: Donor appointment booking and status updates enforce authorization limits without IDOR leaks.
* [ ] **Production Logs Cleanliness**: Render service logs show zero unhandled exceptions, no missing environment warnings, and no leaked credentials.
