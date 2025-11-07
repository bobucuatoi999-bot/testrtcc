const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { createToken, verifyToken } = require('./lib/jwt');
const { getTurnCredentials } = require('./routes/turn');
const roomsRouter = require('./routes/rooms');
const signalingRouter = require('./routes/signaling');
const { setupMetrics } = require('./lib/metrics');
const { setupRateLimiting } = require('./lib/rateLimit');
const logger = require('./lib/logger');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CORS_ALLOW_ORIGIN === '*' ? '*' : process.env.CORS_ALLOW_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  req.id = requestId;
  logger.info(`${req.method} ${req.path}`, { requestId, ip: req.ip });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint (optional)
if (process.env.MONITORING_ENABLED === 'true') {
  setupMetrics(app);
  app.get('/metrics', (req, res) => {
    const { register } = require('./lib/metrics');
    res.set('Content-Type', register.contentType);
    register.metrics().then(metrics => res.end(metrics));
  });
}

// API Routes
app.use('/api/rooms', roomsRouter);
app.get('/api/turn', getTurnCredentials);

// WebSocket server
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  verifyClient: (info, callback) => {
    // Extract token from query string
    const url = new URL(info.req.url, `http://${info.req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      callback(false, 401, 'Missing token');
      return;
    }
    
    try {
      const decoded = verifyToken(token);
      info.req.user = decoded;
      callback(true);
    } catch (error) {
      logger.warn('WebSocket auth failed', { error: error.message });
      callback(false, 401, 'Invalid token');
    }
  }
});

// Setup signaling
signalingRouter(wss);

// Error handling
app.use((err, req, res, next) => {
  logger.error('Express error', { error: err.message, stack: err.stack, requestId: req.id });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    requestId: req.id
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', requestId: req.id });
});

// Start server
const PORT = process.env.APPPORT || 3000;
const HOST = process.env.APPHOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`Server started on ${HOST}:${PORT}`, {
    port: PORT,
    host: HOST,
    env: process.env.NODE_ENV,
    maxParticipants: process.env.MAX_PARTICIPANTS || 4
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

