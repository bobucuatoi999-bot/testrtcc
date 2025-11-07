# Quick Deployment Guide

## 🚀 Fast Track Deployment

> **Note**: You can deploy both backend and frontend on Railway! See `RAILWAY_BOTH_SERVICES.md` for Railway-only deployment.

### Option A: Railway for Both (Recommended)

Deploy both services on Railway - simpler and everything in one place!

### Option B: Railway + Vercel

Deploy backend on Railway, frontend on Vercel.

---

## Option A: Railway for Everything

### 1. Deploy Backend to Railway (5 minutes)

1. **Go to Railway**: https://railway.app/dashboard
2. **New Project** → **Deploy from GitHub repo**
3. **Select your repository**
4. **Railway will detect** `railway.json` and `server/Dockerfile` automatically
5. **Add Environment Variables**:
   ```
   NODE_ENV=production
   CORS_ORIGIN=*
   ```
6. **Wait for deployment** (2-3 minutes)
7. **Copy your backend URL** (e.g., `https://your-app.railway.app`)

### 2. Deploy Frontend on Railway (Same Project) (3 minutes)

1. In the **same Railway project**, click **+ New Service**
2. Select **"Static Site"**
3. Connect your repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.railway.app` (from step 1)
6. Deploy!
7. Get frontend URL: `https://your-frontend.railway.app`

---

## Option B: Railway + Vercel

### 1. Deploy Backend to Railway (5 minutes)

1. **Go to Vercel**: https://vercel.com/dashboard
2. **Add New Project** → **Import Git Repository**
3. **Configure**:
   - Root Directory: `frontend`
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Add Environment Variable**:
   - Key: `VITE_API_URL`
   - Value: `https://your-backend-url.railway.app` (from step 1)
5. **Deploy!**

### 2. Deploy Frontend to Vercel (3 minutes)

1. **Go back to Railway**
2. **Your Backend Service** → **Variables**
3. **Update** `CORS_ORIGIN` to your frontend URL:
   ```
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```
4. **Railway will redeploy automatically**

### 3. Update CORS (2 minutes)

1. Open your frontend URL
2. Create a room
3. Open in another browser/device
4. Join with the room ID
5. ✅ Done!

## 📋 Environment Variables Summary

### Railway (Backend)
```
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
```

### Vercel (Frontend)
```
VITE_API_URL=https://your-backend.railway.app
```

## 🐛 Troubleshooting

**Backend won't start?**
- Check Railway logs
- Verify Dockerfile path is correct
- Check environment variables

**Frontend can't connect?**
- Verify `VITE_API_URL` is set
- Check CORS is configured correctly
- Open browser console for errors

**WebRTC not working?**
- Some networks block WebRTC (try VPN)
- Check browser console for errors
- Verify STUN/TURN servers are accessible

## 💰 Cost

- **Railway**: Free tier (500 hours/month)
- **Vercel**: Free tier (unlimited personal projects)
- **Total**: $0/month for development/testing

## 📚 Full Documentation

See `RAILWAY_DEPLOYMENT.md` for detailed instructions.

