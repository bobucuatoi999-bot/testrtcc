# 🚀 Railway Frontend Deployment - Ready to Deploy

## ✅ Backend Status
- **Backend URL**: https://testrtcc-production.up.railway.app/
- **Status**: ✅ Running and responding
- **API Test**: https://testrtcc-production.up.railway.app/health

## 📋 Frontend Configuration (Already Done!)

### Environment Variables
- ✅ Created `frontend/.env.production` with backend URL
- ✅ Updated `useSocket.ts` with default backend URL
- ✅ Added Railway configuration file

### Files Updated
1. `frontend/.env.production` - Production environment variables
2. `frontend/src/hooks/useSocket.ts` - Default backend URL
3. `frontend/package.json` - Added serve script
4. `railway-frontend.json` - Railway configuration

## 🎯 Deploy Frontend on Railway (5 Minutes)

### Step 1: Add Frontend Service to Railway

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Open your project** (the one with backend)
3. **Click "+ New Service"**
4. **Select "Static Site"** (or "Deploy from GitHub repo")

### Step 2: Configure Frontend Service

1. **Connect Repository**: Select `bobucuatoi999-bot/testrtcc`
2. **Root Directory**: `frontend`
3. **Build Command**: `npm install && npm run build`
4. **Output Directory**: `dist`
5. **Start Command**: (Leave empty - Railway will auto-detect)

### Step 3: Add Environment Variable

In Railway frontend service settings:

**Add Environment Variable**:
- **Key**: `VITE_API_URL`
- **Value**: `https://testrtcc-production.up.railway.app`

### Step 4: Deploy!

1. Click **"Deploy"**
2. Wait 2-3 minutes for build
3. Railway will generate a frontend URL (e.g., `https://testrtcc-frontend.railway.app`)

### Step 5: Update Backend CORS

1. Go to your **backend service** in Railway
2. Click **"Variables"** tab
3. Update `CORS_ORIGIN`:
   - **Key**: `CORS_ORIGIN`
   - **Value**: `https://[your-frontend-url].railway.app` (from Step 4)
4. Railway will auto-redeploy backend

## 🧪 Test Deployment

1. **Open frontend URL** in browser
2. **Check console** - Should see: `✅ Socket.io connected successfully!`
3. **Create a room** - Should work!
4. **Test from another device** - Join with room ID

## 📊 Expected URLs

After deployment:
- **Backend**: https://testrtcc-production.up.railway.app/
- **Frontend**: https://[generated].railway.app (Railway will show this)

## 🔧 Environment Variables Summary

### Frontend Service (Railway)
```
VITE_API_URL=https://testrtcc-production.up.railway.app
```

### Backend Service (Railway)
```
NODE_ENV=production
CORS_ORIGIN=https://[your-frontend-url].railway.app
```

## ✅ Verification Checklist

- [ ] Frontend service created in Railway
- [ ] `VITE_API_URL` environment variable set
- [ ] Frontend deployed successfully
- [ ] Frontend URL copied
- [ ] Backend `CORS_ORIGIN` updated
- [ ] Frontend loads in browser
- [ ] Socket.io connects (check console)
- [ ] Can create room
- [ ] Can join room from another device

## 🐛 Troubleshooting

### Frontend won't build?
- Check Railway build logs
- Verify `frontend/package.json` exists
- Check build command is correct

### Frontend can't connect to backend?
- Verify `VITE_API_URL` is set correctly
- Check browser console for errors
- Verify backend CORS allows frontend URL

### CORS errors?
- Make sure `CORS_ORIGIN` matches frontend URL exactly
- Check backend logs for CORS errors
- Try opening backend URL in browser (should show JSON)

## 🎉 Success!

Once deployed, your WebRTC app will be fully functional:
- ✅ Backend on Railway
- ✅ Frontend on Railway
- ✅ Socket.io connected
- ✅ WebRTC ready for video calls!

---

**Backend URL**: https://testrtcc-production.up.railway.app/
**Ready to deploy frontend!** 🚀

