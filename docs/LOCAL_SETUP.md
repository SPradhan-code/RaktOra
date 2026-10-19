# RaktOra Local Setup & Zero-Cost Deployment Guide

This guide provides step-by-step instructions for setting up and running RaktOra on Windows using **Windows PowerShell**, operating strictly within a **₹0 budget**.

---

## 1. Prerequisites

Ensure the following free, open-source software is installed on your Windows machine:

1. **Node.js**: v18.x or v20.x LTS ([Download Node.js](https://nodejs.org/))
2. **MySQL Server**: Community Edition 8.0+ or MariaDB 10.5+ ([Download MySQL Community](https://dev.mysql.com/downloads/mysql/)) or a free cloud MySQL database (such as Aiven MySQL free tier).
3. **Git for Windows**: ([Download Git](https://git-scm.com/))
4. **PowerShell**: Windows PowerShell 5.1 or PowerShell Core 7.x.

---

## 2. Repository Setup

Open **Windows PowerShell** and navigate to your project workspace:

```powershell
# Verify Node and Git installations
node -v
npm -v
git --version

# Navigate to project root
cd d:\RaktOra
```

### 2.1. Install Root, Backend, and Frontend Dependencies
```powershell
# Install root orchestration packages
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

## 3. Database Initialization & Schema Migrations

### 3.1. Create Database
In PowerShell, log in to your MySQL terminal and create the `raktora` database:
```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS raktora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.2. Apply Migrations
Apply the migrations in sequential order:
```powershell
# 1. Base Schema
mysql -u root -p raktora < database\schema.sql

# 2. Sequential Migrations
mysql -u root -p raktora < database\migrations\001_sync_current_schema.sql
mysql -u root -p raktora < database\migrations\002_auth_security_upgrade.sql
mysql -u root -p raktora < database\migrations\003_digilocker_identity_schema.sql
```

### 3.3. (Optional) Populate Seed Development Data
```powershell
cd backend
node seed.js
cd ..
```

---

## 4. Environment Configuration

### 4.1. Configure Backend Environment
Copy the example environment template:
```powershell
Copy-Item backend\.env.example backend\.env
```

Open `backend\.env` in your editor and configure the variables:
```ini
# ==============================================================================
# RaktOra Server Configuration
# ==============================================================================
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# ==============================================================================
# Database Configuration (MySQL / MariaDB)
# ==============================================================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=raktora
DB_PORT=3306

# ==============================================================================
# JWT Security Secret (Minimum 32-character high-entropy secret)
# ==============================================================================
JWT_SECRET=c8f8b89d81d2f939e6a92f08a47bbf2234091a1df28a7b3e0c051f28b4938634

# ==============================================================================
# Genuine DigiLocker Partner Credentials (OAuth 2.0 PKCE)
# Portal: https://partners.digitallocker.gov.in
# Leave placeholder values until authorized partner credentials are issued.
# ==============================================================================
ENABLE_DIGILOCKER=true
DIGILOCKER_CLIENT_ID=your_registered_client_id_here
DIGILOCKER_CLIENT_SECRET=your_registered_client_secret_here
DIGILOCKER_REDIRECT_URI=http://localhost:5000/api/auth/digilocker/callback
DIGILOCKER_AUTH_URL=https://digitallocker.gov.in/public/oauth2/1/authorize
DIGILOCKER_TOKEN_URL=https://digitallocker.gov.in/public/oauth2/1/token
DIGILOCKER_USERINFO_URL=https://digitallocker.gov.in/public/oauth2/1/user
```

---

## 5. Running the Application Locally

You can run both services concurrently using two separate PowerShell terminal tabs.

### Terminal Tab 1: Backend Server (Port 5000)
```powershell
cd d:\RaktOra\backend
npm run dev
```
*Expected Output:*
```
Server running on port 5000 in development mode
Database pool initialized successfully
```

### Terminal Tab 2: Frontend Client (Port 3000)
```powershell
cd d:\RaktOra\frontend
npm run dev
```
*Expected Output:*
```
  VITE v5.4.14  ready in 320 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

---

## 6. Verifying Startup & Readiness

Execute the following PowerShell commands to verify all probes and health endpoints:

```powershell
# 1. Test Liveness Probe
Invoke-RestMethod -Uri "http://localhost:5000/health" -Method Get

# 2. Test Database Readiness Probe
Invoke-RestMethod -Uri "http://localhost:5000/ready" -Method Get

# 3. Test DigiLocker Zero-Cost Boundary Status
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/digilocker/status" -Method Get
```

Open your browser and navigate to `http://localhost:3000`.
- The frontend shell loads immediately.
- If the backend is active, the status banner confirms full readiness.
- If the backend is paused, the non-blocking status banner displays a graceful reconnect indicator without freezing the UI.

---

## 7. Zero-Cost DigiLocker Partner Onboarding Guide

DigiLocker partner access is provided free of cost by the Ministry of Electronics and Information Technology (MeitY) / National e-Governance Division (NeGD) to registered non-profits, healthcare institutions, and government bodies.

### Step-by-Step Onboarding Process:
1. **Visit Partner Portal**: Navigate to [https://partners.digitallocker.gov.in](https://partners.digitallocker.gov.in).
2. **Organization Registration**: Register your non-profit, hospital trust, or healthcare initiative with organizational proof (Trust Deed, Society Registration, or Section 8 Certificate).
3. **Select Requester Service**: Select **OAuth 2.0 Requester Integration**.
4. **Register Redirect URI**:
   - For local development: `http://localhost:5000/api/auth/digilocker/callback`
   - For production deployment: `https://your-domain.org/api/auth/digilocker/callback`
5. **Obtain Client Credentials**: Upon review and approval by NeGD, your dashboard will issue:
   - `Client ID`
   - `Client Secret`
6. **Activate in RaktOra**:
   Update `backend/.env` with the issued `DIGILOCKER_CLIENT_ID` and `DIGILOCKER_CLIENT_SECRET`.
   Restart your backend service. Genuine DigiLocker-first login is now live!
