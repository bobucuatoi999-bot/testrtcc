const crypto = require('crypto'); // Built-in Node.js module
const logger = require('../lib/logger');

/**
 * Generate TURN credentials using REST API authentication
 * Username: timestamp
 * Password: base64(hmac-sha1(timestamp, TURN_SECRET))
 */
function getTurnCredentials(req, res) {
  try {
    const secret = process.env.TURN_SECRET;
    const realm = process.env.TURN_REALM || 'webrtc';
    const turnHost = process.env.TURNHOST;
    const turnPort = parseInt(process.env.TURNPORT || '3478');

    if (!secret || secret === 'change-me') {
      logger.warn('TURN_SECRET not configured');
      return res.status(500).json({ error: 'TURN server not configured' });
    }

    if (!turnHost) {
      // STUN-only mode
      logger.info('TURN host not configured, returning STUN-only configuration');
      return res.json({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
    }

    // Generate timestamp (valid for 1 hour)
    const timestamp = Math.floor(Date.now() / 1000) + 3600;

    // Generate password using HMAC-SHA1
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(timestamp.toString());
    const password = hmac.digest('base64');

    // Build ICE servers configuration
    const iceServers = [
      // STUN servers
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Add TURN server
    const turnUrls = [];
    
    // UDP TURN
    if (turnPort === 3478) {
      turnUrls.push(`turn:${turnHost}:${turnPort}?transport=udp`);
      turnUrls.push(`turn:${turnHost}:${turnPort}?transport=tcp`);
    }
    
    // TURN over TLS (TCP)
    if (turnPort === 5349) {
      turnUrls.push(`turns:${turnHost}:${turnPort}?transport=tcp`);
    }

    if (turnUrls.length > 0) {
      iceServers.push({
        urls: turnUrls,
        username: timestamp.toString(),
        credential: password,
        credentialType: 'password'
      });
    }

    logger.info('TURN credentials generated', { turnHost, turnPort, timestamp });

    res.json({ iceServers });
  } catch (error) {
    logger.error('Error generating TURN credentials', { error: error.message });
    res.status(500).json({ error: 'Failed to generate TURN credentials' });
  }
}

module.exports = { getTurnCredentials };

