# Quick Start - Local Testing

## 🚀 Start the Application

### Step 1: Open Two Terminal Windows

You'll need two terminals - one for backend, one for frontend.

### Step 2: Start Backend (Terminal 1)

```powershell
cd "C:\Users\Admin\Documents\wps\TEST RTC\backend"
npm start
```

You should see:
```
Server started on 0.0.0.0:3000
```

### Step 3: Start Frontend (Terminal 2)

```powershell
cd "C:\Users\Admin\Documents\wps\TEST RTC\frontend"
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### Step 4: Open Browser

1. Go to: **http://localhost:5173**
2. Enter your name
3. Enter a room name (e.g., "test")
4. Click "Create Room"

### Step 5: Test with Multiple Users

1. Open a **new browser tab** or **different browser**
2. Go to: **http://localhost:5173**
3. Enter a different name
4. Enter the **same room name**
5. Click "Join Room"

You should see both video feeds!

## ✅ What to Test

- [ ] Create a room
- [ ] Join a room (2nd user)
- [ ] See video from other participants
- [ ] Hear audio from other participants
- [ ] Mute/unmute microphone
- [ ] Turn camera on/off
- [ ] Screen sharing
- [ ] Room password (create private room)
- [ ] Participant limit (try 5th user - should be blocked)

## ⚠️ Important Notes

1. **TURN Server Not Running**: 
   - Currently using STUN-only mode
   - May not work in some network configurations (symmetric NAT)
   - For full functionality, you'll need a TURN server

2. **Browser Permissions**:
   - Allow camera and microphone when prompted
   - Use Chrome or Firefox for best compatibility

3. **Network**:
   - Works best when all users are on the same network (local testing)
   - For internet testing, you'll need a TURN server

## 🔧 Troubleshooting

### Port Already in Use
If port 3000 or 5173 is already in use:
- Stop the existing service
- Or change the port in `.env` file

### No Video/Audio
- Check browser console (F12) for errors
- Verify camera/mic permissions
- Try different browser
- Check if WebSocket connection is established

### Connection Issues
- Verify backend is running (check http://localhost:3000/health)
- Check browser console for WebSocket errors
- Verify CORS settings in `.env`

## 📝 Next Steps

Once local testing works:
1. Set up TURN server for better NAT traversal
2. Deploy to Railway for internet access
3. Test with users on different networks

