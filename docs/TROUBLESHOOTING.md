# 🔧 RaktOra Troubleshooting & Incident Resolution Guide

This guide provides fast diagnostics and actionable remediation steps for common operational issues encountered in development and production deployments.

---

## 1. Render Cold-Start & First-Visit Delays

### Symptom
When opening the site for the first time after inactivity, the frontend displays:
> **Starting RaktOra securely...**
> *Our services are waking up. This can take a moment on the first visit.*

### Root Cause
Render spins down free-tier instances after a period of inactivity. Upon the first incoming HTTP request, the container boots, executes Node.js, and initializes database connection pools.

### Resolution
* **Automatic Recovery**: `StartupGate` probes `GET /ready` using exponential backoff (1s, 2s, 3s, 4s, 5s) for up to 75 seconds. Once the container is ready, the application initializes automatically without user intervention.
* **If Timeout Occurs**: Click **Try Again** on the recovery screen. This resets the timer and restarts the readiness probe cleanly without refreshing the browser page.
* **Production Optimization**: On paid Render plans (Starter/Standard), background instances do not spin down, completely eliminating cold starts.

---

## 2. Liveness (`/health`) vs Readiness (`/ready`) Failures

| Endpoint | Error Code | Meaning | Investigation Step |
|---|---|---|---|
| `/health` | `502 / 504 / Connection Refused` | The Node.js application process has crashed or failed during startup. | Check Render build/start logs for uncaught exceptions or missing Node packages. |
| `/ready` | `503 Service Unavailable` | Express is running, but the database connection ping (`SELECT 1`) failed. | Check database credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`) and cloud firewall rules. |

---

## 3. CORS & Origin Policy Errors

### Symptom
Browser console displays:
> `Access to XMLHttpRequest at '...' from origin 'https://...' has been blocked by CORS policy: Origin ... is not allowed access.`

### Root Cause
In production (`NODE_ENV=production`), Express enforces strict origin allowlisting. If the frontend is hosted on a custom domain not in the whitelist, requests will fail closed with 403 Forbidden.

### Resolution
Add your domain to `ALLOWED_ORIGINS` or `FRONTEND_URL` in the Render Environment Variables:
```env
ALLOWED_ORIGINS=https://bloodconnect.onrender.com,https://yourcustomdomain.com
FRONTEND_URL=https://yourcustomdomain.com
```
Re-deploy or save variables; the server will reload origin policies dynamically.

---

## 4. Frontend API Base URL Misconfiguration

### Symptom
API requests fail with 404 or point to the wrong server.

### Root Cause
* In a unified Render single-service setup, the frontend uses relative `/api` paths by default.
* If deploying frontend on a separate service (e.g. GitHub Pages or Vercel), `VITE_API_URL` must point to your live Render backend URL.

### Resolution
* **Single Service (Standard Render)**: Leave `VITE_API_URL` unset (defaults to `/api`).
* **Decoupled Frontend**: Set `VITE_API_URL=https://your-backend.onrender.com/api` during frontend build.

---

## 5. Database Connection & SSL/TLS Issues

### Symptom
Backend log displays:
> `MySQL Connection Warning: Handshake failed` OR `Access denied for user`

### Resolution
1. **Cloud Database (Aiven/Railway/PlanetScale)**: Ensure `DB_SSL=true` is set.
2. **CA Certificate Verification**: If using strict CA certs, set `DB_SSL_CA_PATH` to the path of your `.pem` file.
3. **Database Host & Port**: Double-check that `DB_PORT` matches your cloud provider's external port (e.g., Aiven often uses ports like `15234` or custom ports).

---

## 6. Migration Failures

### Symptom
Running `npm run migrate` halts with an error.

### Root Cause
A migration file contains SQL syntax incompatible with your MySQL version or references a non-existent table.

### Resolution
1. Check the error log: `run_migrations.js` outputs the exact file and SQL statement that failed.
2. Check `schema_migrations` table to inspect previously executed migrations:
   ```sql
   SELECT * FROM schema_migrations;
   ```
3. Fix the syntax error in the offending migration file in `database/migrations/` and re-run:
   ```bash
   npm run migrate
   ```

---

## 7. Render Deployment Rollback

If a bad commit was deployed to production:
1. Open the [Render Dashboard](https://dashboard.render.com/).
2. Select your `bloodconnect` Web Service.
3. Go to the **Events** tab.
4. Find the last successful deployment.
5. Click **Rollback to this deploy**.
