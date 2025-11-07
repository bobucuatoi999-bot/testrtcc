# Deploy Both Backend & Frontend on Railway

## Option 1: Railway for Everything (Recommended)

You can deploy both backend and frontend on Railway! This keeps everything in one place.

### Architecture

```
Railway Project
├── Backend Service (Docker)
│   └── Node.js + Express + Socket.io
└── Frontend Service (Static Site)
    └── React + Vite (built and served)
```

### Step 1: Deploy Backend

1. Go to Railway Dashboard
2. **New Project** → **Deploy from GitHub**
3. Select your repository
4. Railway will create a service from `server/Dockerfile`
5. Add Environment Variables:
   ```
   NODE_ENV=production
   CORS_ORIGIN=*
   ```
6. Get backend URL: `https://your-backend.railway.app`

### Step 2: Deploy Frontend (Same Railway Project)

1. In the **same Railway project**, click **+ New Service**
2. Select **"Static Site"** (or "GitHub Repo" → Configure as static)
3. Configure:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**:
     ```
     VITE_API_URL=https://your-backend.railway.app
     ```
4. Railway will build and deploy your frontend
5. Get frontend URL: `https://your-frontend.railway.app`

### Step 3: Update CORS

1. Go to **Backend Service** → **Variables**
2. Update `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://your-frontend.railway.app
   ```
3. Railway will redeploy automatically

### Benefits

✅ **Everything in one place** - Single Railway project
✅ **Easier management** - One dashboard for both services
✅ **Unified billing** - Railway's free tier covers both
✅ **Same domain** - Can use Railway's domain or custom domain

## Option 2: Railway + Vercel (Alternative)

If you prefer to use Vercel for frontend:

1. **Backend**: Railway (Docker)
2. **Frontend**: Vercel (Static Site)

See `QUICK_DEPLOY.md` for this option.

## Comparison

| Feature | Railway (Both) | Railway + Vercel |
|---------|---------------|------------------|
| **Services** | 2 (same project) | 2 (different platforms) |
| **Management** | One dashboard | Two dashboards |
| **Billing** | One account | Two accounts |
| **Domain** | Railway domain | Railway + Vercel domains |
| **Cost** | Free tier ($5 credit) | Free tiers for both |
| **Deployment Speed** | Both deploy together | Separate deployments |

## Recommendation

**Use Railway for both** - It's simpler, keeps everything together, and Railway's free tier is generous enough for both services.

## Railway Free Tier Limits

- **500 hours/month** (shared between services)
- **$5 credit** (covers both services easily)
- **100GB egress/month**

For a 4-user video conferencing app, this is more than enough!

