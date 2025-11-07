# Deployment Checklist

Use this checklist to ensure proper deployment of the mediasoup backend.

## Pre-Deployment

- [ ] Server has public IP address
- [ ] Node.js 18+ installed
- [ ] Firewall configured (ports 3000, 40000-49999)
- [ ] Domain name configured (optional but recommended)

## Configuration

- [ ] `.env` file created from `.env.example`
- [ ] `MEDIASOUP_ANNOUNCED_IP` set to public IP (CRITICAL!)
- [ ] `FRONTEND_URL` set to frontend domain
- [ ] `NODE_ENV` set to `production`
- [ ] Worker count configured appropriately

## Network Setup

- [ ] Firewall rules configured:
  - [ ] TCP 3000 (HTTP)
  - [ ] TCP 3443 (HTTPS, if using)
  - [ ] TCP 40000-49999 (RTC)
  - [ ] UDP 40000-49999 (RTC)
- [ ] Cloud provider firewall configured (if applicable)
- [ ] NAT traversal verified

## Installation

- [ ] Dependencies installed (`npm install`)
- [ ] PM2 installed globally
- [ ] Logs directory created
- [ ] Deployment script executed

## Testing

- [ ] Server starts without errors
- [ ] Health check responds: `curl http://localhost:3000/health`
- [ ] Tested from local network
- [ ] Tested from external network (mobile data)
- [ ] Tested from Vietnam (if applicable)
- [ ] Tested internationally (if needed)
- [ ] 2 peers can connect successfully
- [ ] 7 peers can connect simultaneously
- [ ] Audio works clearly
- [ ] Video works smoothly
- [ ] Screen sharing works
- [ ] Peer leaving works correctly
- [ ] Reconnection works

## Production

- [ ] PM2 started: `npm run pm2:start`
- [ ] PM2 saved: `pm2 save`
- [ ] PM2 startup configured: `pm2 startup`
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Monitoring set up
- [ ] Backup strategy implemented
- [ ] Log rotation configured

## Post-Deployment

- [ ] Monitor logs for errors: `npm run pm2:logs`
- [ ] Monitor resource usage: `pm2 monit`
- [ ] Test from multiple locations
- [ ] Document any custom configurations
- [ ] Set up alerts for critical issues

## Common Issues

### Issue: Peers cannot connect

**Solution:**
1. Verify `MEDIASOUP_ANNOUNCED_IP` is set correctly
2. Check firewall rules (both server and cloud provider)
3. Test from different networks
4. Verify ports 40000-49999 are open (UDP and TCP)

### Issue: High CPU usage

**Solution:**
1. Reduce `MEDIASOUP_NUM_WORKERS`
2. Monitor with `pm2 monit`
3. Check for memory leaks
4. Optimize worker count based on CPU cores

### Issue: Memory leaks

**Solution:**
1. Check logs for errors
2. Verify cleanup intervals are working
3. Monitor room count
4. Restart server if needed

### Issue: NAT/Firewall issues in Vietnam

**Solution:**
1. Ensure `MEDIASOUP_ANNOUNCED_IP` is correct
2. Test from multiple ISPs
3. Consider TURN server (optional)
4. Contact ISP if persistent

## Verification Commands

```bash
# Check server status
curl http://localhost:3000/health

# Check PM2 status
pm2 status

# View logs
npm run pm2:logs

# Monitor resources
pm2 monit

# Get public IP
curl ifconfig.me
```

## Next Steps

After successful deployment:

1. Integrate with frontend
2. Set up monitoring/alerting
3. Configure backups
4. Document custom configurations
5. Train team on maintenance

