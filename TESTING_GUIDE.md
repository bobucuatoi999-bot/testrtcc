# 🚀 Testing Guide - WebRTC Mesh Video Call

## ✅ Services Status

Both services are running:
- **Backend**: Port 3000 (LISTENING)
- **Frontend**: Port 5173 (LISTENING)

## 🌐 Access the Application

**Open in your browser:** http://localhost:5173

## 📋 Step-by-Step Testing

### Test 1: Create and Join a Room

1. **Open Browser Tab 1:**
   - Go to: http://localhost:5173
   - Enter your name (e.g., "Alice")
   - Enter room name (e.g., "test-room")
   - Click **"Create Room"**
   - Allow camera/microphone permissions

2. **Open Browser Tab 2 (or different browser):**
   - Go to: http://localhost:5173
   - Enter a different name (e.g., "Bob")
   - Enter the **same room name**: "test-room"
   - Click **"Join Room"**
   - Allow camera/microphone permissions

3. **Expected Result:**
   - Both tabs should show 2 video tiles
   - You should see and hear each other
   - Connection status should show "Connected"

### Test 2: Audio/Video Controls

- Click **Mute** button - audio should stop
- Click **Camera Off** button - video should stop
- Try toggling them on/off

### Test 3: Screen Sharing

- Click **Share Screen** button
- Select a window/screen to share
- Other participants should see your screen
- Click **Stop Sharing** to return to camera

### Test 4: Room Password Protection

1. Create a room with password:
   - Check "Private room" checkbox
   - Enter a password
   - Create room

2. Try joining with wrong password:
   - Should see error message

3. Join with correct password:
   - Should join successfully

### Test 5: Participant Limit (4 max)

1. Create a room
2. Join with 4 different browser tabs/windows
3. Try joining with a 5th tab:
   - Should see "Room is full" message
   - Should be blocked from joining

## 🔍 Troubleshooting

### No Video/Audio
- Check browser console (F12) for errors
- Verify camera/mic permissions are allowed
- Try refreshing the page
- Check if WebSocket connection is established (look for "Connected" status)

### Connection Issues
- Verify backend is running: http://localhost:3000/health
- Check backend terminal for errors
- Check frontend terminal for errors
- Verify `.env` file exists in root directory

### WebSocket Connection Failed
- Check if backend is running on port 3000
- Verify `VITE_API_URL` in `.env` is `http://localhost:3000`
- Check browser console for WebSocket errors
- Try refreshing the page

### STUN/TURN Issues
- Currently using STUN-only mode (TURN server not running)
- May not work in some network configurations
- For local testing on same network, should work fine
- For internet testing, you'll need a TURN server

## 🎯 What to Check

- [ ] Can create a room
- [ ] Can join a room
- [ ] Video is visible
- [ ] Audio is audible
- [ ] Mute/unmute works
- [ ] Camera on/off works
- [ ] Screen sharing works
- [ ] Room password protection works
- [ ] Participant limit (4 max) is enforced
- [ ] Multiple participants can join
- [ ] Participants can see each other's video

## 📝 Browser Compatibility

- ✅ Chrome (Recommended)
- ✅ Firefox
- ✅ Edge
- ⚠️ Safari (may have limitations)

## 💡 Tips

1. **Best Testing Setup:**
   - Use Chrome for all tabs
   - Test on same computer first (multiple tabs)
   - Then test on different devices (same network)

2. **Debugging:**
   - Open browser DevTools (F12)
   - Check Console tab for errors
   - Check Network tab for WebSocket connections
   - Check Application tab for WebRTC stats

3. **Network:**
   - Works best on same local network
   - For internet testing, need TURN server
   - Mobile devices work but may need better network

## 🚨 Known Limitations

- **No TURN Server**: Currently STUN-only, may not work in all networks
- **Mesh Topology**: Each peer connects to every other peer (scales to 4 participants)
- **No Recording**: Video calls are not recorded
- **No Chat**: Text chat is not implemented yet

## 📞 Need Help?

- Check terminal windows for error messages
- Check browser console (F12) for errors
- Verify all environment variables in `.env`
- Make sure ports 3000 and 5173 are not blocked



