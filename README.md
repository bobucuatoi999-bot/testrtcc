# WebRTC Mesh Video Call App

A complete, production-ready video call application supporting up to 4 participants using pure WebRTC peer-to-peer mesh networking. Built with React, Node.js, Express, and coturn for TURN/STUN services.

## Features

- ✅ Pure WebRTC mesh (no SFU/MCU)
- ✅ Up to 4 participants per room
- ✅ Screen sharing
- ✅ Audio/video controls
- ✅ Room password protection
- ✅ Mobile-responsive UI
- ✅ TURN/STUN via coturn
- ✅ WebSocket signaling
- ✅ Docker Compose for local dev and production
- ✅ Railway deployment ready
- ✅ End-to-end Puppeteer tests

## Architecture

- **Frontend**: React + Vite SPA with native WebRTC APIs
- **Backend**: Node.js + Express + WebSocket (ws) for signaling
- **Media**: WebRTC peer-to-peer mesh
- **NAT Traversal**: coturn (STUN/TURN)
- **Orchestration**: Docker Compose
- **Deployment**: Railway (Dockerfile-based)

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- Make (optional, for convenience commands)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd webrtc-mesh-video-call
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start services**
   ```bash
   make setup && make up
   # OR manually:
   # docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

### Manual Setup (without Docker)

1. **Backend setup**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Frontend setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **TURN server setup**
   - Install coturn on your system
   - Configure `/etc/turnserver.conf` using `coturn/turnserver.conf.template`
   - Start coturn: `turnserver -c /etc/turnserver.conf`

## Configuration

### Environment Variables

See `.env.example` for all available configuration options.

**Key variables:**
- `MAX_PARTICIPANTS`: Maximum participants per room (default: 4)
- `TURN_SECRET`: Secret for generating TURN credentials (change in production!)
- `JWT_SECRET`: Secret for JWT tokens (change in production!)
- `TURNHOST`: TURN server hostname or IP
- `PUBLIC_URL`: Public URL of your application (HTTPS required for production)

### TURN Server Configuration

**Important Notes:**
- Railway may have limitations with UDP traffic. For production, consider:
  1. Hosting coturn on a separate VM with UDP ports 3478/5349 and TCP 5349 (TLS)
  2. Using TURN over TLS (TCP 5349) instead of UDP
  3. STUN-only fallback mode (limited NAT traversal, may not work in all networks)

**TURN over TLS (Recommended for Railway)**
- Set `TURNPORT=5349` and use `turns:` scheme in WebRTC config
- Ensure coturn is configured with TLS certificates

**STUN-only Fallback**
- Set `TURNHOST=` (empty) to disable TURN
- Only STUN will be used (freeze.com or google.com STUN servers)
- ⚠️ **Warning**: May fail in symmetric NAT scenarios

## Testing

### Run E2E Tests

```bash
make test
# OR manually:
cd tests
./run-tests.sh
```

The test suite:
- Spins up Docker Compose
- Launches 3 headless browsers
- Joins the same room
- Validates media tracks from remote peers
- Attempts 5th join and confirms it's blocked

### Manual Testing Checklist

- [ ] **Mobile Testing**
  - [ ] Safari iOS (iPhone/iPad)
  - [ ] Chrome Android
  - [ ] Test camera/mic permissions

- [ ] **NAT Scenarios**
  - [ ] Home router (typical NAT)
  - [ ] Mobile hotspot
  - [ ] Corporate firewall

- [ ] **TURN Verification**
  - [ ] Block UDP to force TCP fallback
  - [ ] Verify TURN credentials are working
  - [ ] Test with STUN-only mode

- [ ] **Railway Deployment**
  - [ ] End-to-end deployment test
  - [ ] Verify HTTPS is working
  - [ ] Test from multiple networks

- [ ] **Features**
  - [ ] Screen share
  - [ ] Reconnect behavior
  - [ ] Audio/video toggle
  - [ ] Room password protection
  - [ ] Participant limit enforcement

## Deployment

### Railway Deployment

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Create Railway Project**
   - Go to Railway dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Services**
   - **Backend Service**: Use `backend/Dockerfile`
     - Port: 3000
     - Environment variables: Set all from `.env.example`
   - **Frontend Service**: Use `frontend/Dockerfile`
     - Port: 5173 (or configure via env)
     - Set `VITE_API_URL` to backend service URL

4. **Set Environment Variables**
   - Copy all variables from `.env.example`
   - Set `PUBLIC_URL` to your Railway domain (HTTPS)
   - Set `TURN_SECRET` and `JWT_SECRET` to strong random values
   - Configure `TURNHOST` (or leave empty for STUN-only)

5. **TURN Server Setup**
   - **Option 1**: Host coturn separately on a VM
     - Install coturn on Ubuntu/Debian VM
     - Configure firewall (UDP 3478/5349, TCP 5349)
     - Set `TURNHOST` to VM's IP/domain
   - **Option 2**: Use TURN over TLS (TCP 5349)
     - Configure coturn with TLS certificates
     - Set `TURNPORT=5349`
   - **Option 3**: STUN-only (limited reliability)
     - Leave `TURNHOST` empty
     - Will use public STUN servers

6. **Deploy**
   - Railway will automatically build and deploy
   - Check logs for any errors
   - Test the deployed application

### Production Docker Compose

```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## API Documentation

### REST Endpoints

- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics (if enabled)
- `GET /api/turn` - Get TURN credentials
- `POST /api/rooms` - Create a room
- `POST /api/rooms/join` - Join a room
- `POST /api/rooms/leave` - Leave a room

### WebSocket Signaling

**Connection**: `ws://your-domain/ws?token=<jwt-token>`

**Messages**:
- `join` - Join a room
- `offer` - Send SDP offer
- `answer` - Send SDP answer
- `candidate` - Send ICE candidate
- `leave` - Leave room
- `ping` - Keep-alive
- `pong` - Keep-alive response

## Security

- HTTPS required for production (WebRTC requires secure context)
- JWT tokens for WebSocket authentication
- Rate limiting on WebSocket messages
- CORS configuration for frontend origin
- TURN credentials with time-limited validity
- Room password protection

## Monitoring

Optional Prometheus metrics available at `/metrics`:
- Connected rooms count
- Active participants count
- WebSocket messages per second

Grafana dashboard available in docker-compose (disabled by default).

## Troubleshooting

### No video/audio
- Check browser console for errors
- Verify camera/mic permissions
- Check TURN server connectivity
- Verify ICE candidates are being exchanged

### Connection failures
- Verify TURN server is accessible
- Check firewall rules (UDP 3478/5349, TCP 5349)
- Test with STUN-only mode to isolate TURN issues
- Check WebSocket connection status

### Room full errors
- Verify `MAX_PARTICIPANTS` is set correctly
- Check backend logs for participant count
- Ensure proper cleanup on participant leave

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

For issues and questions, please open an issue on GitHub.
