# Deployment Guide

## Railway Deployment

### Backend Deployment

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

3. **Configure Service**
   - Railway will auto-detect the `railway.json` and `Dockerfile`
   - The Dockerfile is located at `server/Dockerfile`
   - Set root directory to project root (Railway will use the Dockerfile path)

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   CORS_ORIGIN=*
   PORT=3000 (automatically set by Railway)
   ```

5. **Deploy**
   - Railway will automatically build and deploy
   - Your backend URL will be: `https://your-app.railway.app`

### Frontend Deployment

**Option 1: Railway Static Site**
1. Create a new service in Railway
2. Connect your GitHub repo
3. Set root directory to `frontend`
4. Build command: `npm install && npm run build`
5. Start command: `npx serve -s dist -l 5173`
6. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

**Option 2: Netlify/Vercel**
1. Build frontend: `cd frontend && npm run build`
2. Deploy `dist` folder to Netlify or Vercel
3. Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

**Option 3: Manual Hosting**
1. Build frontend: `cd frontend && npm run build`
2. Upload `dist` folder to your web server
3. Update `VITE_API_URL` before building

## Environment Variables

### Backend
- `PORT`: Server port (Railway sets this automatically)
- `NODE_ENV`: `production` or `development`
- `CORS_ORIGIN`: Allowed origins (use `*` for all or specific URLs)

### Frontend
- `VITE_API_URL`: Backend server URL (e.g., `https://your-backend.railway.app`)

## Testing Deployment

1. **Test Backend**
   - Visit `https://your-backend.railway.app/health`
   - Should return: `{"status":"ok","timestamp":...}`

2. **Test Frontend**
   - Visit your frontend URL
   - Try creating a room
   - Verify connection to backend

## Troubleshooting

### Backend Issues
- Check Railway logs for errors
- Verify environment variables are set
- Ensure Dockerfile builds correctly
- Check port binding (should be 0.0.0.0:PORT)

### Frontend Issues
- Verify `VITE_API_URL` is set correctly
- Check browser console for connection errors
- Ensure CORS is configured properly on backend
- Verify backend is accessible (not blocked by firewall)

## Production Checklist

- [ ] Backend deployed and accessible
- [ ] Frontend deployed with correct API URL
- [ ] Environment variables set
- [ ] CORS configured for frontend domain
- [ ] HTTPS enabled (required for WebRTC)
- [ ] Health check endpoint working
- [ ] Test with multiple users
- [ ] Verify camera/microphone permissions work
- [ ] Test screen sharing
- [ ] Test chat functionality

