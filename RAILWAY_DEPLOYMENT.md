# Railway Deployment Guide for New Backend

## Quick Setup

The new backend has been pushed to GitHub. To deploy on Railway:

### 1. Configure Railway Service

1. Go to your Railway project dashboard
2. If deploying a new service:
   - Click "New" → "GitHub Repo"
   - Select your repository: `bobucuatoi999-bot/testrtcc`
   - Railway will auto-detect and deploy

3. If updating existing service:
   - Railway should auto-deploy from the push
   - Check the deployments tab

### 2. Set Root Directory (IMPORTANT)

In Railway dashboard:
1. Go to your service settings
2. Under "Settings" → "Service Settings"
3. Set **Root Directory** to: `backend`
4. Save changes

### 3. Configure Environment Variables

In Railway dashboard, go to "Variables" tab and add:

```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://testrtcc-production.up.railway.app
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=YOUR_RAILWAY_PUBLIC_IP
MEDIASOUP_NUM_WORKERS=4
```

**CRITICAL:** To get your Railway public IP:
1. Railway doesn't provide a static IP by default
2. You have two options:

   **Option A: Use Railway's domain (Recommended)**
   - Get your Railway public domain from the service settings
   - Set `MEDIASOUP_ANNOUNCED_DOMAIN=your-app.up.railway.app`
   - Leave `MEDIASOUP_ANNOUNCED_IP` empty or remove it

   **Option B: Get Railway's outgoing IP**
   - Railway uses dynamic IPs
   - You can get the outgoing IP by checking Railway logs when server starts
   - Or use a service like `curl ifconfig.me` from Railway's server (not recommended for production)

### 4. Configure Ports

Railway automatically exposes the PORT environment variable, so port 3000 should work.

For RTC ports (40000-49999), Railway handles this automatically for WebRTC traffic, but you may need to:
1. Check Railway's documentation on WebRTC/UDP support
2. If UDP is not fully supported, you might need to use TCP only (modify config if needed)

### 5. Update Start Command (if needed)

In Railway settings, the start command should be:
```bash
npm start
```

Since we set Root Directory to `backend`, Railway will run this in the backend folder automatically.

### 6. Deploy and Verify

1. Railway should auto-deploy after push
2. Check deployment logs
3. Verify health endpoint:
   ```bash
   curl https://your-app.up.railway.app/health
   ```

### 7. Update Frontend Configuration

Update your frontend `public/config.js` to point to the new backend:

```javascript
window.SERVER_URL = 'https://your-app.up.railway.app';
```

## Railway-Specific Notes

### WebRTC on Railway

Railway supports WebRTC, but:
- UDP ports are automatically handled
- The service should work out of the box
- If you encounter connection issues, check Railway's network documentation

### Environment Variables Priority

Railway uses environment variables from:
1. Service variables (highest priority)
2. Project variables
3. `.env` file (for local development only)

### Monitoring

- Use Railway's built-in metrics dashboard
- Check logs: `railway logs` or in Railway dashboard
- Monitor health endpoint: `/health`

## Troubleshooting

### "Port already in use"
- Railway sets PORT automatically, ensure you're using `process.env.PORT || 3000`

### "Mediasoup worker failed"
- Check MEDIASOUP_ANNOUNCED_IP is set
- Verify port range is available
- Check Railway resource limits

### "Peers cannot connect"
- Verify MEDIASOUP_ANNOUNCED_DOMAIN is set to Railway domain
- Check Railway's WebRTC/UDP support
- Test from multiple networks

## Next Steps

1. ✅ Push completed to GitHub
2. ⏳ Configure Railway service (set root directory to `backend`)
3. ⏳ Set environment variables in Railway
4. ⏳ Deploy and verify health endpoint
5. ⏳ Update frontend config.js
6. ⏳ Test with 2+ peers

## Migration from Old Backend

If you were using `server-mediasoup.js`:
- The new backend is in `backend/` directory
- Update Railway root directory to `backend`
- Update environment variables
- The new backend uses the same Socket.io events (compatible)

