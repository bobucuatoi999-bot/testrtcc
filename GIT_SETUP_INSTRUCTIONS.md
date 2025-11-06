# Git Setup Instructions

## ✅ Current Status

Your files are committed locally. Now we need to connect to GitHub.

## 📋 Step 1: Get Your GitHub Repository URL

### Option A: If You Already Have a Repository

Your GitHub repository URL will be one of these formats:
- `https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git`
- `git@github.com:YOUR-USERNAME/YOUR-REPO-NAME.git`

**Example:**
- `https://github.com/johnsmith/webrtc-call-app.git`

### Option B: If You Need to Create a Repository

1. Go to [github.com](https://github.com)
2. Click the **"+"** icon → **"New repository"**
3. Name it: `webrtc-call-app` (or any name)
4. Choose **Public** or **Private**
5. **DO NOT** initialize with README, .gitignore, or license
6. Click **"Create repository"**
7. Copy the repository URL (it will show on the next page)

## 📋 Step 2: Connect and Push

### Method 1: Using the Script (Easiest)

Run this command in PowerShell (replace with your actual GitHub URL):

```powershell
# Replace with your actual GitHub repository URL
$repoUrl = "https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git"
git remote add origin $repoUrl
git push -u origin master
```

If you get an error about "main" branch, try:
```powershell
git branch -M main
git push -u origin main
```

### Method 2: Manual Commands

```powershell
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git

# Push to GitHub
git push -u origin master
```

## 🔐 Step 3: Authentication

GitHub may ask for authentication:

### Option A: Personal Access Token (Recommended)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Give it "repo" permissions
4. Copy the token
5. When Git asks for password, paste the token (not your GitHub password)

### Option B: GitHub CLI

```powershell
# Install GitHub CLI (if not installed)
winget install GitHub.cli

# Authenticate
gh auth login
```

## ✅ Verification

After pushing, verify:
1. Go to your GitHub repository in browser
2. You should see all your files:
   - `server.js`
   - `package.json`
   - `package-lock.json` ✅ (updated!)
   - `public/` folder
   - `.gitignore`

## 🚀 Next Step: Connect to Railway

Once code is on GitHub:
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Select your repository
4. Railway will auto-deploy!

## 🐛 Troubleshooting

### "remote origin already exists"
```powershell
git remote remove origin
git remote add origin YOUR-REPO-URL
```

### "Authentication failed"
- Use Personal Access Token instead of password
- Or use GitHub CLI: `gh auth login`

### "Permission denied"
- Make sure you have push access to the repository
- Check repository URL is correct

---

## 💡 Quick Command Reference

```powershell
# Check current status
git status

# See what's committed
git log --oneline

# Add remote (replace with your URL)
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Push to GitHub
git push -u origin master

# Or if using main branch
git branch -M main
git push -u origin main
```

---

**Once you provide your GitHub repository URL, I can help you push!** 🚀

