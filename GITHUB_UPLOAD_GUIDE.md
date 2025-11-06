# GitHub Upload Guide for Railway Deployment

## 📋 Files to Upload to GitHub

For Railway deployment, you need to upload these files to GitHub:

### ✅ **Essential Files (Required)**

```
TEST RTC/
├── server.js                    ✅ MUST UPLOAD
├── package.json                 ✅ MUST UPLOAD
├── package-lock.json            ✅ MUST UPLOAD (if exists)
├── .gitignore                   ✅ MUST UPLOAD
│
└── public/                      ✅ MUST UPLOAD (entire folder)
    ├── index.html              ✅
    ├── client.js               ✅
    ├── config.js               ✅
    └── README.txt              ✅ (optional)
```

### 📄 **Documentation Files (Optional but Recommended)**

```
├── README.md                    ⚠️ Recommended
├── QUICK_START.md              ⚠️ Optional
├── ANDROID_SETUP.md            ⚠️ Optional
├── DEPLOYMENT_GUIDE.md          ⚠️ Optional
└── ANDROID_APK_COMPLETE_GUIDE.md ⚠️ Optional
```

### ❌ **Files NOT to Upload (Already in .gitignore)**

These will be automatically excluded:
- `node_modules/` - Will be installed by Railway
- `android/` - Not needed for backend deployment
- `.capacitor/` - Capacitor cache
- Any `.env` files - Environment variables
- Build outputs (`.apk`, `.aab`, etc.)

---

## 🚀 Step-by-Step: Upload to GitHub

### Method 1: Using GitHub Web Interface (Easiest)

1. **Create New Repository on GitHub**
   - Go to [github.com](https://github.com)
   - Click "New" repository
   - Name it: `webrtc-call-app` (or any name)
   - Make it **Public** or **Private**
   - Click "Create repository"

2. **Upload Files via Web**
   - In your new repository, click "uploading an existing file"
   - Drag and drop these files:
     - `server.js`
     - `package.json`
     - `package-lock.json` (if exists)
     - `.gitignore`
     - **Entire `public` folder** (drag the whole folder)
   - Click "Commit changes"

### Method 2: Using Git Command Line (Recommended)

Open PowerShell in your project folder:

```powershell
# Navigate to project
cd "C:\Users\Admin\Documents\wps\TEST RTC"

# Initialize git (if not already done)
git init

# Add all essential files
git add server.js
git add package.json
git add package-lock.json
git add .gitignore
git add public/

# Optional: Add documentation
git add README.md
git add QUICK_START.md

# Commit
git commit -m "Initial commit: WebRTC signaling server"

# Add your GitHub repository (replace with your actual repo URL)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Push to GitHub
git push -u origin main
```

**Note**: If you don't have Git installed, download from [git-scm.com](https://git-scm.com/)

---

## ✅ Verification Checklist

Before connecting to Railway, verify:

- [ ] `server.js` is in repository
- [ ] `package.json` is in repository
- [ ] `public/` folder is in repository (with all files)
- [ ] `.gitignore` is in repository
- [ ] `node_modules/` is NOT in repository (check .gitignore)
- [ ] Repository is accessible (public or you have access)

---

## 🔗 Connect to Railway

After uploading to GitHub:

1. Go to [railway.app](https://railway.app)
2. Sign up/Login
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Authorize Railway to access GitHub
6. Select your repository
7. Railway will auto-detect Node.js and deploy!

**Railway will automatically:**
- Run `npm install` (installs dependencies)
- Run `npm start` (starts server.js)
- Provide a public URL

---

## 📝 Important Notes

### ⚠️ Server URL Configuration

**Before building Android APK**, you'll need to update `public/config.js` with your Railway URL. But for Railway deployment, you can keep it as `localhost:3000` initially - Railway will handle the port automatically.

After Railway deployment:
1. Get your Railway URL (e.g., `https://your-app.railway.app`)
2. Update `public/config.js`:
   ```javascript
   window.SERVER_URL = 'https://your-app.railway.app';
   ```
3. Commit and push to GitHub
4. Railway will auto-deploy the update

### 🔒 Environment Variables (Optional)

If you need custom configuration, Railway supports environment variables:
- `PORT` - Railway sets this automatically
- `NODE_ENV` - Set to `production` (optional)

You can set these in Railway dashboard → Variables tab.

---

## 🎯 Quick Summary

**Minimum files needed:**
1. ✅ `server.js`
2. ✅ `package.json`
3. ✅ `public/` folder (all files)
4. ✅ `.gitignore`

That's it! Railway will handle the rest.

---

## ❓ Troubleshooting

### "No start script found"
- Ensure `package.json` has: `"start": "node server.js"`

### "Module not found"
- Railway runs `npm install` automatically
- Check `package.json` has all dependencies listed

### "Port already in use"
- Railway sets `PORT` automatically via environment variable
- Your `server.js` should use: `process.env.PORT || 3000`

### Files not uploading
- Check file size limits on GitHub (100MB per file)
- Ensure `.gitignore` isn't excluding important files

---

## 🚀 You're Ready!

Once files are on GitHub:
1. ✅ Connect to Railway
2. ✅ Railway auto-deploys
3. ✅ Get your server URL
4. ✅ Update `public/config.js` with Railway URL
5. ✅ Push update to GitHub
6. ✅ Railway auto-deploys update
7. ✅ Build Android APK with new server URL

Good luck! 🎉

