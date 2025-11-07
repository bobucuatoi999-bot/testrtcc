# WebSocket Connection Fix

## Issue
WebSocket connection to `ws://localhost:3000/socket.io/` was failing with "WebSocket is closed before the connection is established".

## Root Cause
CORS (Cross-Origin Resource Sharing) issues when frontend (port 5173) tries to connect to backend (port 3000).

## Solution Applied

### 1. Backend CORS Configuration (server/src/server.ts)
- Explicitly allow `http://localhost:5173` and `http://127.0.0.1:5173`
- Added proper CORS headers for Socket.io
- Configured credentials support

### 2. Vite Proxy Configuration (frontend/vite.config.ts)
- Added proxy for `/socket.io` requests
- Routes Socket.io traffic through Vite dev server to avoid CORS issues
- Enables WebSocket upgrade through proxy

### 3. Frontend Socket Connection (frontend/src/hooks/useSocket.ts)
- Uses relative URL in development (goes through proxy)
- Uses explicit API URL in production
- Added proper connection options

## How It Works

**Development Mode:**
- Frontend connects to: `/socket.io` (relative URL)
- Vite proxy forwards to: `http://localhost:3000/socket.io`
- No CORS issues because request appears to come from same origin

**Production Mode:**
- Frontend connects to: `https://your-backend-url.com/socket.io`
- Direct connection with proper CORS headers from backend

## Testing

1. **Restart both servers:**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm run dev

   # Terminal 2 - Frontend  
   cd frontend
   npm run dev
   ```

2. **Check browser console:**
   - Should see: `Connected to server` or similar
   - No WebSocket errors
   - Connection status should show as connected

3. **Test features:**
   - Create a room
   - Join a room
   - Verify real-time updates work

## Troubleshooting

If connection still fails:

1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check frontend proxy:**
   - Open browser DevTools → Network tab
   - Look for `/socket.io` requests
   - Should see 200 status codes

3. **Verify CORS headers:**
   - Check browser console for CORS errors
   - Verify `Access-Control-Allow-Origin` header includes frontend URL

4. **Check Socket.io version compatibility:**
   - Backend and frontend should use same Socket.io version
   - Current: Socket.io v4.6.1

## Notes

- The proxy only works in development mode
- Production deployments need proper CORS configuration
- WebSocket connections require proper network configuration
- Some corporate firewalls may block WebSocket connections

