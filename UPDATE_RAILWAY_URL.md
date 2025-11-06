# How to Find Your Railway URL and Update Config

## 🔍 Step 1: Find Your Railway URL

### Method 1: Railway Dashboard (Easiest)

1. Go to [railway.app](https://railway.app)
2. Sign in
3. Click on your project (`testrtcc` or similar)
4. Click on your **service** (the deployed app)
5. Look for one of these:
   - **"Settings"** tab → Scroll to "Domains" section
   - **"Deployments"** tab → Click on latest deployment → Look for URL
   - **"Variables"** tab → Sometimes shows URL
   - **Main dashboard** → Your URL might be displayed at the top

**Your URL will look like one of these:**
- `https://your-app-name.up.railway.app`
- `https://your-app-name.railway.app`
- `https://your-app-name-production.up.railway.app`

### Method 2: Railway CLI

If you have Railway CLI installed:
```powershell
railway status
```

### Method 3: Check Deployment Logs

1. Railway Dashboard → Your Service
2. Click "Deployments" tab
3. Click on the latest deployment
4. Check the logs - the URL might be mentioned there

---

## 📋 Step 2: Once You Have the URL

**Copy your Railway URL** and paste it here, then I'll update the config file for you!

**Or update it yourself:**

1. Open `public/config.js`
2. Find this line:
   ```javascript
   window.SERVER_URL = window.SERVER_URL || 'http://localhost:3000';
   ```
3. Replace with:
   ```javascript
   window.SERVER_URL = 'https://your-actual-railway-url.railway.app';
   ```
4. Save the file

---

## 🚀 Step 3: Push to GitHub

After updating, push to GitHub:

```powershell
git add public/config.js
git commit -m "Update server URL for Railway deployment"
git push
```

Railway will automatically redeploy with the updated frontend!

---

## ✅ Step 4: Test

1. Visit your Railway URL in a browser
2. You should see your WebRTC Call app
3. Open browser console (F12) → Check for: "📡 Server URL configured: https://..."
4. Try connecting - it should use Railway server!

---

## 💡 Quick Copy-Paste Template

Once you have your Railway URL, it should look like this in `config.js`:

```javascript
window.SERVER_URL = 'https://YOUR-RAILWAY-URL-HERE.railway.app';
```

**Just replace `YOUR-RAILWAY-URL-HERE` with your actual URL!**

---

## 🆘 Can't Find URL?

If you can't find it:
1. Check Railway Dashboard → Settings → Generate Domain
2. Or Railway might assign one automatically
3. Check your email - Railway sometimes sends deployment URLs

**Or share a screenshot of your Railway dashboard and I can help locate it!**

