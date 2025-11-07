# 🎥 WebRTC Video Conferencing - PeerJS Solution

Production-ready video conferencing app for up to 4 users using PeerJS.

## ✨ Features

- 🎥 Video calls with up to 4 participants
- 🎤 Audio/video controls
- 💬 Real-time chat
- 🔄 Automatic reconnection
- 🌐 Works globally with PeerJS cloud
- 📱 Mobile-friendly
- 🎨 Modern UI with Tailwind-inspired design

## 🚀 Quick Start

### Local Development

```bash
# Navigate to backend
cd peerjs-backend

# Install dependencies
npm install

# Start server
npm start

# Open http://localhost:3000
```

### Test with Multiple Users

1. Open `http://localhost:3000` in 4 browser tabs
2. Tab 1: Enter name → Click "Create New Room" → Copy room ID
3. Tab 2-4: Enter name → Paste room ID → Click "Join Room"
4. All tabs should see each other's video!

## 📁 Project Structure

```
peerjs-backend/
├── server.js           # Express + Socket.io signaling server
├── package.json        # Dependencies
├── railway.json        # Railway deployment config
└── public/
    └── index.html      # Complete single-file app
```

## 🏗️ Architecture

```
┌─────────────────────┐
│ PeerJS Cloud Server │ (0.peerjs.com)
│ - Peer connections  │
│ - NAT traversal     │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼───┐     ┌───▼───┐
│User A │◄────►│User B │
└───┬───┘     └───┬───┘
    │             │
    └──────┬──────┘
           │
       ┌───▼───┐
       │User C │
       └───────┘

Your Server (Railway):
- Room management
- User signaling
- Chat messages
```

## 🔧 How It Works

### 1. Media First
```javascript
// Get camera/microphone FIRST
await getUserMedia()

// Then initialize PeerJS
peer = new Peer()

// Then join room
socket.emit('join-room')
```

### 2. Mesh Connections
```javascript
// New joiner calls ALL existing users
existingUsers.forEach(user => {
  peer.call(user.peerId, localStream)
})

// Existing users just answer incoming calls
peer.on('call', call => {
  call.answer(localStream)
})
```

### 3. Connection Monitoring
```javascript
// Check connections every 3 seconds
setInterval(() => {
  ensureAllConnections()
}, 3000)
```

## 🌐 Deploy to Railway

### Step 1: Push to GitHub

```bash
git add .
git commit -m "PeerJS video conferencing app"
git push origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select repository → Select `peerjs-backend` folder
4. Set environment variables:
   - `CORS_ORIGIN=*`
   - `NODE_ENV=production`
5. Deploy!

### Step 3: Update Frontend

```bash
# Edit peerjs-backend/public/index.html
# Find line ~441:
const SIGNALING_SERVER = 'https://your-app.railway.app'

# Commit and push
git add peerjs-backend/public/index.html
git commit -m "update signaling server URL"
git push
```

### Step 4: Test

1. Open your Railway URL
2. Create room
3. Open in another browser/device
4. Join room
5. Video should work!

## 📊 Dependencies

### Backend
- `express` - Web server
- `socket.io` - Real-time signaling
- `cors` - Cross-origin support

### Frontend (CDN)
- PeerJS - WebRTC wrapper
- Socket.io Client - Real-time communication

## 🧪 Testing

### Test 2 Users
```bash
# Terminal 1
cd peerjs-backend && npm start

# Browser Tab 1
http://localhost:3000 → Create Room

# Browser Tab 2
http://localhost:3000 → Join Room
```

### Test 4 Users
Open 4 browser tabs, all should see each other.

### Expected Console Logs
```
✅ Socket connected
✅ PeerJS connected, peerId: xxx
📞 Calling existing users...
✅ Call object created
✅✅✅ RECEIVED STREAM
🎉 Successfully connected!
```

## 🐛 Troubleshooting

### "No video/audio"
- Check browser permissions
- Camera/microphone must be allowed
- Try different browser

### "Can't see other users"
- Check console for errors
- Verify PeerJS connected (`✅ PeerJS connected`)
- Check if calls are created (`📞 Calling...`)
- Wait 5-10 seconds for connections

### "Connection failed"
- Check internet connection
- Try refreshing page
- Check firewall settings
- Verify PeerJS cloud is accessible

## 📚 Documentation

- **Quick Start**: `PEERJS_QUICK_START.md`
- **Full Solution**: `PEERJS_SOLUTION.md`
- **Deploy Guide**: `PEERJS_DEPLOY.md`
- **Final Fix**: `PEERJS_FINAL_FIX.md`
- **Connection Fix**: `PEERJS_CONNECTION_FIX.md`

## 🎯 Key Features

### Automatic Reconnection
If connection drops, automatically retries every 3 seconds.

### Connection Monitoring
Periodic check ensures all users stay connected.

### Retry Logic
Failed connections automatically retry with exponential backoff.

### Error Handling
Graceful handling of all PeerJS errors.

## 🔒 Security Notes

- No user authentication (add if needed)
- Rooms are public (add passwords if needed)
- All traffic is peer-to-peer encrypted
- Server only handles signaling

## 📈 Performance

- Mesh architecture (direct peer-to-peer)
- Max 4 users (for optimal performance)
- STUN/TURN for NAT traversal
- Adaptive bitrate (handled by browser)

## 🎨 Customization

### Change Max Users
```javascript
// server.js
const MAX_USERS = 4; // Change to your limit
```

### Change PeerJS Server
```javascript
// index.html
peer = new Peer({
  host: 'your-peerjs-server.com',
  // ...
});
```

### Change Theme
Edit CSS in `index.html` - all styles are inline.

## 📝 License

MIT

## 🙋 Support

Check documentation files for help:
- `PEERJS_FINAL_FIX.md` - Latest fixes
- `PEERJS_CONNECTION_FIX.md` - Connection issues
- `CRITICAL_BUG_FOUND.md` - Bug analysis

---

**Ready to use!** 🚀

Start the server and test with multiple users.

