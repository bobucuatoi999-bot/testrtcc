# 🖱️ Railway Frontend Deployment - Click-by-Click Guide

## 📍 You Are Here: Railway Dashboard → Your Project

### Step 1: Find the "+ New" Button

**Look for:**
- A big **"+ New"** button (usually blue or purple)
- OR **"+ New Service"** button
- Usually at the **top right** of your project dashboard
- OR in the **left sidebar**

**What you should see:**
```
┌─────────────────────────────────────┐
│  Your Project Name                  │
│  ┌───────────────────────────────┐  │
│  │  [Backend Service]            │  │
│  │  Status: Running              │  │
│  └───────────────────────────────┘  │
│                                      │
│  [+ New]  ← Click this button!      │
└─────────────────────────────────────┘
```

### Step 2: Select Service Type

**After clicking "+ New", you'll see options:**
- **"GitHub Repo"** ← Click this first
- OR **"Static Site"** ← Or this if available
- OR **"Empty Service"** ← Don't choose this

**If you see a dropdown menu:**
1. Click **"+ New Service"**
2. Then select **"GitHub Repo"** or **"Static Site"**

### Step 3: Connect GitHub Repository

**You'll see:**
- A list of your GitHub repositories
- Look for: `bobucuatoi999-bot/testrtcc` or `testrtcc`
- **Click on your repository**

**If you don't see your repo:**
- Click **"Configure GitHub App"** or **"Connect GitHub"**
- Authorize Railway to access your repos
- Then select `testrtcc`

### Step 4: Configure the Service

**Railway might auto-detect, but if it asks for configuration:**

#### Option A: If it shows "Detect Settings" or "Auto-detect"
- **Click "Detect Settings"** or **"Deploy"**
- Railway will try to auto-configure

#### Option B: If it shows configuration options manually:

**Root Directory:**
- Find field: **"Root Directory"** or **"Working Directory"**
- Type: `frontend`
- (This tells Railway where your frontend code is)

**Build Command:**
- Find field: **"Build Command"**
- Type: `npm install && npm run build`

**Output Directory:**
- Find field: **"Output Directory"** or **"Publish Directory"**
- Type: `dist`

**Start Command:**
- Find field: **"Start Command"** (optional)
- Leave **empty** OR type: `npx serve -s dist -l $PORT`
- Railway will auto-detect if empty

### Step 5: Add Environment Variable

**Look for:**
- Tab: **"Variables"** or **"Environment"**
- OR Button: **"Add Environment Variable"**
- OR Section: **"Environment Variables"**

**Click "Add Variable" or "+ Add" button**

**Add this variable:**
- **Key (Name)**: `VITE_API_URL`
- **Value**: `https://testrtcc-production.up.railway.app`
- Click **"Add"** or **"Save"**

### Step 6: Deploy!

**Look for:**
- Big button: **"Deploy"** (usually green/blue)
- OR **"Create Service"**
- OR **"Save"**

**Click it!**

**What happens:**
- Railway will start building
- You'll see logs appearing
- Wait 2-3 minutes

### Step 7: Get Your Frontend URL

**After deployment completes:**

**Look for:**
- **"Settings"** tab → **"Domains"** section
- OR **"Deployments"** → Latest deployment → **"View"**
- OR A **domain/URL** shown at the top of the service

**You'll see something like:**
- `https://testrtcc-frontend-production.up.railway.app`
- OR `https://your-project-frontend.railway.app`

**Copy this URL!**

### Step 8: Update Backend CORS

**Go back to your backend service:**
1. Click on your **backend service** (the one that's already running)
2. Click **"Variables"** tab
3. Find `CORS_ORIGIN` variable
4. Click **"Edit"** or the **pencil icon**
5. Change value to: `https://[your-frontend-url].railway.app`
   - Replace `[your-frontend-url]` with the URL from Step 7
6. Click **"Save"**
7. Railway will auto-redeploy backend

## 🎯 Visual Guide - What to Look For

### Railway Project Dashboard Layout:

```
┌────────────────────────────────────────────┐
│  Railway Dashboard                         │
├────────────────────────────────────────────┤
│  [Your Project Name]                       │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Backend Service                     │ │
│  │  Status: ✅ Running                  │ │
│  │  https://testrtcc-production...      │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [+ New]  ← CLICK HERE                    │
│                                            │
│  Settings | Variables | Deployments       │
└────────────────────────────────────────────┘
```

### After Clicking "+ New":

```
┌────────────────────────────────────────────┐
│  Create New Service                        │
├────────────────────────────────────────────┤
│  Select a template:                        │
│                                            │
│  [ ] GitHub Repo        ← Choose this     │
│  [ ] Empty Service                         │
│  [ ] Dockerfile                            │
│  [ ] Static Site       ← Or this          │
│                                            │
│  [Cancel]  [Continue]                      │
└────────────────────────────────────────────┘
```

### Repository Selection:

```
┌────────────────────────────────────────────┐
│  Select Repository                         │
├────────────────────────────────────────────┤
│  Your repositories:                        │
│                                            │
│  ✅ bobucuatoi999-bot/testrtcc  ← Click!  │
│     testrtcc                                │
│                                            │
│  [Cancel]  [Deploy]                        │
└────────────────────────────────────────────┘
```

## 🆘 Can't Find Something?

### If you don't see "+ New" button:
- Try scrolling up/down
- Look in the **left sidebar**
- Check if you're in the right project
- Refresh the page

### If Railway auto-detects wrong settings:
- Click **"Settings"** tab after service is created
- Go to **"Source"** or **"Build"** section
- Edit the fields manually

### If you see errors:
- Check the **"Deployments"** tab
- Click on the latest deployment
- Read the error logs
- Common issues:
  - Wrong root directory
  - Missing build command
  - Environment variable not set

## ✅ Checklist

- [ ] Found and clicked "+ New" button
- [ ] Selected "GitHub Repo" or "Static Site"
- [ ] Selected `testrtcc` repository
- [ ] Set Root Directory to `frontend`
- [ ] Set Build Command to `npm install && npm run build`
- [ ] Set Output Directory to `dist`
- [ ] Added `VITE_API_URL` environment variable
- [ ] Clicked "Deploy"
- [ ] Waited for deployment to complete
- [ ] Copied frontend URL
- [ ] Updated backend `CORS_ORIGIN`
- [ ] Tested frontend URL in browser

## 🎉 Success!

Once you see:
- ✅ Frontend service shows "Running" status
- ✅ Frontend URL is visible
- ✅ Backend CORS updated

Your app is fully deployed! 🚀

---

**Need more help?** Describe what you see on your screen and I'll guide you!

