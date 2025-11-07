require('dotenv').config();

module.exports = {
  // Server Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT) || 3000,
  HTTPS_PORT: parseInt(process.env.HTTPS_PORT) || 3443,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Mediasoup Configuration
  MEDIASOUP: {
    MIN_PORT: parseInt(process.env.MEDIASOUP_MIN_PORT) || 40000,
    MAX_PORT: parseInt(process.env.MEDIASOUP_MAX_PORT) || 49999,
    LISTEN_IP: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
    ANNOUNCED_IP: process.env.MEDIASOUP_ANNOUNCED_IP || null,
    ANNOUNCED_DOMAIN: process.env.MEDIASOUP_ANNOUNCED_DOMAIN || null,
    NUM_WORKERS: parseInt(process.env.MEDIASOUP_NUM_WORKERS) || 4
  },

  // SSL Configuration
  SSL: {
    CERT_PATH: process.env.SSL_CERT_PATH || null,
    KEY_PATH: process.env.SSL_KEY_PATH || null
  },

  // Room Configuration
  ROOM: {
    MAX_PEERS: 7,
    INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
    CLEANUP_INTERVAL: 5 * 60 * 1000 // 5 minutes
  },

  // Peer Configuration
  PEER: {
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    HEARTBEAT_TIMEOUT: 60000 // 60 seconds
  }
};

