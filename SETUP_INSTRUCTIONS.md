# WebRTC Mesh Video Call - Setup Instructions

## Quick Start

1. **Clone and setup:**
   ```bash
   git clone <your-repo-url>
   cd webrtc-mesh-video-call
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start services:**
   ```bash
   make setup && make up
   ```

3. **Access:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

## Environment Variables

See `.env.example` for all configuration options. Key variables:

- `TURN_SECRET`: Secret for TURN credentials (change in production!)
- `JWT_SECRET`: Secret for JWT tokens (change in production!)
- `TURNHOST`: TURN server hostname (leave empty for STUN-only)
- `MAX_PARTICIPANTS`: Maximum participants per room (default: 4)

## TURN Server Setup

### Option 1: Use Docker Compose (Recommended for Local Dev)
The `docker-compose.yml` includes a coturn service. Just start it:
```bash
docker-compose up -d coturn
```

### Option 2: Host TURN Separately (Recommended for Production)
1. Install coturn on a VM:
   ```bash
   sudo apt-get update
   sudo apt-get install coturn
   ```

2. Configure `/etc/turnserver.conf` using `coturn/turnserver.conf.template`

3. Open firewall ports:
   - UDP 3478 (STUN/TURN)
   - TCP 3478 (STUN/TURN)
   - TCP 5349 (TURN over TLS)
   - UDP 49152-65535 (relay ports)

4. Set `TURNHOST` in `.env` to your VM's IP/domain

### Option 3: STUN-only (Limited Reliability)
Leave `TURNHOST` empty in `.env`. The app will use public STUN servers only.
⚠️ **Warning**: May fail in symmetric NAT scenarios.

## Testing

Run E2E tests:
```bash
make test
```

## Deployment to Railway

See `README.md` for detailed Railway deployment instructions.

## Troubleshooting

### No video/audio
- Check browser console for errors
- Verify camera/mic permissions
- Check TURN server connectivity
- Verify ICE candidates are being exchanged

### Connection failures
- Verify TURN server is accessible
- Check firewall rules
- Test with STUN-only mode
- Check WebSocket connection status

### Room full errors
- Verify `MAX_PARTICIPANTS` is set correctly
- Check backend logs for participant count
- Ensure proper cleanup on participant leave

