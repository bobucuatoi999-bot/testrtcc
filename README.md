# WebRTC Video Conferencing App

A production-ready, lightweight Zoom alternative supporting exactly 4 users per room with voice, video, and screen sharing capabilities using WebRTC mesh architecture.

## Features

### Core Features
- ✅ **4-User Rooms**: Exactly 4 concurrent users per room
- ✅ **Room Management**: Create rooms with optional password protection
- ✅ **Admin Controls**: Room creator automatically becomes admin
- ✅ **Media Capabilities**: Voice, video, and screen sharing
- ✅ **Chat System**: Real-time text messaging with sidebar interface
- ✅ **Auto Cleanup**: Rooms and data automatically delete when empty
- ✅ **Mobile Responsive**: Works on desktop and mobile devices

### Technical Features
- **WebRTC Mesh**: Peer-to-peer architecture optimized for 4 users
- **Free STUN/TURN**: Uses Google STUN and Open Relay Project TURN servers
- **Socket.io Signaling**: Real-time WebRTC signaling
- **TypeScript**: Fully typed for reliability
- **Tailwind CSS**: Modern, responsive UI
- **Railway Ready**: Complete deployment configuration

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **WebRTC**: Mesh topology (P2P for 4 users)
- **Signaling**: Socket.io for WebRTC signaling
- **Storage**: In-memory (no database required)

## Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom hooks
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Helper functions
│   └── package.json
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── socket/        # Socket.io handlers
│   │   └── utils/         # Helper functions
│   └── package.json
├── Dockerfile
├── railway.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Modern browser with WebRTC support (Chrome, Firefox, Safari, Edge)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd webrtc-video-conferencing
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**

   Create `server/.env`:
   ```env
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=development
   CORS_ORIGIN=*
   ```

   Create `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

5. **Start the backend**
   ```bash
   cd server
   npm run dev
   ```

6. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```

7. **Open your browser**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## Deployment

### Railway Deployment

1. **Prepare for deployment**
   ```bash
   # Build frontend
   cd frontend
   npm run build
   ```

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

3. **Deploy on Railway**
   - Go to [railway.app](https://railway.app)
   - Create a new project
   - Connect your GitHub repository
   - Railway will automatically detect the `railway.json` and `Dockerfile`
   - Set environment variables:
     - `NODE_ENV=production`
     - `CORS_ORIGIN=your-frontend-url` (or `*` for development)

4. **Update frontend API URL**
   - Update `frontend/.env.production` with your Railway backend URL
   - Rebuild and deploy frontend (or use Railway's static site hosting)

### Environment Variables

**Backend (.env)**
```env
PORT=3000                    # Server port (Railway sets this automatically)
HOST=0.0.0.0                # Host to bind to
NODE_ENV=production         # Environment
CORS_ORIGIN=*               # CORS allowed origins (comma-separated or * for all)
```

**Frontend (.env)**
```env
VITE_API_URL=https://your-backend.railway.app
```

## Usage

### Creating a Room

1. Enter your display name
2. Click "Create New Room"
3. (Optional) Set a password for the room
4. Share the room link with others
5. You automatically join as admin

### Joining a Room

1. Enter your display name
2. Enter the room ID (from the shared link)
3. (If password protected) Enter the room password
4. Click "Join Room"

### In-Room Features

- **Video/Audio Controls**: Toggle camera and microphone
- **Screen Sharing**: Share your screen with others
- **Chat**: Real-time text messaging
- **Leave Room**: Exit the room (room persists if others are present)

## Technical Details

### WebRTC Configuration

The app uses free STUN/TURN servers:
- **Google STUN**: `stun.l.google.com:19302`
- **Open Relay Project TURN**: 20GB/month free bandwidth
  - `turn:openrelay.metered.ca:80`
  - `turn:openrelay.metered.ca:443`
  - `turns:openrelay.metered.ca:443?transport=tcp`

### Room Management

- Rooms are stored in-memory
- Maximum 4 users per room
- Room creator is admin
- Admin can set optional password
- Rooms auto-delete when empty
- Chat history cleared when room empties

### Security

- Password hashing with bcrypt
- XSS protection for chat messages
- Rate limiting on room creation
- Input validation and sanitization

## Known Limitations

1. **TURN Bandwidth**: Free TURN servers have limited bandwidth (20GB/month)
2. **Mesh Architecture**: Optimal for 4 users; not suitable for larger groups
3. **No Persistence**: All data is in-memory; rooms are lost on server restart
4. **Browser Compatibility**: Requires modern browsers with WebRTC support

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Troubleshooting

### Camera/Microphone Not Working
- Check browser permissions
- Ensure HTTPS in production (required for media access)
- Try a different browser

### Connection Issues
- Check firewall settings
- Verify STUN/TURN servers are accessible
- Check browser console for errors

### Room Not Found
- Verify room ID is correct
- Check if room was closed (empty rooms auto-delete)
- Ensure backend is running

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
