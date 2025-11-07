# Render.com Deployment Guide

## Quick Setup (5 minutes)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (easiest option)

### Step 2: Deploy Backend Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select your repository: `testrtcc`
4. Configure the service:
   - **Name**: `webrtc-signaling-backend`
   - **Region**: Choose closest to you (Oregon, Frankfurt, etc.)
   - **Branch**: `main`
   - **Root Directory**: `backend` (IMPORTANT!)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter if you want better performance)

### Step 3: Set Environment Variables
In the Render dashboard, go to **Environment** tab and add:

**Required:**
- `JWT_SECRET` - Generate a random string (you can use: `openssl rand -hex 32`)
- `NODE_ENV` = `production`
- `APPPORT` = `10000` (Render uses port from $PORT env var, but we'll use 10000)
- `APPHOST` = `0.0.0.0`

**Optional:**
- `CORS_ALLOW_ORIGIN` = `*` (or your frontend URL)
- `MAX_PARTICIPANTS` = `4`
- `MONITORING_ENABLED` = `false`

### Step 4: Deploy
1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repo
   - Install dependencies
   - Start your server
3. Wait 2-5 minutes for deployment

### Step 5: Get Your Server URL
After deployment, Render will give you a URL like:
- `https://webrtc-signaling-backend.onrender.com`

**Important**: Free tier services sleep after 15 minutes of inactivity. They'll wake up on first request (takes ~30 seconds).

## Update Frontend to Use Render URL

Update your frontend configuration to point to the Render URL:
```javascript
// In your frontend config
const SERVER_URL = 'https://webrtc-signaling-backend.onrender.com';
```

## Alternative: Use Render Blueprint (render.yaml)

If you have the `render.yaml` file in your repo:
1. Click **"New +"** → **"Blueprint"**
2. Connect your repository
3. Render will automatically detect `render.yaml`
4. Click **"Apply"** to deploy

## Troubleshooting

### Service Won't Start
- Check logs in Render dashboard
- Verify `Root Directory` is set to `backend`
- Ensure `Start Command` is `npm start`

### Port Issues
- Render automatically sets `PORT` environment variable
- Your server should use `process.env.PORT || 3000`

### WebSocket Issues
- Render supports WebSockets on all plans
- Ensure you're using `wss://` (secure) for WebSocket connections
- Your frontend should connect to: `wss://your-service.onrender.com/ws`

## Upgrade to Paid Plan (Optional)

Free tier limitations:
- Services sleep after 15 min inactivity
- Limited CPU/RAM
- Slower cold starts

Starter plan ($7/month):
- Always-on service
- Better performance
- No cold starts
- 512MB RAM

