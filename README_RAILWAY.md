# 🚂 Railway Deployment - IMPORTANT SETUP

## ⚠️ CRITICAL: Set Root Directory!

Railway needs to know where to find the Dockerfiles.

### Backend Service:
**Root Directory:** `backend`

### Frontend Service:
**Root Directory:** `frontend`

## 📋 Setup Steps:

1. **Create Backend Service:**
   - Root Directory: `backend`
   - Port: `3000`
   - Environment Variables: See `RAILWAY_ENV_VARS.md`

2. **Create Frontend Service:**
   - Root Directory: `frontend`
   - Port: `5173`
   - Environment Variables: See `RAILWAY_ENV_VARS.md`

3. **Set Environment Variables:**
   - Backend: Copy from `RAILWAY_ENV_VARS.md`
   - Frontend: Copy from `RAILWAY_ENV_VARS.md`

4. **Deploy:**
   - Railway will auto-deploy after setting Root Directory

## 🎯 Quick Fix:

See `RAILWAY_QUICK_FIX.md` for step-by-step instructions.

