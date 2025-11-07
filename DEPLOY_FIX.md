# 🔧 Fix: Railway Deployed Backend Instead of Frontend

## ❌ What Happened?

You created a new service on Railway, but it deployed the **backend** again instead of the frontend. This is because Railway detected the `server/Dockerfile` in your repo and thought it should deploy that.

**You DON'T need a separate repo!** You can deploy both from the same repo - you just need to configure Railway correctly.

## ✅ Solution: Configure Service as Static Site

You have two options:

### Option A: Fix the Existing Service (Recommended)

1. **Go to Railway Dashboard**
2. **Click on the NEW service** you just created (`testrtcc-production-2f74`)
3. **Click "Settings" tab**
4. **Look for "Source" or "Service Source" section**
5. **Change the configuration:**

   **Root Directory:**
   - Set to: `frontend`
   
   **Build Command:**
   - Set to: `npm install && npm run build`
   
   **Output Directory:**
   - Set to: `dist`
   
   **Start Command:**
   - Set to: `npx serve -s dist -l $PORT`
   
   **OR if you see "Service Type":**
   - Change from "Docker" to "Static Site" or "Nixpacks"

6. **Go to "Variables" tab**
7. **Add Environment Variable:**
   - Key: `VITE_API_URL`
   - Value: `https://testrtcc-production.up.railway.app`

8. **Click "Redeploy" or "Deploy"**

### Option B: Delete and Create New Static Site Service

1. **Delete the new service** you just created:
   - Go to service settings
   - Click "Delete" or "Remove Service"
   - Confirm deletion

2. **Create a NEW service:**
   - Click "+ New" in your project
   - Select **"Static Site"** (NOT "GitHub Repo")
   - OR if "Static Site" is not available:
     - Select "GitHub Repo"
     - Then in settings, change type to "Static Site"

3. **Configure the Static Site:**
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
   - **Start Command**: `npx serve -s dist -l $PORT`

4. **Add Environment Variable:**
   - Key: `VITE_API_URL`
   - Value: `https://testrtcc-production.up.railway.app`

5. **Deploy!**

## 🎯 Key Difference

### Backend Service (Docker):
- Uses: `server/Dockerfile`
- Builds: TypeScript server
- Runs: Node.js server
- Port: 3000

### Frontend Service (Static Site):
- Uses: `frontend/` directory
- Builds: React/Vite app
- Serves: Static files from `dist/`
- Port: Railway assigns

## 📋 What You Should See

### Backend Service (Existing):
- URL: `https://testrtcc-production.up.railway.app/`
- Response: `{"message":"WebRTC Signaling Server",...}`

### Frontend Service (New):
- URL: `https://[something-different].up.railway.app/`
- Response: Your React app UI (landing page with "Create Room" button)

## 🔍 How to Tell Which is Which

**Backend:**
- Shows JSON when you visit the URL
- Has `/health` endpoint
- Has `/debug/rooms` endpoint

**Frontend:**
- Shows your React app UI
- Has "Create Room" and "Join Room" buttons
- No JSON response

## ✅ Checklist

- [ ] Identify which service is backend vs frontend
- [ ] Configure frontend service as "Static Site" (not Docker)
- [ ] Set Root Directory to `frontend`
- [ ] Set Build Command to `npm install && npm run build`
- [ ] Set Output Directory to `dist`
- [ ] Add `VITE_API_URL` environment variable
- [ ] Redeploy frontend service
- [ ] Test frontend URL - should show UI, not JSON
- [ ] Update backend CORS with frontend URL

## 🎉 After Fix

You should have:
- **Backend**: `https://testrtcc-production.up.railway.app/` (JSON)
- **Frontend**: `https://[new-url].up.railway.app/` (React UI)

Both in the same Railway project, from the same GitHub repo! 🚀

