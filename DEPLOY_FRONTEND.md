# Deploy Frontend - Quick Guide

## ✅ Backend Status
Your backend is **running successfully** on Railway! 🎉

## 🚀 Deploy Frontend - Choose One Option

### Option A: Railway (Same Project) - Recommended ⭐

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Open your project** (the one with the backend)
3. **Click "+ New Service"**
4. **Select "Static Site"**
5. **Connect your GitHub repository**
6. **Configure**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
7. **Add Environment Variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend URL (e.g., `https://your-backend.railway.app`)
8. **Deploy!**
9. **Copy your frontend URL** (e.g., `https://your-frontend.railway.app`)

### Option B: Vercel (Alternative)

1. **Go to Vercel**: https://vercel.com/dashboard
2. **Add New Project** → **Import Git Repository**
3. **Select your repository**
4. **Configure**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Add Environment Variable**:
   - **Key**: `VITE_API_URL`
   - **Value**: Your backend URL (e.g., `https://your-backend.railway.app`)
6. **Deploy!**
7. **Copy your frontend URL** (e.g., `https://your-app.vercel.app`)

## 🔧 Update Backend CORS

After deploying frontend:

1. **Go back to Railway Dashboard**
2. **Open your backend service**
3. **Go to "Variables" tab**
4. **Update `CORS_ORIGIN`**:
   - If using Railway: `https://your-frontend.railway.app`
   - If using Vercel: `https://your-app.vercel.app`
5. **Railway will auto-redeploy**

## 📋 Quick Checklist

- [ ] Get backend URL from Railway
- [ ] Deploy frontend (Railway or Vercel)
- [ ] Set `VITE_API_URL` environment variable
- [ ] Update `CORS_ORIGIN` in backend
- [ ] Test frontend URL in browser
- [ ] Create a room and test WebRTC

## 🌐 Environment Variables Summary

### Frontend (Railway/Vercel)
```
VITE_API_URL=https://your-backend.railway.app
```

### Backend (Railway)
```
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.railway.app
```

## 🐛 Troubleshooting

**Frontend can't connect to backend?**
- Verify `VITE_API_URL` is set correctly
- Check browser console for errors
- Verify backend CORS allows your frontend URL

**CORS errors?**
- Make sure `CORS_ORIGIN` matches your frontend URL exactly
- Check backend logs for CORS errors
- Try adding `*` temporarily to test (not recommended for production)

## 💡 Pro Tip

After deploying, open your frontend URL in the browser. If you see the landing page with "Create Room" and "Join Room" buttons, you're good! 🎉

