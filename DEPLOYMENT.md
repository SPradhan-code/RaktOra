# 🚀 RaktOra Deployment Guide

> **This file is a quick reference redirect.**  
> The canonical, authoritative deployment guide for RaktOra is located at:
>
> 📖 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

---

## Production Architecture

RaktOra is deployed as a **unified full-stack Node.js service on [Render.com](https://render.com)**:

- **Express backend** serves both the REST API (`/api/*`) and the compiled React production build (`frontend/dist`).
- **Single Render Web Service** hosts frontend UI and backend API on a single URL (e.g. `https://raktora.onrender.com`), eliminating CORS issues.
- **Health Check Path**: `/ready` (Render probes this path to verify database connectivity before routing traffic).

For complete deployment instructions, environment variable configuration, database initialization, smoke test procedures, and rollback steps, see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
