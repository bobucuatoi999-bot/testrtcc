# 🚀 Railway Deployment Setup - Step by Step

## ✅ Code Pushed to GitHub

Your code has been successfully pushed to: **https://github.com/bobucuatoi999-bot/testrtcc**

---

## 📋 Step-by-Step Railway Setup

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app)
2. Sign in or create account
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Find and select **`bobucuatoi999-bot/testrtcc`**
6. Railway will import your repository

---

### Step 2: Create Backend Service

1. In your Railway project, click **"+ New"** → **"Service"**
2. Select **"GitHub Repo"** → Choose your repository
3. **Configure Backend Service:**
   - **Name**: `webrtc-backend`
   - **Root Directory**: `backend`
   - **Port**: `3000` (Railway will auto-detect)
   - **Build Command**: Leave empty (uses Dockerfile)
   - **Start Command**: Leave empty (uses Dockerfile)

---

### Step 3: Create Frontend Service

1. In your Railway project, click **"+ New"** → **"Service"**
2. Select **"GitHub Repo"** → Choose your repository
3. **Configure Frontend Service:**
   - **Name**: `webrtc-frontend`
   - **Root Directory**: `frontend`
   - **Port**: `5173` (Railway will auto-detect)
   - **Build Command**: Leave empty (uses Dockerfile)
   - **Start Command**: Leave empty (uses Dockerfile)

---

### Step 4: Configure Backend Environment Variables

1. Click on **Backend Service** → **Variables** tab
2. Click **"+ New Variable"** and add each variable:

```env
APPHOST=0.0.0.0
APPPORT=3000
PUBLIC_URL=https://testrtcc-production.up.railway.app
NODE_ENV=production
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app
MAX_PARTICIPANTS=4
TURNHOST=
TURNPORT=3478
TURN_SECRET=1072cfb19f49a386e375fa8c4964cf24e1d4a812acf5cc146a5d17a104575630
TURN_REALM=webrtc
JWT_SECRET=8435030cde4596e3e26a8e54b86a9af9e6cacf3f23c608879bf6c4ad8282fd7a
MONITORING_ENABLED=false
PROMETHEUS_PORT=9100
RATE_LIMIT_WS_PER_MINUTE=600
```

**⚠️ Note:** The secrets above are pre-generated. For production, you may want to regenerate them.

---

### Step 5: Configure Frontend Environment Variables

1. Click on **Frontend Service** → **Variables** tab
2. Click **"+ New Variable"** and add:

```env
VITE_API_URL=https://testrtcc-production.up.railway.app
VITE_PUBLIC_URL=https://testrtcc-production.up.railway.app
```

**⚠️ Important:** After backend deploys, Railway will assign a backend domain. You'll need to update `VITE_API_URL` to that backend domain.

---

### Step 6: Set Up Domains

#### Frontend Domain:

1. Click on **Frontend Service** → **Settings** tab
2. Go to **"Networking"** section
3. Click **"Generate Domain"** or **"Custom Domain"**
4. Set domain to: `testrtcc-production.up.railway.app`
   - Or use Railway's auto-generated domain
5. Save

#### Backend Domain:

1. Click on **Backend Service** → **Settings** tab
2. Go to **"Networking"** section
3. Click **"Generate Domain"**
4. Railway will assign a domain like: `webrtc-backend-production.up.railway.app`
5. **Copy this domain** - you'll need it!

---

### Step 7: Update Environment Variables with Backend Domain

After backend is deployed and you have the backend domain:

1. **Update Frontend Variables:**
   - Go to **Frontend Service** → **Variables**
   - Update `VITE_API_URL` to: `https://your-backend-domain.up.railway.app`
   - Save

2. **Update Backend Variables:**
   - Go to **Backend Service** → **Variables**
   - Ensure `CORS_ALLOW_ORIGIN` matches your frontend domain
   - Save

---

### Step 8: Deploy

Railway will automatically:
1. ✅ Detect Dockerfiles
2. ✅ Build Docker images
3. ✅ Deploy services
4. ✅ Assign domains
5. ✅ Enable HTTPS automatically

**Monitor deployment:**
- Click on each service → **"Deployments"** tab
- Watch logs in real-time
- Wait for "Deployed successfully" status

---

### Step 9: Verify Deployment

#### Test Backend:

```bash
# Replace with your backend domain
curl https://your-backend-domain.up.railway.app/health
```

Should return: `{"status":"healthy",...}`

#### Test Frontend:

1. Open browser: `https://testrtcc-production.up.railway.app`
2. Check browser console (F12) for errors
3. Verify WebSocket connects (should use `wss://`)

#### Test WebRTC:

1. Open two browser tabs
2. Join the same room from both
3. Verify video/audio works
4. Test screen sharing

---

## 🔄 Auto-Deployment

Railway automatically deploys when you push to GitHub:

```powershell
git add .
git commit -m "Your changes"
git push origin main
```

Railway will:
- Detect the push
- Rebuild and redeploy automatically
- Switch traffic to new deployment

---

## 📊 Monitoring

### View Logs:

1. Railway Dashboard → Service → **"Logs"** tab
2. Real-time logs for debugging
3. Filter by service (backend/frontend)

### Check Health:

- Backend: `https://your-backend-domain.up.railway.app/health`
- Frontend: `https://testrtcc-production.up.railway.app`

---

## 🐛 Troubleshooting

### Deployment Fails

**Check:**
1. Railway logs for errors
2. Dockerfile syntax
3. Environment variables are set
4. Root directory is correct

### WebSocket Connection Failed

**Check:**
1. `VITE_API_URL` uses `https://` (not `http://`)
2. Backend is running (test `/health` endpoint)
3. CORS settings include frontend domain
4. Browser console for specific errors

### CORS Errors

**Fix:**
1. Update `CORS_ALLOW_ORIGIN` in backend variables
2. Must match exact frontend URL (including `https://`)
3. Restart backend service after changes

### Video Not Working

**Check:**
1. Browser console for WebRTC errors
2. STUN/TURN servers are accessible
3. Railway logs for signaling errors
4. Test with different networks

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub ✅
- [ ] Railway project created
- [ ] Backend service created (root: `backend`)
- [ ] Frontend service created (root: `frontend`)
- [ ] Backend environment variables set
- [ ] Frontend environment variables set
- [ ] Frontend domain configured
- [ ] Backend domain obtained
- [ ] Environment variables updated with backend domain
- [ ] Services deployed successfully
- [ ] Backend health check passes
- [ ] Frontend loads without errors
- [ ] WebSocket connects (wss://)
- [ ] Video calls work
- [ ] Screen sharing works

---

## 🎉 Success!

Your app is now live on Railway! 

**Frontend URL:** `https://testrtcc-production.up.railway.app`
**Backend URL:** `https://your-backend-domain.up.railway.app`

---

## 📞 Need Help?

- Check Railway logs
- Review `RAILWAY_DEPLOYMENT_GUIDE.md` for detailed info
- Check browser console for frontend errors
- Verify environment variables are set correctly

---

## 🔐 Security Notes

1. ✅ Secrets are in Railway environment variables (not in code)
2. ✅ HTTPS is enabled automatically by Railway
3. ✅ CORS is configured for your domain
4. ⚠️ For production, consider regenerating JWT_SECRET and TURN_SECRET

---

**You're all set! 🚀**

