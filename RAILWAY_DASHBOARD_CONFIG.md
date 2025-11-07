# 🚂 Railway Dashboard Configuration - CRITICAL STEPS

## ⚠️ IMPORTANT: Configure Railway Dashboard Settings

Railway might be auto-detecting Dockerfiles. You need to configure the services in Railway dashboard to use Nixpacks.

---

## 📋 Step-by-Step Dashboard Configuration

### Backend Service Configuration:

1. **Go to Railway Dashboard**
   - Open your project
   - Click on **Backend Service**

2. **Settings Tab:**
   - **Root Directory:** `backend` ✅
   - **Build Command:** (LEAVE EMPTY - uses nixpacks.toml)
   - **Start Command:** (LEAVE EMPTY - uses package.json)
   - **Builder:** If option exists, select **"Nixpacks"** or **"Railpack"**

3. **Variables Tab:**
   - Add all environment variables (see RAILWAY_ENV_VARS.md)

4. **Networking Tab:**
   - Generate domain (e.g., `webrtc-backend-production.up.railway.app`)

### Frontend Service Configuration:

1. **Go to Railway Dashboard**
   - Open your project
   - Click on **Frontend Service**

2. **Settings Tab:**
   - **Root Directory:** `frontend` ✅
   - **Build Command:** (LEAVE EMPTY - uses nixpacks.toml)
   - **Start Command:** (LEAVE EMPTY - uses package.json)
   - **Builder:** If option exists, select **"Nixpacks"** or **"Railpack"**

3. **Variables Tab:**
   - Add environment variables:
     ```
     VITE_API_URL=https://your-backend-domain.up.railway.app
     VITE_PUBLIC_URL=https://testrtcc-production.up.railway.app
     ```

4. **Networking Tab:**
   - Set domain: `testrtcc-production.up.railway.app`

---

## 🔧 Alternative: Disable Dockerfile Detection

If Railway keeps trying to use Dockerfile, you can:

### Option 1: Remove Dockerfile from Build Context

Create `.railwayignore` file (already created ✅) to ignore Dockerfiles:
```
backend/Dockerfile
frontend/Dockerfile
```

### Option 2: Rename Dockerfiles Temporarily

Rename Dockerfiles so Railway can't find them:
```bash
# Railway won't detect these
backend/Dockerfile.prod
frontend/Dockerfile.prod
```

### Option 3: Use Environment Variable

Add to Service Variables:
```
RAILWAY_BUILDER=NIXPACKS
```

---

## 🎯 Recommended Approach

**Best Solution:**
1. ✅ Set Root Directory to `backend` and `frontend`
2. ✅ Leave Build/Start commands empty (uses package.json scripts)
3. ✅ Railway will auto-detect Nixpacks from `nixpacks.toml` files
4. ✅ If builder option exists, select "Nixpacks"

**If Builder Option Doesn't Exist:**
- Railway should auto-detect Nixpacks when:
  - Root Directory is set correctly
  - `nixpacks.toml` exists in root directory
  - No Dockerfile is found in root directory
  - `package.json` exists

---

## ✅ Verification Checklist

After configuring:

- [ ] Backend Root Directory: `backend`
- [ ] Frontend Root Directory: `frontend`
- [ ] Build Commands: Empty (or not set)
- [ ] Start Commands: Empty (or not set)
- [ ] Builder: Nixpacks (if option available)
- [ ] Environment Variables: Set correctly
- [ ] Redeploy services

---

## 🐛 Still Not Working?

### Check Railway Service Settings:

1. Go to Service → Settings
2. Check "Build Command" - should be EMPTY
3. Check "Start Command" - should be EMPTY
4. Check "Root Directory" - should be `backend` or `frontend`

### Force Nixpacks via Environment Variable:

Add to each service:
```
RAILWAY_BUILDER=NIXPACKS
```

### Check Deployment Logs:

Look for:
- ✅ "Detected Nixpacks configuration"
- ✅ "Using Nixpacks builder"
- ❌ "Looking for Dockerfile" (means it's still using Dockerfile builder)

---

## 🚀 After Configuration

1. Save all settings
2. Trigger new deployment
3. Check logs - should see "Using Nixpacks builder"
4. Deployment should succeed!

---

**Follow these steps carefully in Railway Dashboard!**

