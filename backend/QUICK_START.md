# Quick Start Guide

## 1. Get Your Public IP

```bash
curl ifconfig.me
```

**Save this IP - you'll need it!**

## 2. Install Dependencies

```bash
cd backend
npm install
```

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP_FROM_STEP_1
FRONTEND_URL=http://localhost:3000  # or your frontend URL
```

## 4. Configure Firewall

**Ubuntu/Debian:**
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 40000:49999/tcp
sudo ufw allow 40000:49999/udp
sudo ufw enable
```

**Cloud Provider:**
- AWS: Configure Security Group
- DigitalOcean: Configure Firewall
- Allow TCP 3000 and TCP+UDP 40000-49999

## 5. Start Server

**Development:**
```bash
npm run dev
```

**Production (with PM2):**
```bash
npm install -g pm2
npm run pm2:start
pm2 save
pm2 startup
```

## 6. Verify

```bash
curl http://localhost:3000/health
```

Should return:
```json
{
  "status": "healthy",
  "uptime": 123,
  "rooms": 0,
  "peers": 0,
  "workers": 4,
  "memory": {...}
}
```

## Common Issues

### "Peers cannot connect"

1. Check `MEDIASOUP_ANNOUNCED_IP` is set correctly
2. Verify firewall rules (both server and cloud)
3. Test from different networks

### "High CPU usage"

Reduce `MEDIASOUP_NUM_WORKERS` in `.env`

## Next Steps

1. Integrate with your frontend
2. Test with 2+ peers
3. Monitor with `pm2 monit`
4. Check logs: `npm run pm2:logs`

For detailed documentation, see [README.md](./README.md)

