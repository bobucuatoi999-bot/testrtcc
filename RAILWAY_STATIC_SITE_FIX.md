# 🔧 Fix: Railway Static Site Deployment Error

## ❌ Error You're Seeing

```
error: undefined variable 'nodejs-20_x'
```

This happened because the `nixpacks.toml` file had an incorrect package name format.

## ✅ Solution: Use Railway's Auto-Detection

Railway can auto-detect Vite/React projects! You don't need custom nixpacks configuration.

### Step 1: Delete/Remove Custom Config (Already Done in Code)

I've removed the problematic `nixpacks.toml` file. Railway will now auto-detect your Vite project.

### Step 2: Configure Service as Static Site

1. **Go to Railway Dashboard**
2. **Click on your frontend service** (the one with the error)
3. **Go to "Settings" tab**
4. **Look for "Source" or "Service Source" section**

### Step 3: Configure Manually

**Set these values:**

```
Service Type: Static Site (or Nixpacks)
Root Directory: frontend
Build Command: npm install && npm run build
Output Directory: dist
Start Command: npx serve -s dist -l $PORT
```

**OR if Railway has auto-detected:**

Railway might show:
- ✅ Detected: Vite
- ✅ Build Command: (auto-detected)
- ✅ Output Directory: (auto-detected)

**Make sure:**
- Root Directory is set to `frontend`
- Build Command is: `npm install && npm run build`
- Output Directory is: `dist`

### Step 4: Add Environment Variable

1. **Go to "Variables" tab**
2. **Add:**
   - Key: `VITE_API_URL`
   - Value: `https://testrtcc-production.up.railway.app`
3. **Save**

### Step 5: Redeploy

1. **Click "Redeploy"** or **"Deploy"**
2. **Wait for build** (should work now!)

## 🎯 Alternative: Simple Static Site Approach

If Railway's auto-detection still has issues, you can use Railway's built-in static site deployer:

### Option A: Railway Static Site Template

1. **Delete the current frontend service**
2. **Click "+ New"**
3. **Select "Static Site"** (not "GitHub Repo")
4. **Connect your GitHub repo**
5. **Configure:**
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
6. **Add environment variable:**
   - `VITE_API_URL=https://testrtcc-production.up.railway.app`
7. **Deploy!**

### Option B: Use Vercel for Frontend (Easier)

If Railway keeps having issues with static sites, you can deploy frontend to Vercel instead:

1. **Go to Vercel**: https://vercel.com/dashboard
2. **Add New Project** → Import `testrtcc` repo
3. **Configure:**
   - Root Directory: `frontend`
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Add Environment Variable:**
   - `VITE_API_URL=https://testrtcc-production.up.railway.app`
5. **Deploy!**
6. **Update backend CORS** with Vercel URL

## ✅ What Changed

I've removed:
- ❌ `frontend/nixpacks.toml` (incorrect package name)
- ❌ `frontend/railway.json` (not needed)

Railway will now:
- ✅ Auto-detect Vite/React project
- ✅ Use default Node.js version
- ✅ Build correctly

## 🧪 Expected Build Process

After fix, Railway should:
1. ✅ Detect Vite project
2. ✅ Install Node.js automatically
3. ✅ Run `npm install`
4. ✅ Run `npm run build`
5. ✅ Serve `dist/` folder
6. ✅ Deploy successfully!

## 📋 Quick Checklist

- [ ] Service configured as "Static Site"
- [ ] Root Directory set to `frontend`
- [ ] Build Command: `npm install && npm run build`
- [ ] Output Directory: `dist`
- [ ] Start Command: `npx serve -s dist -l $PORT` (optional)
- [ ] `VITE_API_URL` environment variable added
- [ ] Redeployed service
- [ ] Build succeeds (no more nixpacks errors)

## 🎉 After Fix

Your frontend should deploy successfully and show the React UI instead of JSON!

---

**The error is fixed in the code - just redeploy and it should work!** 🚀

