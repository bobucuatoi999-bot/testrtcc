# Railway Deployment Fix

## Problem
Railway error: `package-lock.json` is out of sync with `package.json`

## ✅ Solution (Quick Fix)

The `package-lock.json` has been updated locally. Now you need to push it to GitHub:

### Step 1: Push Updated package-lock.json to GitHub

**If using Git command line:**
```powershell
cd "C:\Users\Admin\Documents\wps\TEST RTC"
git add package-lock.json
git commit -m "Update package-lock.json for Railway deployment"
git push
```

**If using GitHub web interface:**
1. Go to your repository on GitHub
2. Click "uploading an existing file"
3. Upload the new `package-lock.json` file
4. Commit changes

### Step 2: Railway Will Auto-Redeploy
Railway will automatically detect the change and redeploy.

---

## 🎯 Alternative Solution: Configure Railway to Skip Dev Dependencies

Since Capacitor is only needed for local Android development (not for the backend server), you can configure Railway to skip dev dependencies:

### In Railway Dashboard:
1. Go to your project
2. Click on your service
3. Go to **Settings** tab
4. Under **Build Command**, change from:
   ```
   npm ci
   ```
   to:
   ```
   npm install --production
   ```
5. Save changes

This will:
- ✅ Skip installing Capacitor (not needed for backend)
- ✅ Install only production dependencies (express, socket.io)
- ✅ Faster builds
- ✅ Smaller deployment size

---

## 📋 Recommended: Use Production Install

**Best Practice**: Since Railway is only deploying the backend server, use production install:

**Railway Build Command:**
```
npm install --production
```

**Railway Start Command:**
```
npm start
```

This way:
- ✅ Only installs what's needed (express, socket.io)
- ✅ Skips Capacitor (only needed for Android APK building)
- ✅ Faster deployment
- ✅ No dependency conflicts

---

## ✅ Verification

After pushing `package-lock.json` or changing build command:
1. Railway will automatically redeploy
2. Check deployment logs
3. Should see: "Build successful"
4. Your server URL will be active

---

## 🚀 Quick Commands

**Push package-lock.json:**
```powershell
git add package-lock.json
git commit -m "Fix: Update package-lock.json"
git push
```

**Or configure Railway to use production install** (recommended for backend-only deployment)

