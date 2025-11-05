# WebRTC Video & Voice Call System

A complete, reliable WebRTC-based video and voice call system with auto-start calls, mute, camera toggle, and screen sharing.

## 🚀 Features

- ✅ **Room-based 1-on-1 calls** - Enter room code to connect
- ✅ **Auto-start calls** - Automatically connects when both users join
- ✅ **Mute/Unmute** - Toggle microphone on/off
- ✅ **Camera Toggle** - Turn camera on/off (audio-only fallback)
- ✅ **Screen Sharing** - Share your screen with remote user
- ✅ **No Camera/Mic Required** - Users without devices can still join and receive
- ✅ **Free STUN/TURN Servers** - Uses Google STUN + OpenRelay TURN for reliability
- ✅ **Error Handling** - User-friendly error messages and auto-reconnection
- ✅ **Global Access** - Deployed on Railway for worldwide access

## 📦 Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: HTML5 + JavaScript (PeerJS)
- **WebRTC**: PeerJS for peer connections
- **Signaling**: Socket.io for real-time communication
- **Deployment**: Railway.app

## 🎯 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Open in browser:**
   - Visit: `http://localhost:3000`
   - Enter your name and a room code
   - Click "Start Video Call" or "Start Voice Call"

### Testing

1. Open two browser tabs/windows
2. Enter the same room code in both
3. Both users will automatically connect when second user joins
4. Test mute, camera, and screen sharing buttons

## 🌐 Production Deployment

The app is deployed on Railway:
- **URL**: `https://testrtcc-production.up.railway.app`
- **Auto-deploy**: Updates automatically when you push to GitHub

## 📝 How It Works

### Connection Flow

1. User enters name and room code
2. User clicks "Start Video Call" or "Start Voice Call"
3. App requests camera/microphone access
4. User joins room on signaling server (Socket.io)
5. PeerJS initializes and generates peer ID
6. When second user joins, PeerJS IDs are exchanged
7. Peer-to-peer connection established automatically
8. Video/audio streams are shared

### Features Explained

- **Auto-Start**: When both users are in the room, connection starts automatically
- **Mute**: Toggles microphone on/off (mutes your audio)
- **Camera**: Toggles camera on/off (shows black screen when off)
- **Screen Share**: Replaces video with screen content
- **No Device Required**: Users without camera/mic can still join and receive audio/video

## 🔧 Configuration

### Server URL

Edit `public/config.js` to change server URL:
```javascript
window.SERVER_URL = 'https://your-server-url.com';
```

### STUN/TURN Servers

Currently using free servers:
- **STUN**: Google's public STUN servers (free)
- **TURN**: OpenRelay (free, no auth required)

To use custom TURN server, edit `public/client.js`:
```javascript
const rtcConfig = {
    iceServers: [
        // Add your TURN server here
        { 
            urls: 'turn:your-turn-server:3478',
            username: 'your-username',
            credential: 'your-password'
        }
    ]
};
```

## 📁 Project Structure

```
.
├── server.js              # Express + Socket.io signaling server
├── package.json           # Dependencies
├── public/
│   ├── index.html        # Frontend UI
│   ├── client.js         # WebRTC client logic (PeerJS)
│   └── config.js         # Server URL configuration
└── README.md             # This file
```

## 🐛 Troubleshooting

### Connection Issues

1. **Check browser console** for errors
2. **Verify server is running** - Check Railway logs
3. **Check firewall** - WebRTC needs UDP ports open
4. **Try different network** - Some networks block WebRTC

### Media Access Issues

1. **Allow camera/mic permissions** in browser
2. **Check device manager** - Ensure camera/mic are working
3. **Try different browser** - Chrome/Firefox recommended

### No Video/Audio

1. **Check mute button** - Make sure mic isn't muted
2. **Check camera button** - Make sure camera is on
3. **Refresh page** - Sometimes helps with connection issues

## 📚 API Reference

### Socket.io Events

**Client → Server:**
- `join-room` - Join a room with roomId and userName
- `peer-id` - Send PeerJS ID to other users
- `end-call` - End the current call
- `leave-room` - Leave room without ending call

**Server → Client:**
- `room-joined` - Confirmation of room join
- `room-users` - List of existing users in room
- `user-joined` - New user joined the room
- `user-left` - User left the room
- `peer-id` - Received PeerJS ID from another user
- `call-ended` - Call was ended by other user

## 🎓 Learning Resources

- [WebRTC Documentation](https://webrtc.org/)
- [PeerJS Documentation](https://peerjs.com/docs)
- [Socket.io Documentation](https://socket.io/docs/v4/)

## 📄 License

ISC

## 🙏 Credits

Built with:
- PeerJS - WebRTC peer connections
- Socket.io - Real-time signaling
- Express - Web server
- Google STUN servers - Free NAT traversal
- OpenRelay TURN server - Free relay service

---

**Ready to use!** Just deploy and start making calls! 🎉
