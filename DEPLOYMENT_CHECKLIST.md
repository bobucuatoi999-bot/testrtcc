# Deployment Checklist

Use this checklist to ensure your deployment is successful.

## Pre-Deployment

- [ ] Backend builds successfully locally: `cd server && npm run build`
- [ ] Frontend builds successfully locally: `cd frontend && npm run build`
- [ ] All tests pass (if any)
- [ ] No TypeScript errors: `npm run type-check` in both directories
- [ ] Code is committed to Git repository

## Backend Deployment (Railway)

- [ ] Repository connected to Railway
- [ ] Service created from Dockerfile
- [ ] Environment variables set:
  - [ ] `NODE_ENV=production`
  - [ ] `CORS_ORIGIN=*` (temporary, update after frontend deployment)
  - [ ] `PORT` (Railway sets automatically, but can add as fallback)
  - [ ] `HOST=0.0.0.0` (optional, default is fine)
- [ ] Backend URL obtained (e.g., `https://your-app.railway.app`)
- [ ] Health check working: `curl https://your-backend-url.railway.app/health`
- [ ] Root endpoint working: `curl https://your-backend-url.railway.app/`

## Frontend Deployment

### Option A: Vercel
- [ ] Repository connected to Vercel
- [ ] Build settings configured:
  - [ ] Framework: Vite
  - [ ] Root directory: `frontend`
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
- [ ] Environment variable set: `VITE_API_URL=https://your-backend-url.railway.app`
- [ ] Frontend deployed and accessible

### Option B: Netlify
- [ ] Repository connected to Netlify
- [ ] Build settings configured:
  - [ ] Base directory: `frontend`
  - [ ] Build command: `npm install && npm run build`
  - [ ] Publish directory: `frontend/dist`
- [ ] Environment variable set: `VITE_API_URL=https://your-backend-url.railway.app`
- [ ] Frontend deployed and accessible

### Option C: Railway Static
- [ ] Static site service created in Railway
- [ ] Repository connected
- [ ] Build settings configured
- [ ] Environment variable set: `VITE_API_URL=https://your-backend-url.railway.app`
- [ ] Frontend deployed and accessible

## Post-Deployment

- [ ] Update `CORS_ORIGIN` in Railway to include frontend URL(s)
- [ ] Test frontend can connect to backend
- [ ] Test creating a room
- [ ] Test joining a room from different browser/device
- [ ] Test video/audio between users
- [ ] Test screen sharing (if implemented)
- [ ] Test chat functionality
- [ ] Monitor Railway logs for errors
- [ ] Check browser console for errors

## Security Checklist

- [ ] `CORS_ORIGIN` set to specific origins (not `*`) in production
- [ ] HTTPS enabled (Railway/Vercel/Netlify provide this automatically)
- [ ] No sensitive data in environment variables
- [ ] `.env` files not committed to Git
- [ ] Debug endpoints disabled in production (already done via `NODE_ENV` check)

## Monitoring

- [ ] Railway logs accessible
- [ ] Health check endpoint responding
- [ ] Error tracking set up (optional)
- [ ] Performance monitoring (optional)

## Troubleshooting

If deployment fails:

1. **Backend won't start**
   - Check Railway logs
   - Verify Dockerfile builds locally
   - Check environment variables

2. **Frontend can't connect**
   - Verify `VITE_API_URL` is set correctly
   - Check CORS configuration
   - Verify backend is accessible

3. **WebRTC not working**
   - Check STUN/TURN server configuration
   - Verify WebSocket connection
   - Check browser console for errors
   - Some networks block WebRTC (may need VPN)

4. **Build errors**
   - Check TypeScript compilation
   - Verify all dependencies installed
   - Check build logs for specific errors

