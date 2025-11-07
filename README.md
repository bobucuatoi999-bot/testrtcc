# WebRTC Video Call Frontend

A React-based WebRTC video call frontend application.

## Features

- ✅ Peer-to-peer WebRTC connections
- ✅ Up to 4 participants per room
- ✅ Screen sharing
- ✅ Audio/video controls
- ✅ Room-based connections

## Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Configuration

Update the backend URL in your environment variables:

```bash
# Create .env file
VITE_API_URL=https://your-backend-url.com
```

Or update `frontend/src/hooks/useSignaling.js` to point to your backend server.

## License

MIT
