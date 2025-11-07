# WebRTC Signaling Server - Vanilla JS Backend

Express + Socket.io signaling server for WebRTC mesh video conferencing.

## 🚀 Quick Start

### Local Development

```bash
npm install
npm start
# Server runs on http://localhost:3000
```

### Railway Deployment

1. Push to GitHub
2. Create Railway project
3. Deploy from GitHub repo
4. Set environment variables:
   - `CORS_ORIGIN=*` (or your frontend URL)
   - `PORT=3000` (Railway sets automatically)

## 📋 Environment Variables

- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origins (default: *)
- `NODE_ENV` - Environment (development/production)

## 🧪 Test Endpoints

- `GET /` - Server status
- `GET /health` - Health check
- `GET /debug/rooms` - List active rooms (dev only)

## 📚 API

See `VANILLA_APP_README.md` for complete API documentation.

