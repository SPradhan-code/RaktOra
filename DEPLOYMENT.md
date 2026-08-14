# BloodConnect Direct Deployment Guide for Render.com

This guide details how to deploy the entire **BloodConnect** web application (React Frontend + Express Node.js Backend API + MySQL Database) directly onto **[Render.com](https://render.com)**.

---

## Direct Full-Stack Deployment Architecture

The application is configured to build and run as a unified Web Service on Render:
- **Express Backend** serves both the REST API endpoints (`/api/*`) and the compiled static React production build (`frontend/dist`).
- **Single Service**: A single Render Web Service hosts both your frontend UI and backend API on a single URL (e.g. `https://bloodconnect.onrender.com`), eliminating CORS issues and keeping hosting simple.

---

## Step 1: Push Code to GitHub

Make sure your latest code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Configure fullstack deployment directly on Render.com"
git push origin main
```

---

## Step 2: Deploy Directly on Render.com

### Option A: Using Render Blueprint (Automatic Configuration)
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Blueprint**.
3. Select your `Blood_Connect` GitHub repository.
4. Render will automatically read [`render.yaml`](file:///render.yaml).
5. Fill in your MySQL Database credentials:
   - `DB_HOST`: Hostname of your MySQL cloud database (e.g., Aiven, PlanetScale, Railway, or Clever Cloud).
   - `DB_USER`: Database username.
   - `DB_PASSWORD`: Database password.
   - `DB_NAME`: Database name (e.g., `bloodconnect_db`).
   - `DB_PORT`: `3306` (or your provider's custom MySQL port).
6. Click **Apply**. Render will automatically build the React frontend, start the Node backend, and issue a live URL like `https://bloodconnect.onrender.com`.

---

### Option B: Manual Web Service Setup on Render Dashboard
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your `Blood_Connect` GitHub repository.
4. Configure the Web Service:
   - **Name**: `bloodconnect`
   - **Language**: Node
   - **Branch**: `main`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Add Environment Variables under **Advanced**:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_random_secret_jwt_key`
   - `DB_HOST`: *Your cloud MySQL host*
   - `DB_USER`: *Your cloud MySQL user*
   - `DB_PASSWORD`: *Your cloud MySQL password*
   - `DB_NAME`: `bloodconnect_db`
   - `DB_PORT`: `3306`
6. Click **Create Web Service**.

---

## Step 3: Initialize Database Schema & Seed Data

1. Import the schema into your MySQL database using [`database/schema.sql`](file:///database/schema.sql).
2. To seed default sample users (Admin, Donors, Recipients, Blood Banks, Camps), run:
   ```bash
   npm run seed
   ```
   *(Ensure `.env` or environment variables contain your live `DB_HOST` details).*

---

## Summary of Deployment Files

- [`package.json`](file:///package.json): Root monorepo configuration with unified `npm run build` and `npm start` scripts.
- [`render.yaml`](file:///render.yaml): Render Blueprint definition for one-click deployment.
- [`backend/server.js`](file:///backend/server.js): Configured to serve static frontend assets (`frontend/dist`) and handle SPA route fallbacks.
- [`frontend/src/services/api.js`](file:///frontend/src/services/api.js): Uses relative `/api` paths by default in production.
