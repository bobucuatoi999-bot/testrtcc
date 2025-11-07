# 🚀 Deploy Frontend - Quick Steps

## ✅ Status
- ✅ Backend is **running** on Railway
- ⏳ Frontend needs to be deployed

## 🎯 Quick Deploy (Railway - Same Project)

### Step 1: Get Your Backend URL
1. Go to Railway Dashboard: https://railway.app/dashboard
2. Click your project
3. Click the backend service
4. Copy the URL (e.g., `https://your-app.railway.app`)

### Step 2: Deploy Frontend on Railway
1. In the **same Railway project**, click **"+ New Service"**
2. Select **"Static Site"**
3. Choose **"Deploy from GitHub repo"**
4. Select your repository: `bobucuatoi999-bot/testrtcc`
5. Configure:
   ```
   Root Directory: frontend
   Build Command: npm install && npm run build
   Output Directory: dist
   ```
6. Add Environment Variable:
   ```
   Key: VITE_API_URL
   Value: [Your backend URL from Step 1]
   ```
7. Click **"Deploy"**
8. Wait for deployment (2-3 minutes)
9. Copy your frontend URL

### Step 3: Update Backend CORS
1. Go back to your **backend service** in Railway
2. Click **"Variables"** tab
3. Update `CORS_ORIGIN`:
   ```
   Key: CORS_ORIGIN
   Value: [Your frontend URL from Step 2]
   ```
4. Railway will auto-redeploy

### Step 4: Test!
1. Open your frontend URL in browser
2. You should see the landing page with "Create Room" button
3. Create a room and test!

## 🔗 Example URLs

**Backend**: `https://testrtcc-production.railway.app` (your actual URL)
**Frontend**: `https://testrtcc-frontend.railway.app` (will be generated)

## 📝 Environment Variables Checklist

### Frontend Service (Railway)
- [ ] `VITE_API_URL` = Your backend URL

### Backend Service (Railway)
- [ ] `NODE_ENV` = `production`
- [ ] `CORS_ORIGIN` = Your frontend URL

## ❓ Need Help?

If you get stuck, check:
- Railway build logs for errors
- Browser console for connection errors
- Backend logs for CORS errors

## 🎉 That's It!

Once deployed, you'll have:
- ✅ Backend on Railway (already done!)
- ✅ Frontend on Railway
- ✅ Full WebRTC video conferencing app ready!

