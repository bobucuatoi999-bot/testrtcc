# WebRTC Video Call App

A simple WebRTC mesh video call application supporting up to 4 participants per room.

## Features

- ✅ Peer-to-peer WebRTC mesh networking
- ✅ Up to 4 participants per room
- ✅ Screen sharing
- ✅ Audio/video controls
- ✅ Room-based connections
- ✅ WebSocket signaling

## Project Structure

```
.
├── backend/          # Node.js signaling server
├── frontend/         # React frontend
└── render.yaml       # Render.com deployment config
```

## Local Development

### Backend

```bash
cd backend
npm install
npm start
```

Server runs on `http://localhost:3000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Deployment

### Deploy Backend to Render.com

1. Go to [render.com](https://render.com) and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Set environment variables:
   - `JWT_SECRET` - Generate a random string
   - `NODE_ENV` = `production`
   - `CORS_ALLOW_ORIGIN` = `*`
6. Deploy!

Your backend URL will be: `https://your-service.onrender.com`

### Update Frontend

Update the backend URL in your frontend code to point to your deployed Render service.

## Environment Variables

**Backend:**
- `JWT_SECRET` - Secret for JWT tokens (required)
- `PORT` - Server port (default: 3000)
- `CORS_ALLOW_ORIGIN` - CORS allowed origins (default: *)
- `MAX_PARTICIPANTS` - Max participants per room (default: 4)

## License

MIT
