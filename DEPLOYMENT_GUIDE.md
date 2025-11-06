# Deployment Guide - Backend Server

This guide helps you deploy your WebRTC signaling server to a cloud platform so it's accessible globally.

## Quick Comparison

| Platform | Free Tier | Ease of Use | Recommended For |
|----------|-----------|-------------|-----------------|
| **Railway** | ✅ Yes | ⭐⭐⭐⭐⭐ | Best for beginners |
| **Render** | ✅ Yes | ⭐⭐⭐⭐ | Good alternative |
| **Heroku** | ❌ No | ⭐⭐⭐ | Requires credit card |
| **Fly.io** | ✅ Yes | ⭐⭐⭐ | Good performance |
| **DigitalOcean** | ❌ No | ⭐⭐⭐ | More control |

## Option 1: Railway (Recommended)

### Step 1: Sign Up
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (easiest)

### Step 2: Create New Project
1. Click "New Project"
2. Choose "Deploy from GitHub repo" (recommended) or "Empty Project"

### Step 3: Deploy
**If using GitHub:**
1. Connect your repository
2. Railway auto-detects Node.js
3. It will automatically deploy

**If uploading manually:**
1. Choose "Empty Project"
2. Click "Add Service" → "GitHub Repo" or upload files
3. Railway will detect `package.json` and deploy

### Step 4: Get Your URL
- Railway provides a URL like: `https://your-app-name.up.railway.app`
- Copy this URL
- Update `public/index.html`: `window.SERVER_URL = 'https://your-app-name.up.railway.app'`

### Step 5: Configure Environment (Optional)
- Railway uses `PORT` environment variable automatically
- No additional configuration needed!

**Cost**: Free tier includes $5 credit/month (enough for small apps)

---

## Option 2: Render

### Step 1: Sign Up
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository OR upload files

### Step 3: Configure
- **Name**: Choose a name for your service
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or paid)

### Step 4: Deploy
1. Click "Create Web Service"
2. Render will build and deploy automatically
3. Wait for deployment (5-10 minutes)

### Step 5: Get Your URL
- Render provides: `https://your-app-name.onrender.com`
- Update `public/index.html` with this URL

**Note**: Free tier sleeps after 15 minutes of inactivity (wakes up on first request)

---

## Option 3: Fly.io

### Step 1: Install Fly CLI
```bash
# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Mac/Linux
curl -L https://fly.io/install.sh | sh
```

### Step 2: Sign Up
```bash
flyctl auth signup
```

### Step 3: Create Fly App
```bash
cd "C:\Users\Admin\Documents\wps\TEST RTC"
flyctl launch
```

### Step 4: Deploy
```bash
flyctl deploy
```

### Step 5: Get URL
```bash
flyctl info
```
- URL will be: `https://your-app-name.fly.dev`

---

## Manual Deployment Steps (Any Platform)

### 1. Prepare Your Code

Create a `.env` file (optional):
```env
PORT=3000
NODE_ENV=production
```

### 2. Update package.json (if needed)
Ensure you have:
```json
{
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 3. Create Procfile (for Heroku/Railway)
Create `Procfile` (no extension):
```
web: node server.js
```

### 4. Test Locally First
```bash
npm install
npm start
```
Visit `http://localhost:3000` to verify it works.

---

## After Deployment

### 1. Update Frontend Server URL

Edit `public/index.html`:
```javascript
// Replace localhost with your deployed URL
window.SERVER_URL = 'https://your-deployed-server.com';
```

### 2. Test the Connection

1. Open your deployed server URL in a browser
2. Check browser console for connection status
3. Test with two tabs/browsers using the same room code

### 3. Update Android App

Before building APK:
1. Update `SERVER_URL` in `public/index.html`
2. Run `npx cap sync` to sync changes
3. Rebuild APK in Android Studio

---

## Troubleshooting

### Server Not Starting
- Check logs on your hosting platform
- Verify `PORT` environment variable is set
- Ensure `npm start` command is correct

### CORS Errors
- Your server already has CORS enabled (`origin: '*'`)
- If issues persist, check platform-specific CORS settings

### Connection Refused
- Verify server is running (check platform dashboard)
- Check server URL is correct (HTTPS vs HTTP)
- Ensure firewall/security groups allow connections

### WebSocket Issues
- Some platforms require specific WebSocket configuration
- Check platform documentation for WebSocket support

---

## Production Checklist

- [ ] Server deployed and accessible
- [ ] Server URL updated in `public/index.html`
- [ ] HTTPS enabled (for security)
- [ ] Tested connection from multiple devices
- [ ] Server logs monitored
- [ ] Backup/deployment strategy in place

---

## Cost Estimates

**Free Tier Options:**
- Railway: $5 credit/month (free tier)
- Render: Free (with limitations)
- Fly.io: Free tier available

**Paid Options:**
- Railway: ~$5-10/month for small apps
- Render: $7/month for always-on service
- DigitalOcean: $6/month for basic droplet

---

## Security Notes

1. **HTTPS**: Use HTTPS in production (free SSL from Let's Encrypt)
2. **CORS**: Restrict CORS origins in production (currently `'*'` for testing)
3. **Rate Limiting**: Consider adding rate limiting for production
4. **Authentication**: Add user authentication if needed

---

## Next Steps

1. ✅ Deploy server to chosen platform
2. ✅ Get server URL
3. ✅ Update `SERVER_URL` in frontend
4. ✅ Test connection
5. ✅ Build Android APK (see ANDROID_SETUP.md)

Good luck with your deployment! 🚀

