# Local Testing Guide

## Quick Start (Without Docker)

### Option 1: Use the PowerShell Script (Windows)

```powershell
.\start-local.ps1
```

This will:
- Create `.env` file if it doesn't exist
- Start backend server on port 3000
- Start frontend dev server on port 5173

### Option 2: Manual Start

1. **Start Backend:**
   ```powershell
   cd backend
   npm start
   ```
   Backend will run on: http://localhost:3000

2. **Start Frontend (in a new terminal):**
   ```powershell
   cd frontend
   npm run dev
   ```
   Frontend will run on: http://localhost:5173

### Option 3: Use Bash Script (Linux/Mac)

```bash
chmod +x start-local.sh
./start-local.sh
```

## Testing the Application

1. **Open your browser:**
   - Go to: http://localhost:5173

2. **Create a room:**
   - Enter your name
   - Enter a room name (e.g., "test-room")
   - Click "Create Room"

3. **Join from another browser/tab:**
   - Open a new browser tab or window
   - Go to: http://localhost:5173
   - Enter your name
   - Enter the same room name
   - Click "Join Room"

4. **Test features:**
   - Video/audio should work between participants
   - Try muting/unmuting
   - Try turning camera on/off
   - Try screen sharing

## Troubleshooting

### Backend not starting
- Check if port 3000 is already in use
- Check backend logs for errors
- Make sure `.env` file exists in root directory

### Frontend not starting
- Check if port 5173 is already in use
- Check frontend logs for errors
- Make sure `VITE_API_URL` in `.env` points to backend (http://localhost:3000)

### No video/audio
- Check browser console for errors
- Allow camera/microphone permissions
- Note: Without TURN server, WebRTC may not work in some network configurations (symmetric NAT)

### WebSocket connection failed
- Check if backend is running on port 3000
- Check browser console for WebSocket errors
- Verify CORS settings in `.env`

## Current Setup

- ✅ Backend: Node.js + Express + WebSocket
- ✅ Frontend: React + Vite
- ⚠️ TURN Server: Not running (STUN-only mode)
  - This means WebRTC may not work in all network scenarios
  - For full functionality, you'll need to set up a TURN server

## Next Steps

1. Test with 2-3 browser tabs/windows
2. Test on mobile devices (same network)
3. Test screen sharing
4. Test room password protection
5. Test participant limit (try joining with 5th participant)

## Stopping Services

- Press `Ctrl+C` in each terminal window
- Or close the terminal windows

