# WebRTC Video Conferencing - Vanilla JS Version

Complete, bug-fixed WebRTC video conferencing app with mesh architecture for up to 4 users.

## 🎯 Features

- ✅ **Bidirectional Mesh Connections** - All users connect to each other
- ✅ **Media Handling** - Works with or without camera/microphone
- ✅ **Auto-Reconnection** - Reconnects on connection failures
- ✅ **Screen Sharing** - Share screen with all participants
- ✅ **Chat** - Real-time chat sidebar
- ✅ **Room Management** - Create/join rooms with optional password
- ✅ **Connection Reliability** - Keep-alive mechanisms for stable connections

## 🐛 Bugs Fixed

1. **Asymmetrical Visibility** - Fixed bidirectional connection setup
2. **No Media Display** - Fixed stream attachment and video element updates
3. **Connection Failures** - Added reconnection logic and keep-alive
4. **Screen Sharing** - Fixed track replacement and renegotiation
5. **Race Conditions** - Added deterministic offerer rule and fallbacks

## 📁 Project Structure

```
vanilla-backend/
  ├── server.js          # Express + Socket.io signaling server
  ├── package.json       # Backend dependencies
  └── railway.json       # Railway deployment config

vanilla-frontend/
  ├── index.html         # Main HTML file
  ├── app.js             # WebRTC client logic
  └── (served statically)
```

## 🚀 Quick Start

### Local Development

1. **Start Backend:**
```bash
cd vanilla-backend
npm install
npm start
# Server runs on http://localhost:3000
```

2. **Start Frontend:**
```bash
# Serve vanilla-frontend/index.html with a static server
# Option 1: Python
cd vanilla-frontend
python -m http.server 8080

# Option 2: Node.js
npx serve vanilla-frontend -p 8080

# Option 3: Use Vite (for better dev experience)
npm install -g vite
cd vanilla-frontend
vite --port 8080
```

3. **Open Browser:**
```
http://localhost:8080
```

### Railway Deployment

#### Backend:

1. Push `vanilla-backend/` to GitHub
2. Create Railway project
3. Deploy from GitHub repo
4. Set environment variables:
   - `CORS_ORIGIN=*` (or your frontend URL)
   - `PORT=3000` (Railway sets this automatically)

#### Frontend:

1. Deploy `vanilla-frontend/` as static site (Railway, Vercel, Netlify)
2. Set `API_URL` environment variable to your backend URL
3. Update backend `CORS_ORIGIN` to frontend URL

## 🔧 Configuration

### Backend Environment Variables

- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origins (default: *)
- `NODE_ENV` - Environment (development/production)

### Frontend Configuration

Edit `app.js`:
```javascript
const API_URL = 'http://localhost:3000'; // Your backend URL
```

## 📋 Key Implementation Details

### Bidirectional Connections

- **Deterministic Rule**: Lower userId creates offer (prevents glare)
- **Fallback Mechanism**: If no offer received in 2s, create one
- **Full Mesh**: All users connect to all other users

### Media Handling

- **With Devices**: Normal sendrecv tracks
- **Without Devices**: Recvonly transceivers + dummy silent audio track (keeps connection alive)
- **Local Preview**: Always shows local video if available

### Reconnection Logic

- **Monitor States**: `connectionState` and `iceConnectionState`
- **Auto Retry**: Reconnect after 5 seconds on failure
- **Keep-Alive**: Periodic checks for recvonly connections

### Screen Sharing

- **Track Replacement**: Uses `replaceTrack()` on all peer connections
- **Auto Stop**: Detects when user stops sharing
- **Fallback**: Returns to camera when screen share ends

## 🧪 Testing

1. **Local Test:**
   - Open `http://localhost:8080` in multiple browsers/tabs
   - Create room in one, join from others
   - Test video/audio/screen share

2. **Global Test:**
   - Deploy to Railway
   - Test from different devices/networks
   - Verify WebRTC connections work

## 📚 API Endpoints

### Backend

- `GET /` - Server status
- `GET /health` - Health check
- `GET /debug/rooms` - List active rooms (dev only)

### Socket.io Events

**Client → Server:**
- `create-room` - Create new room
- `join-room` - Join existing room
- `leave-room` - Leave room
- `signal` - WebRTC signaling (offer/answer/ice-candidate)
- `chat-message` - Send chat message

**Server → Client:**
- `room-created` - Room created successfully
- `room-joined` - Joined room successfully
- `user-joined` - New user joined
- `user-left` - User left room
- `room-closed` - Room was closed
- `signal` - WebRTC signaling
- `chat-message` - Chat message received
- `error` - Error occurred

## 🐛 Known Issues / Limitations

- Maximum 4 users per room (by design)
- No persistent storage (rooms deleted on empty)
- No user authentication (room passwords only)
- WebRTC may not work behind some corporate firewalls

## 🔒 Security Notes

- Room passwords are hashed with bcrypt
- No persistent user data
- CORS should be configured for production
- Consider adding rate limiting for production

## 📝 License

MIT

## 🙏 Credits

- WebRTC API
- Socket.io for signaling
- Open Relay Project for free TURN servers
- Google STUN servers

---

**Ready to deploy!** 🚀

