# WebRTC Video/Voice Call App - Full Stack

A complete WebRTC-based video and voice call system with:
- Node.js backend signaling server
- Web frontend with name & room code input
- **Android APK support** (can be built for global distribution)

## 🚀 Quick Start - Android APK

**Want to build an Android APK?** See **[ANDROID_APK_COMPLETE_GUIDE.md](./ANDROID_APK_COMPLETE_GUIDE.md)** or start with **[QUICK_START.md](./QUICK_START.md)**

The app includes:
- ✅ Name and room code input
- ✅ Video and voice calls
- ✅ Mute/unmute functionality
- ✅ End call button
- ✅ Global server deployment ready
- ✅ Android APK build support

---

## Features

- ✅ User connection and disconnection handling with logging
- ✅ Room-based private 1-on-1 calls
- ✅ WebRTC signaling message relay (offer, answer, ice-candidate)
- ✅ PeerJS support
- ✅ CORS enabled for testing
- ✅ Static file serving from `public` folder
- ✅ Error handling for all events

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Server

Start the server:
```bash
npm start
```

For development with auto-reload (requires nodemon):
```bash
npm run dev
```

The server will start on **port 3000**.

## API Events

### Client → Server Events

- `join-room` - Join a call room with a room ID
  ```javascript
  socket.emit('join-room', 'room-123');
  ```

- `offer` - Send WebRTC offer
  ```javascript
  socket.emit('offer', {
    offer: rtcOffer,
    targetUserId: 'socket-id',
    roomId: 'room-123'
  });
  ```

- `answer` - Send WebRTC answer
  ```javascript
  socket.emit('answer', {
    answer: rtcAnswer,
    targetUserId: 'socket-id',
    roomId: 'room-123'
  });
  ```

- `ice-candidate` - Send ICE candidate
  ```javascript
  socket.emit('ice-candidate', {
    candidate: iceCandidate,
    targetUserId: 'socket-id',
    roomId: 'room-123'
  });
  ```

- `peerjs-signal` - Send PeerJS signal
  ```javascript
  socket.emit('peerjs-signal', {
    signal: peerSignal,
    targetUserId: 'socket-id',
    roomId: 'room-123'
  });
  ```

- `end-call` - End the call
  ```javascript
  socket.emit('end-call', {
    roomId: 'room-123',
    targetUserId: 'socket-id' // optional
  });
  ```

### Server → Client Events

- `room-joined` - Confirmation of joining a room
- `room-users` - List of existing users in the room
- `user-joined` - Notification when a user joins
- `user-left` - Notification when a user leaves
- `offer` - Received WebRTC offer
- `answer` - Received WebRTC answer
- `ice-candidate` - Received ICE candidate
- `peerjs-signal` - Received PeerJS signal
- `call-ended` - Call ended notification
- `error` - Error notifications

## Health Check

Visit `http://localhost:3000/health` to check server status.

## Project Structure

```
.
├── server.js                    # Backend signaling server
├── package.json                 # Dependencies (including Capacitor)
├── capacitor.config.json        # Capacitor config for Android
├── public/                      # Frontend files
│   ├── index.html              # Main HTML (name & room code)
│   ├── client.js               # WebRTC logic
│   └── config.js              # Server URL config ⚠️
├── android/                     # Android project (generated)
├── QUICK_START.md              # ⭐ Start here for Android APK
├── ANDROID_SETUP.md            # Detailed Android setup
├── DEPLOYMENT_GUIDE.md          # Backend deployment guide
└── README.md                    # This file
```

## Notes

- The server uses CORS with `origin: '*'` for testing purposes
- All rooms are tracked in memory (will be cleared on server restart)
- Static files are served from the `public` folder

