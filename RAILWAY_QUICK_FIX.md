# 🚨 Railway Deployment Quick Fix

## Problem: "Dockerfile does not exist"

Railway can't find the Dockerfile because it's looking in the root directory, but Dockerfiles are in `backend/` and `frontend/` folders.

## ✅ Solution (2 minutes):

### Step 1: Set Root Directory for Backend

1. Railway Dashboard → **Backend Service** → **Settings**
2. Find **"Root Directory"** field
3. Enter: `backend`
4. Click **Save**

### Step 2: Set Root Directory for Frontend

1. Railway Dashboard → **Frontend Service** → **Settings**
2. Find **"Root Directory"** field
3. Enter: `frontend`
4. Click **Save**

### Step 3: Redeploy

1. Go to **Deployments** tab
2. Click **"Redeploy"** or trigger a new deployment
3. Railway will now find the Dockerfiles in the correct directories

## ✅ That's it!

After setting Root Directory, Railway will:
- ✅ Find `backend/Dockerfile` for backend service
- ✅ Find `frontend/Dockerfile` for frontend service
- ✅ Build and deploy successfully

## 📸 Visual Guide:

**Backend Service Settings:**
```
Service Name: webrtc-backend
Root Directory: backend    ← SET THIS!
Port: 3000
```

**Frontend Service Settings:**
```
Service Name: webrtc-frontend
Root Directory: frontend   ← SET THIS!
Port: 5173
```

## 🐛 Still Not Working?

If it still fails:
1. Check Railway logs for specific errors
2. Verify Dockerfiles exist in `backend/` and `frontend/`
3. Try redeploying after setting Root Directory

