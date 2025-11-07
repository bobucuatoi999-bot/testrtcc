# Local Testing Guide

## Quick Start

Both servers are now running:

- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:5173

## Testing Steps

### 1. Open the Application

1. Open your browser and go to: **http://localhost:5173**
2. Allow camera and microphone permissions when prompted

### 2. Create a Room

1. Enter your display name
2. (Optional) Set a room password
3. Click "Create New Room"
4. You'll automatically join as the room admin
5. Copy the room link from the header to share with others

### 3. Join a Room (Second User)

1. Open a new browser tab/window (or use a different browser)
2. Go to: **http://localhost:5173**
3. Enter your display name
4. Enter the room ID from the first user
5. (If password protected) Enter the password
6. Click "Join Room"

### 4. Test Features

- **Video**: Verify all users can see each other
- **Audio**: Check if audio is working (mute/unmute)
- **Screen Sharing**: Click the screen share button
- **Chat**: Send messages in the chat sidebar
- **Controls**: Test mute, camera off, leave room

### 5. Test with Multiple Users

- Open up to 4 browser windows/tabs
- All should join the same room
- Verify all 4 video feeds are visible
- Try the 5th user - should be rejected (room full)

## Troubleshooting

### Camera/Microphone Not Working

- Check browser permissions
- Ensure HTTPS in production (localhost works for development)
- Try a different browser
- Check browser console for errors

### Connection Issues

- Verify backend is running: http://localhost:3000/health
- Check browser console for WebSocket errors
- Ensure no firewall blocking ports 3000/5173
- Check that STUN/TURN servers are accessible

### Room Not Found

- Verify room ID is correct
- Check if room was closed (empty rooms auto-delete)
- Ensure backend is running

### WebRTC Connection Fails

- Check browser console for ICE candidate errors
- Verify STUN/TURN servers are accessible
- Try different network (some networks block WebRTC)
- Check if firewall is blocking UDP traffic

## Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)

## Development Notes

- Backend runs on port 3000
- Frontend runs on port 5173
- Both auto-reload on file changes
- Check terminal output for logs

## Stopping Servers

Press `Ctrl+C` in the terminal windows where servers are running.

Or kill all Node processes:
```bash
taskkill /F /IM node.exe
```

