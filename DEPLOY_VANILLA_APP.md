# 🚀 Deploy Vanilla JS WebRTC App

Complete guide to deploy the vanilla JS version of the WebRTC app.

## 📁 Project Structure

```
vanilla-backend/     # Express + Socket.io server
vanilla-frontend/    # Vanilla JS + HTML client
```

## 🎯 Deployment Steps

### Step 1: Deploy Backend to Railway

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Create New Project** → **Deploy from GitHub repo**
3. **Select your repository**
4. **Configure:**
   - Root Directory: `vanilla-backend`
   - Build Command: (Railway auto-detects)
   - Start Command: `node server.js`

5. **Add Environment Variables:**
   ```
   CORS_ORIGIN=*
   NODE_ENV=production
   ```

6. **Wait for deployment**
7. **Copy your backend URL** (e.g., `https://your-app.railway.app`)

### Step 2: Update Frontend API URL

1. **Edit `vanilla-frontend/app.js`:**
   ```javascript
   // Update this line (around line 4):
   return 'https://your-backend.railway.app';
   ```

2. **OR edit `vanilla-frontend/index.html`:**
   ```html
   <script>
     window.API_URL = 'https://your-backend.railway.app';
   </script>
   ```

### Step 3: Deploy Frontend

#### Option A: Railway Static Site

1. **In Railway project**, click **"+ New Service"**
2. **Select "Static Site"**
3. **Configure:**
   - Root Directory: `vanilla-frontend`
   - Build Command: (leave empty or use `npm install && npm run build` if using Vite)
   - Output Directory: `dist` (if using Vite) or `.` (if serving directly)

4. **Deploy!**

#### Option B: Vercel (Recommended for Frontend)

1. **Go to Vercel**: https://vercel.com/dashboard
2. **Add New Project** → **Import Git Repository**
3. **Configure:**
   - Root Directory: `vanilla-frontend`
   - Framework: Other (or Vite if using build)
   - Build Command: (leave empty or `npm run build`)
   - Output Directory: `dist` (if using Vite) or `.`

4. **Add Environment Variable:**
   - Key: `API_URL`
   - Value: `https://your-backend.railway.app`

5. **Deploy!**

#### Option C: Netlify

1. **Go to Netlify**: https://app.netlify.com
2. **Add New Site** → **Import from Git**
3. **Configure:**
   - Base directory: `vanilla-frontend`
   - Build command: (leave empty)
   - Publish directory: `.`

4. **Add Environment Variable:**
   - Key: `API_URL`
   - Value: `https://your-backend.railway.app`

5. **Deploy!**

### Step 4: Update Backend CORS

1. **Go to Railway Dashboard**
2. **Open your backend service**
3. **Go to "Variables" tab**
4. **Update `CORS_ORIGIN`:**
   ```
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```
   (Or your Railway/Vercel/Netlify frontend URL)

5. **Railway will auto-redeploy**

## 🧪 Testing

1. **Open frontend URL in browser**
2. **Create a room**
3. **Open in another browser/tab**
4. **Join with room ID**
5. **Test video/audio/screen share**

## 📋 Environment Variables Summary

### Backend (Railway)
```
CORS_ORIGIN=https://your-frontend.vercel.app
NODE_ENV=production
PORT=3000 (auto-set by Railway)
```

### Frontend
Update in `app.js` or `index.html`:
```javascript
window.API_URL = 'https://your-backend.railway.app';
```

## 🐛 Troubleshooting

### Frontend can't connect to backend?
- Verify `API_URL` is set correctly
- Check browser console for errors
- Verify backend CORS allows frontend URL

### WebRTC not working?
- Check browser console for WebRTC errors
- Verify STUN/TURN servers are accessible
- Some networks block WebRTC (try VPN)

### CORS errors?
- Make sure `CORS_ORIGIN` matches frontend URL exactly
- Check backend logs for CORS errors

## ✅ Checklist

- [ ] Backend deployed on Railway
- [ ] Backend URL copied
- [ ] Frontend `API_URL` updated
- [ ] Frontend deployed (Railway/Vercel/Netlify)
- [ ] Backend `CORS_ORIGIN` updated
- [ ] Frontend loads in browser
- [ ] Can create room
- [ ] Can join room
- [ ] Video/audio works
- [ ] Screen share works

## 🎉 Success!

Your vanilla JS WebRTC app is now deployed and ready to use! 🚀

