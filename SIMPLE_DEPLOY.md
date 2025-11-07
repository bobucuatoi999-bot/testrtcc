# 🚀 Simple All-In-One Deployment

## ✅ It's Already All-In-One!

**You don't need separate backend and frontend!**

The PeerJS backend **already serves the frontend automatically**.

## 📁 Current Structure

```
peerjs-backend/          ← ONE FOLDER
├── server.js           ← Backend (serves frontend)
├── package.json        
├── railway.json        
└── public/
    └── index.html      ← Frontend (served by backend)
```

## 🎯 How It Works

1. **Backend starts** (`node server.js`)
2. **Serves frontend** from `public/index.html`
3. **Socket.io** runs on same server
4. **ONE URL** = Everything!

## 🚀 Deploy (One Time)

### Step 1: Railway Setup

1. Go to Railway Dashboard
2. **New Project** → **Deploy from GitHub repo**
3. **Root Directory:** `peerjs-backend`
4. **Deploy!**

### Step 2: Done!

Visit your Railway URL:
```
https://your-app.railway.app
```

**This ONE URL has:**
- ✅ Frontend (index.html)
- ✅ Backend API
- ✅ Socket.io
- ✅ Everything!

## ✅ What Changed

**Frontend now uses same domain:**
```javascript
// BEFORE (confusing):
const SIGNALING_SERVER = 'http://localhost:3000' || 'https://backend.railway.app';

// AFTER (simple):
const SIGNALING_SERVER = window.location.origin;
// Automatically uses same domain as frontend!
```

## 🎉 Result

**ONE deployment = ONE domain = Everything works!**

- ✅ No separate frontend deployment
- ✅ No CORS issues
- ✅ No domain configuration
- ✅ Simple and reliable

## 📝 Checklist

- [x] Backend serves frontend (`app.use(express.static('public'))`)
- [x] Frontend uses same domain (`window.location.origin`)
- [x] One Railway deployment
- [x] One URL
- [x] Everything works together

---

**Deploy once, use everywhere!** 🚀

