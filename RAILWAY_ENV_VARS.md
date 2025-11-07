# Railway Environment Variables Configuration

## 📋 Backend Service Environment Variables

Copy and paste these into Railway Dashboard → Backend Service → Variables:

```env
APPHOST=0.0.0.0
APPPORT=3000
PUBLIC_URL=https://testrtcc-production.up.railway.app
NODE_ENV=production
CORS_ALLOW_ORIGIN=https://testrtcc-production.up.railway.app
MAX_PARTICIPANTS=4
TURNHOST=
TURNPORT=3478
TURN_SECRET=CHANGE_THIS_TO_SECURE_RANDOM_STRING
TURN_REALM=webrtc
JWT_SECRET=CHANGE_THIS_TO_SECURE_RANDOM_STRING
MONITORING_ENABLED=false
PROMETHEUS_PORT=9100
RATE_LIMIT_WS_PER_MINUTE=600
```

## 📋 Frontend Service Environment Variables

Copy and paste these into Railway Dashboard → Frontend Service → Variables:

```env
VITE_API_URL=https://testrtcc-production.up.railway.app
VITE_PUBLIC_URL=https://testrtcc-production.up.railway.app
```

## 🔐 Generate Secure Secrets

Run these commands to generate secure secrets:

```powershell
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('TURN_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

Replace `CHANGE_THIS_TO_SECURE_RANDOM_STRING` in the environment variables above with the generated values.

## ⚠️ Important Notes

1. **After Backend Deployment**: Railway will assign a backend domain (e.g., `webrtc-backend-production.up.railway.app`)
   - Update Frontend's `VITE_API_URL` to use the backend domain
   - Update Backend's `CORS_ALLOW_ORIGIN` to match frontend domain

2. **Use HTTPS**: Always use `https://` (not `http://`) for all URLs in production

3. **Frontend Domain**: Set to `testrtcc-production.up.railway.app` in Railway

4. **CORS**: Must match exact frontend URL including `https://`

