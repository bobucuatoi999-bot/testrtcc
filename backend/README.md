# Mediasoup Video Call Backend

Production-ready Node.js backend for 7-person group video calls using mediasoup v3, optimized for Vietnam and global deployment.

## Features

- ✅ 7-person group video calls
- ✅ Audio/Video streaming with mediasoup SFU
- ✅ Screen sharing support
- ✅ Optimized for Asia-Pacific region (Vietnam, Singapore)
- ✅ Global accessibility with proper NAT traversal
- ✅ Production-ready with PM2 process management
- ✅ Health monitoring and stats endpoints
- ✅ Automatic cleanup and resource management
- ✅ Graceful shutdown handling

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Main entry point
│   ├── config.js              # Configuration
│   ├── Room.js                 # Room management
│   ├── Peer.js                 # Peer connection handling
│   └── mediasoup/
│       ├── worker.js           # Worker pool management
│       └── config.js           # Mediasoup-specific config
├── package.json
├── .env.example
├── ecosystem.config.js         # PM2 configuration
├── deploy.sh                   # Deployment script
└── README.md
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Linux/Unix server (Ubuntu 20.04+ recommended)
- Public IP address (CRITICAL for global access)
- Firewall configured (ports 3000, 40000-49999)

## Quick Start

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# Get your public IP first
curl ifconfig.me

# Then set in .env
MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP_HERE
FRONTEND_URL=https://yourdomain.com
```

**⚠️ CRITICAL:** `MEDIASOUP_ANNOUNCED_IP` must be set to your server's public IP for global access!

### 3. Deploy

```bash
# Run deployment script
chmod +x deploy.sh
./deploy.sh

# Start with PM2
npm run pm2:start
```

### 4. Verify

```bash
# Check health
curl http://localhost:3000/health

# View logs
npm run pm2:logs
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `production` |
| `PORT` | HTTP server port | `3000` |
| `HTTPS_PORT` | HTTPS server port | `3443` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `MEDIASOUP_MIN_PORT` | Minimum RTC port | `40000` |
| `MEDIASOUP_MAX_PORT` | Maximum RTC port | `49999` |
| `MEDIASOUP_LISTEN_IP` | Listen IP | `0.0.0.0` |
| `MEDIASOUP_ANNOUNCED_IP` | **Public IP (REQUIRED)** | - |
| `MEDIASOUP_ANNOUNCED_DOMAIN` | Optional domain | - |
| `MEDIASOUP_NUM_WORKERS` | Number of workers | `4` |
| `SSL_CERT_PATH` | SSL certificate path (optional) | - |
| `SSL_KEY_PATH` | SSL key path (optional) | - |

### Firewall Configuration

**Ubuntu (UFW):**

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 3443/tcp
sudo ufw allow 40000:49999/tcp
sudo ufw allow 40000:49999/udp
sudo ufw enable
```

**AWS Security Group:**

- Inbound: `0.0.0.0/0` → TCP `3000`, `3443`
- Inbound: `0.0.0.0/0` → TCP+UDP `40000-49999`
- Outbound: All traffic

**DigitalOcean Firewall:**

- TCP: `3000`, `3443`, `40000-49999`
- UDP: `40000-49999`

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "uptime": 123456,
  "rooms": 5,
  "peers": 23,
  "workers": 4,
  "memory": {
    "used": "450MB",
    "total": "1GB"
  }
}
```

### Server Info

```bash
GET /api/server-info
```

Response:
```json
{
  "announcedIp": "1.2.3.4",
  "announcedDomain": null,
  "rtcPorts": {
    "min": 40000,
    "max": 49999
  }
}
```

## Socket.io Events

### Client → Server

| Event | Parameters | Response |
|-------|-----------|----------|
| `createRoom` | `{metadata}` | `{roomId, peerId}` |
| `joinRoom` | `{roomId, metadata}` | `{peerId, peers[]}` |
| `getRouterRtpCapabilities` | `{roomId}` | `{rtpCapabilities}` |
| `createWebRtcTransport` | `{roomId, direction}` | Transport data |
| `connectWebRtcTransport` | `{roomId, transportId, dtlsParameters}` | `{success}` |
| `produce` | `{roomId, transportId, kind, rtpParameters}` | `{producerId}` |
| `consume` | `{roomId, producerId, rtpCapabilities}` | Consumer data |
| `resumeConsumer` | `{roomId, consumerId}` | `{success}` |
| `pauseProducer` | `{roomId, producerId}` | `{success}` |
| `resumeProducer` | `{roomId, producerId}` | `{success}` |
| `closeProducer` | `{roomId, producerId}` | `{success}` |
| `getProducers` | `{roomId}` | `{producers[]}` |
| `leaveRoom` | `{roomId}` | - |
| `getRoomInfo` | `{roomId}` | `{peerCount, peers[]}` |
| `heartbeat` | - | - |

### Server → Client

| Event | Parameters |
|-------|-----------|
| `roomCreated` | `{roomId}` |
| `peerJoined` | `{peerId, metadata}` |
| `newProducer` | `{producerId, peerId, kind, metadata}` |
| `producerClosed` | `{producerId, peerId}` |
| `producerPaused` | `{producerId, peerId}` |
| `producerResumed` | `{producerId, peerId}` |
| `peerLeft` | `{peerId}` |
| `roomClosed` | `{reason}` |
| `error` | `{code, message}` |

## Deployment Options

### DigitalOcean (Singapore - Recommended for Vietnam)

1. Create Droplet (2 vCPU, 4GB RAM minimum)
2. Select Singapore datacenter
3. SSH into server
4. Install Node.js 18+
5. Clone repository
6. Run `./deploy.sh`
7. Configure firewall
8. Set `MEDIASOUP_ANNOUNCED_IP` to droplet's public IP
9. Start with PM2

### AWS (ap-southeast-1 - Singapore)

1. Launch EC2 instance (t3.medium or better)
2. Allocate Elastic IP
3. Configure security group (ports 3000, 40000-49999)
4. SSH into instance
5. Install Node.js 18+
6. Clone repository
7. Run `./deploy.sh`
8. Set `MEDIASOUP_ANNOUNCED_IP` to Elastic IP
9. Start with PM2

### Vultr (Singapore)

1. Create Cloud Compute instance
2. Reserve IP address
3. SSH into server
4. Install Node.js 18+
5. Clone repository
6. Run `./deploy.sh`
7. Configure firewall
8. Set `MEDIASOUP_ANNOUNCED_IP` to reserved IP
9. Start with PM2

### Local Vietnam VPS

Recommended providers:
- Bizfly Cloud
- BKNS (Viettel IDC)
- CMC Telecom

Follow same steps as DigitalOcean.

## PM2 Commands

```bash
# Start
npm run pm2:start

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart

# View logs
npm run pm2:logs

# Delete
npm run pm2:delete

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Troubleshooting

### Peers Cannot Connect

1. **Check `MEDIASOUP_ANNOUNCED_IP` is set correctly:**
   ```bash
   curl ifconfig.me
   # Set this IP in .env
   ```

2. **Verify firewall rules:**
   ```bash
   sudo ufw status
   # Should show ports 3000, 40000-49999 open
   ```

3. **Check cloud provider firewall:**
   - AWS: Security Groups
   - DigitalOcean: Firewall rules
   - Must allow UDP+TCP 40000-49999

4. **Test from different networks:**
   - Local WiFi
   - Mobile data (4G/5G)
   - Different ISPs

### High CPU Usage

- Reduce `MEDIASOUP_NUM_WORKERS` in `.env`
- Monitor with `pm2 monit`
- Check room count: `curl http://localhost:3000/health`

### Memory Leaks

- Rooms auto-cleanup after 30 minutes of inactivity
- Peers auto-removed after 60 seconds without heartbeat
- Check logs for errors: `npm run pm2:logs`

### NAT/Firewall Issues in Vietnam

Some ISPs in Vietnam have strict NAT. Solutions:

1. Use TURN server (optional, not included)
2. Ensure `MEDIASOUP_ANNOUNCED_IP` is correct
3. Test from multiple networks
4. Contact ISP if persistent issues

## Performance Optimization

### For Vietnam Deployment

1. **Enable BBR (Linux):**
   ```bash
   echo 'net.core.default_qdisc=fq' | sudo tee -a /etc/sysctl.conf
   echo 'net.ipv4.tcp_congestion_control=bbr' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

2. **TCP Keepalive:**
   ```bash
   echo 'net.ipv4.tcp_keepalive_time = 60' | sudo tee -a /etc/sysctl.conf
   echo 'net.ipv4.tcp_keepalive_probes = 3' | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

3. **Worker Count:**
   - 2 vCPU: 2 workers
   - 4 vCPU: 3-4 workers
   - 8+ vCPU: 4-6 workers

## Testing Checklist

- [ ] Server starts without errors
- [ ] Health check endpoint responds
- [ ] 2 peers can join from different networks
- [ ] 7 peers can join simultaneously
- [ ] Audio works clearly
- [ ] Video works smoothly (640x480 @ 30fps minimum)
- [ ] Peer leaving doesn't crash others
- [ ] Screen sharing works
- [ ] Works from Vietnam and internationally
- [ ] Reconnection works within 30s
- [ ] No memory leaks over 1 hour
- [ ] CPU usage under 70% with 7 peers
- [ ] Bandwidth usage reasonable (~1-2 Mbps per peer)

## Security Best Practices

1. **Use HTTPS:**
   - Set `SSL_CERT_PATH` and `SSL_KEY_PATH` in `.env`
   - Use Let's Encrypt for free certificates

2. **Firewall:**
   - Only open necessary ports
   - Use fail2ban for SSH protection

3. **Environment Variables:**
   - Never commit `.env` to git
   - Use strong values for production

4. **Monitoring:**
   - Set up PM2 monitoring
   - Use external monitoring (Datadog, New Relic, etc.)

## Support

For issues:
1. Check logs: `npm run pm2:logs`
2. Verify configuration: `curl http://localhost:3000/health`
3. Test from different networks
4. Check firewall rules

## License

ISC

