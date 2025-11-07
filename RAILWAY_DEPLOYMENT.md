# Railway Deployment Guide

This guide will help you deploy the WebRTC Video Conferencing application to Railway.

## Architecture

- **Backend**: Node.js + Express + Socket.io (deployed on Railway)
- **Frontend**: React + Vite (deployed separately on Netlify/Vercel/Railway Static)

## Prerequisites

1. Railway account (sign up at [railway.app](https://railway.app))
2. GitHub account (to connect repository)
3. Node.js 20+ installed locally (for testing)

## Step 1: Deploy Backend to Railway

### 1.1 Connect Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your repository
5. Select the repository containing this project

### 1.2 Configure Backend Service

Railway will automatically detect the `railway.json` and `server/Dockerfile`.

1. Railway will create a service from the Dockerfile
2. Make sure the **Root Directory** is set to the repository root (not `server/`)
3. Railway will build and deploy automatically

### 1.3 Set Environment Variables

In Railway dashboard, go to your service → Variables tab, add:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS Configuration
# IMPORTANT: Set this to your frontend URL(s) after deploying frontend
# Example: https://your-frontend-app.vercel.app,https://your-frontend-app.netlify.app
# Or use * for all origins (less secure, but easier for testing)
CORS_ORIGIN=*
```

**Important Notes:**
- Railway will automatically set `PORT` - you can remove it or keep it as fallback
- Set `CORS_ORIGIN` to your frontend URL(s) after deploying the frontend
- Use comma-separated list for multiple origins: `https://app1.com,https://app2.com`

### 1.4 Get Backend URL

1. After deployment, Railway will provide a public URL like: `https://your-app.railway.app`
2. Copy this URL - you'll need it for the frontend deployment

### 1.5 Verify Backend is Running

1. Visit `https://your-backend-url.railway.app/health`
2. You should see: `{"status":"ok","timestamp":...}`
3. Visit `https://your-backend-url.railway.app/`
4. You should see: `{"message":"WebRTC Signaling Server",...}`

## Step 2: Deploy Frontend

### Option A: Deploy to Vercel (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.railway.app`
6. Deploy!

### Option B: Deploy to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. Configure build:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Add Environment Variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.railway.app`
6. Deploy!

### Option C: Deploy to Railway Static

1. In Railway, create a new service
2. Select "Static Site"
3. Connect your repository
4. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
5. Add Environment Variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.railway.app`
6. Deploy!

## Step 3: Update CORS in Backend

After deploying the frontend:

1. Get your frontend URL (e.g., `https://your-app.vercel.app`)
2. Go to Railway → Your Backend Service → Variables
3. Update `CORS_ORIGIN`:
   ```env
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   ```
4. Railway will automatically redeploy

## Step 4: Test Global Deployment

1. Open your frontend URL in a browser
2. Create a room
3. Open the same URL in another browser/device
4. Join the room with the room ID
5. Verify video/audio works between users

## Troubleshooting

### Backend Issues

**Problem**: Backend not starting
- Check Railway logs for errors
- Verify `PORT` env var is set (Railway sets this automatically)
- Check that Dockerfile builds correctly locally: `docker build -f server/Dockerfile -t webrtc-server .`

**Problem**: Health check failing
- Verify `/health` endpoint is accessible
- Check Railway health check settings match the endpoint

**Problem**: CORS errors
- Verify `CORS_ORIGIN` includes your frontend URL
- Check browser console for specific CORS errors
- In development, you can temporarily set `CORS_ORIGIN=*` for testing

### Frontend Issues

**Problem**: Can't connect to backend
- Verify `VITE_API_URL` is set correctly
- Check browser console for connection errors
- Verify backend is accessible: visit `https://your-backend-url.railway.app/health`

**Problem**: Socket.io connection failing
- Check that WebSocket is enabled on Railway (should be by default)
- Verify CORS is configured correctly
- Check browser network tab for WebSocket connection status

### WebRTC Issues

**Problem**: Users can't see each other
- Check browser console for WebRTC errors
- Verify STUN/TURN servers are accessible (check `frontend/src/hooks/useWebRTC.ts`)
- Some networks block WebRTC - users may need to use VPN
- Check that media permissions are granted in browser

## Environment Variables Reference

### Backend (Railway)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` (Railway sets automatically) |
| `HOST` | Server host | No | `0.0.0.0` |
| `NODE_ENV` | Environment | No | `development` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | Yes | `*` (for testing) |

### Frontend (Vercel/Netlify/Railway)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API URL | Yes | (none - must be set) |

## Monitoring

### Railway Logs

1. Go to Railway Dashboard
2. Select your backend service
3. Click "Logs" tab
4. Monitor for errors and connection issues

### Health Check

Railway automatically monitors `/health` endpoint. If it fails, Railway will restart the service.

## Cost Estimation

- **Railway**: Free tier includes 500 hours/month and $5 credit
- **Vercel**: Free tier includes unlimited personal projects
- **Netlify**: Free tier includes 100GB bandwidth/month

For production use, consider upgrading plans for better performance and reliability.

## Security Considerations

1. **CORS**: Always set specific origins in production (not `*`)
2. **HTTPS**: Railway provides HTTPS automatically
3. **Environment Variables**: Never commit `.env` files
4. **Rate Limiting**: Consider adding rate limiting for production
5. **Authentication**: Consider adding user authentication for production use

## Support

If you encounter issues:
1. Check Railway logs
2. Check browser console
3. Verify environment variables
4. Test locally first
5. Check Railway status page

