# 🚀 RaktOra Production Deployment Guide (Render.com & GitHub)

This document provides the definitive, production-hardened guide for deploying **RaktOra** to **Render.com** using automatic Git-triggered deployments.

---

## 1. Production Pipeline Overview

```text
Developer Workspace (Antigravity)
               ↓  (git push origin main)
GitHub Repository (SPradhan-code/RaktOra)
               ↓  (Triggers GitHub Actions)
Automated CI Verification (Tests & Frontend Build)
               ↓  (On green status)
Render.com Web Service Auto-Deploy
               ↓  (Runs buildCommand & startCommand)
Health Check Verification (GET /health)
               ↓  (Traffic switched to new instance)
Live Production Environment
```

---

## 2. Render Web Service Configuration

RaktOra is configured as a unified single-service web application on Render.

| Setting | Value | Description |
|---|---|---|
| **Service Type** | Web Service | Node.js Environment |
| **Name** | `bloodconnect` | Service Identifier |
| **Branch** | `main` | Production deployment trigger branch |
| **Runtime** | `Node` | Node.js 20+ |
| **Build Command** | `npm run build` | Installs dependencies & builds frontend Vite bundle into `frontend/dist` |
| **Start Command** | `npm start` | Starts Express production server (`node backend/server.js`) |
| **Health Check Path**| `/health` | Zero-downtime health verification probe |
| **Auto-Deploy** | `Yes` | Deploys automatically on commit to `main` |

---

## 3. Required Environment Variables

Configure these variables in your Render Dashboard under **Service Settings $\rightarrow$ Environment Variables**:

| Variable | Required | Example / Recommendation | Description |
|---|---|---|---|
| `NODE_ENV` | **Yes** | `production` | Enables production security optimizations & static asset serving. |
| `PORT` | **Yes** | `10000` | Port assigned by Render (or default 5000). |
| `JWT_SECRET` | **Yes** | `[Generate Random 32+ chars]` | Secret key used to sign and verify JSON Web Tokens. |
| `DB_HOST` | **Yes** | `mysql-xxxx.aivencloud.com` | Hostname of your cloud MySQL / MariaDB cluster. |
| `DB_PORT` | **Yes** | `3306` | Database port (or provider-specific port). |
| `DB_USER` | **Yes** | `avnadmin` | Database username. |
| `DB_PASSWORD` | **Yes** | `[Your Cloud DB Password]` | Database password. |
| `DB_NAME` | **Yes** | `defaultdb` or `bloodconnect_db` | Target database name. |
| `DB_SSL` | **Yes** | `true` | Enables TLS/SSL encryption for cloud database connections. |
| `ADMIN_REGISTRATION_SECRET` | Recommended | `[Generate Random 24+ chars]` | Security key required to register system administrator accounts. |
| `ALLOWED_ORIGINS` | Optional | `https://bloodconnect.onrender.com` | Comma-separated list of additional permitted browser origins for CORS. |
| `FRONTEND_URL` | Optional | `https://bloodconnect.onrender.com` | Canonical frontend domain used for redirects and email links. |

---

## 4. Step-by-Step Deployment Procedure

### Option A: Deploying via Render Blueprint (`render.yaml`)
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Select your `RaktOra` GitHub repository.
4. Render will read [`render.yaml`](../render.yaml) and prompt for unsynced database credentials:
   - Provide `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `ADMIN_REGISTRATION_SECRET`.
5. Click **Apply**. Render will automatically build the bundle, run health checks against `/health`, and publish your service.

### Option B: Manual Web Service Setup on Render
1. Click **New +** $\rightarrow$ **Web Service**.
2. Connect your `RaktOra` repository.
3. Configure the fields:
   - **Name**: `bloodconnect`
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Under **Advanced Settings**:
   - Set **Health Check Path** to `/health`.
   - Add all environment variables listed in Section 3.
5. Click **Create Web Service**.

---

## 5. Database Initialization & Schema Migrations

RaktOra includes an idempotent database migration runner (`database/run_migrations.js`) that tracks applied scripts in the `schema_migrations` table.

To run migrations against your production database:
```bash
# Set your production database variables locally or run from a secure admin terminal:
export DB_HOST="your-production-db-host.com"
export DB_USER="your-db-user"
export DB_PASSWORD="your-db-password"
export DB_NAME="bloodconnect_db"
export DB_SSL="true"

npm run migrate
```

To seed initial sample data (Admin account, initial blood banks, mock camps):
```bash
npm run seed
```

---

## 6. Post-Deployment Smoke Test & Verification

After deployment succeeds, verify all operational endpoints:

1. **Liveness Probe**:
   ```bash
   curl -i https://your-service.onrender.com/health
   # Expected: HTTP 200 OK with {"status":"ok","service":"raktora-api"}
   ```

2. **Readiness Probe**:
   ```bash
   curl -i https://your-service.onrender.com/ready
   # Expected: HTTP 200 OK with {"status":"ready","database":"connected"}
   ```

3. **Public Features Discovery**:
   ```bash
   curl -i https://your-service.onrender.com/api/features
   # Expected: HTTP 200 OK with public feature flags
   ```

4. **Frontend Startup Experience**:
   - Open `https://your-service.onrender.com` in a browser.
   - Verify that the page loads immediately.
   - If cold-starting, verify that the `StartupGate` renders the branded loading screen and automatically navigates to the homepage once ready.

---

## 7. Inspecting Logs & Incident Diagnosis

Render streams structured logs in real time from the dashboard under **Logs**:
* **Startup diagnostics**: Check for `MySQL Database Connected Successfully`.
* **CORS diagnostics**: Check for `CORS policy: Origin ... is not allowed access` if custom domains fail.
* **Environment warnings**: Check for any missing configuration warnings printed by `envValidator`.

---

## 8. Rollback Procedure

If a production deployment introduces unexpected regressions:
1. In the Render Dashboard, navigate to your `bloodconnect` service.
2. Click **Events**.
3. Locate the last known good deployment.
4. Click the three dots ($\dots$) and select **Rollback to this deploy**.
5. Render will instantly re-activate the previous immutable build artifact without re-running builds.
