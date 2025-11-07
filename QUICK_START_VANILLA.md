# 🚀 Quick Start - Vanilla JS WebRTC App

## ✅ What You Have

A complete, bug-fixed WebRTC video conferencing app in vanilla JavaScript.

## 📁 Project Structure

```
vanilla-backend/      # Backend server (Express + Socket.io)
vanilla-frontend/     # Frontend client (Vanilla JS + HTML)
```

## 🎯 Quick Start (Local)

### 1. Start Backend

```bash
cd vanilla-backend
npm install
npm start
# Backend runs on http://localhost:3000
```

### 2. Start Frontend

```bash
cd vanilla-frontend

# Option 1: Python (simplest)
python -m http.server 8080

# Option 2: Node.js
npx serve . -p 8080

# Option 3: Vite (for development)
npm install
npm run dev
```

### 3. Open Browser

```
http://localhost:8080
```

### 4. Test

1. Enter your name
2. Click "Create New Room"
3. Open another browser tab
4. Join with the room ID
5. Test video/audio!

## 🚀 Quick Deploy (Railway)

### Backend

1. Go to Railway Dashboard
2. New Project → Deploy from GitHub
3. Select `vanilla-backend` folder
4. Set environment: `CORS_ORIGIN=*`
5. Deploy!

### Frontend

1. Update `vanilla-frontend/app.js` line 14:
   ```javascript
   return 'https://your-backend.railway.app';
   ```

2. Deploy to Vercel/Netlify:
   - Root: `vanilla-frontend`
   - Framework: Other
   - Deploy!

3. Update backend `CORS_ORIGIN` to frontend URL

## 🐛 All Bugs Fixed

✅ Bidirectional connections  
✅ Media handling (with/without devices)  
✅ Auto-reconnection  
✅ Screen sharing  
✅ Race conditions  
✅ Connection reliability  

## 📚 Full Documentation

- `VANILLA_APP_README.md` - Complete documentation
- `DEPLOY_VANILLA_APP.md` - Deployment guide
- `VANILLA_APP_SUMMARY.md` - Feature summary

## 🎉 Ready to Use!

The app is complete and ready to deploy. All bugs are fixed!

---

**Next**: Test locally, then deploy to Railway! 🚀

