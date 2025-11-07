# Railway Deployment Guide

## 🚀 Complete Deployment Guide for Railway

This guide will help you deploy your WebRTC Mesh Video Call app to Railway at `https://testrtcc-production.up.railway.app/`.

---

## ✅ Pre-Deployment Checklist

### Critical Issues Fixed:
- ✅ WebSocket URL now supports HTTPS/WSS (fixed)
- ✅ Environment variables configuration
- ✅ CORS settings for production
- ✅ Railway-specific configuration

---

## 📋 Step 1: Prepare Your Code

### 1.1 Verify All Changes Are Committed

```powershell
git status
git add .
git commit -m "Prepare for Railway deployment - fix WebSocket WSS support"
```

### 1.2 Create/Update .gitignore (if needed)

Ensure `.env` is in `.gitignore` (never commit secrets!):

```
.env
node_modules/
dist/
logs/
*.log
```

---

## 🔧 Step 2: Railway Configuration

### 2.1 Create Two Services on Railway

Railway requires **separate services** for backend and frontend:

#### **Service 1: Backend**
- **Name**: `webrtc-backend`
- **Root Directory**: `/backend`
- **Build Command**: (leave empty, uses Dockerfile)
- **Start Command**: (leave empty, uses Dockerfile)
- **Port**: `3000`

#### **Service 2: Frontend**
- **Name**: `webrtc-frontend`
- **Root Directory**: `/frontend`
- **Build Command**: (leave empty, uses Dockerfile)
- **Start Command**: (leave empty, uses Dockerfile)
- **Port**: `5173`

---

## 🔐 Step 3: Set Environment Variables in Railway

### Backend Service Environment Variables:

Go to Railway Dashboard → Backend Service → Variables → Add the following:

```env
APPHOST=0.0.0.0
APPPORT=3000
PUBLIC_URL=https://testrtcc-production.up.railway.app
NODE_ENV=production
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app
MAX_PARTICIPANTS=4
TURNHOST=
TURNPORT=3478
TURN_SECRET=your-secure-random-secret-key-change-this-12345
TURN_REALM=webrtc
JWT_SECRET=your-secure-jwt-secret-change-this-67890
MONITORING_ENABLED=false
PROMETHEUS_PORT=9100
RATE_LIMIT_WS_PER_MINUTE=600
```

**⚠️ IMPORTANT:**
- Replace `TURN_SECRET` and `JWT_SECRET` with secure random strings
- Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Frontend Service Environment Variables:

```env
VITE_API_URL=https://testrtcc-production.up.railway.app
VITE_PUBLIC_URL=https://testrtcc-production.up.railway.app
```

**⚠️ CRITICAL:** Use `https://` (not `http://`) for production!

---

## 🐳 Step 4: Railway Deployment Methods

### Option A: Deploy from GitHub (Recommended)

1. **Push to GitHub:**
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Connect Railway to GitHub:**
   - Go to Railway Dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway will auto-detect services

3. **Configure Services:**
   - Railway will create services automatically
   - Set Root Directory for each service:
     - Backend: `backend`
     - Frontend: `frontend`

### Option B: Deploy with Railway CLI

1. **Install Railway CLI:**
   ```powershell
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Railway:**
   ```powershell
   railway init
   railway link
   ```

3. **Deploy:**
   ```powershell
   # Deploy backend
   cd backend
   railway up

   # Deploy frontend
   cd ../frontend
   railway up
   ```

---

## 🌐 Step 5: Configure Railway Domains

### 5.1 Backend Service

1. Go to Backend Service → Settings → Networking
2. Generate Domain or use custom domain
3. Note the domain (e.g., `webrtc-backend-production.up.railway.app`)

### 5.2 Frontend Service

1. Go to Frontend Service → Settings → Networking
2. Set domain to: `testrtcc-production.up.railway.app`
3. Or generate Railway domain

### 5.3 Update Environment Variables

After getting domains, update:

**Backend:**
```env
PUBLIC_URL=https://testrtcc-production.up.railway.app
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app
```

**Frontend:**
```env
VITE_API_URL=https://webrtc-backend-production.up.railway.app
VITE_PUBLIC_URL=https://testrtcc-production.up.railway.app
```

---

## 🔒 Step 6: Security Configuration

### 6.1 CORS Configuration

Update backend `CORS_ALLOW_ORIGIN` to your exact frontend domain:

```env
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app
```

For multiple domains (if needed):
```env
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app,https://yourdomain.com
```

### 6.2 Generate Secure Secrets

**In PowerShell:**
```powershell
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('TURN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and set in Railway environment variables.

---

## 🧪 Step 7: Test Deployment

### 7.1 Test Backend

```powershell
# Test health endpoint
curl https://webrtc-backend-production.up.railway.app/health

# Should return: {"status":"healthy",...}
```

### 7.2 Test Frontend

1. Open browser: `https://testrtcc-production.up.railway.app`
2. Check browser console (F12) for errors
3. Test WebSocket connection:
   - Create a room
   - Check console for "WebSocket connected"
   - Verify it uses `wss://` (not `ws://`)

### 7.3 Test WebRTC

1. Open two browser tabs/windows
2. Join the same room from both
3. Verify video/audio works
4. Test screen sharing

---

## 🐛 Troubleshooting

### Issue: WebSocket Connection Failed

**Symptoms:** `WebSocket connection failed` or `ERR_CONNECTION_REFUSED`

**Solutions:**
1. Verify `VITE_API_URL` uses `https://` (not `http://`)
2. Check backend is running: Test `/health` endpoint
3. Verify CORS settings include frontend domain
4. Check Railway logs for errors

### Issue: CORS Errors

**Symptoms:** `Access-Control-Allow-Origin` errors

**Solutions:**
1. Update `CORS_ALLOW_ORIGIN` in backend environment variables
2. Ensure it matches exact frontend URL (including `https://`)
3. Restart backend service after changes

### Issue: Video Not Connecting

**Symptoms:** Users can't see each other's video

**Solutions:**
1. Check browser console for WebRTC errors
2. Verify STUN/TURN servers are accessible
3. Check Railway logs for signaling errors
4. Test with different networks (WiFi, 4G)

### Issue: Environment Variables Not Working

**Symptoms:** App still uses localhost URLs

**Solutions:**
1. Verify environment variables are set in Railway
2. **Frontend:** Rebuild required after env var changes
3. **Backend:** Restart service after env var changes
4. Check Railway logs to confirm env vars are loaded

---

## 📊 Monitoring

### Railway Dashboard

- **Logs:** View real-time logs for both services
- **Metrics:** Monitor CPU, memory, network usage
- **Deployments:** View deployment history

### Health Checks

- Backend: `https://webrtc-backend-production.up.railway.app/health`
- Frontend: `https://testrtcc-production.up.railway.app`

---

## 🔄 Step 8: Continuous Deployment

### Auto-Deploy from GitHub

1. Railway auto-deploys on git push (if connected)
2. Monitor Railway dashboard for deployment status
3. Check logs if deployment fails

### Manual Deploy

```powershell
git add .
git commit -m "Update for production"
git push
```

Railway will automatically:
1. Build Docker images
2. Deploy new version
3. Switch traffic to new deployment

---

## ✅ Post-Deployment Checklist

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] WebSocket connects (check console for `wss://`)
- [ ] CORS errors resolved
- [ ] Video calls work between two users
- [ ] Screen sharing works
- [ ] Environment variables are set correctly
- [ ] SSL/HTTPS is enabled (Railway does this automatically)
- [ ] Secrets are secure (not in code)

---

## 🎯 Quick Reference

### Railway URLs
- **Frontend:** `https://testrtcc-production.up.railway.app`
- **Backend API:** `https://webrtc-backend-production.up.railway.app`
- **Health Check:** `https://webrtc-backend-production.up.railway.app/health`

### Important Environment Variables

**Backend:**
- `PUBLIC_URL` - Frontend URL
- `CORS_ALLOW_ORIGIN` - Allowed origins
- `JWT_SECRET` - JWT signing secret
- `TURN_SECRET` - TURN server secret

**Frontend:**
- `VITE_API_URL` - Backend API URL
- `VITE_PUBLIC_URL` - Public frontend URL

---

## 🚀 You're Ready!

Your app should now be live on Railway! 

**Next Steps:**
1. Test thoroughly with multiple users
2. Monitor Railway logs
3. Set up error tracking (optional)
4. Consider adding TURN server for better connectivity

---

## 📞 Support

If you encounter issues:
1. Check Railway logs
2. Check browser console
3. Verify environment variables
4. Test endpoints individually
5. Check Railway status page

Good luck with your deployment! 🎉

