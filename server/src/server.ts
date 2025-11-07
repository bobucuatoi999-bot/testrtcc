import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSocketHandlers } from './socket/handlers.js';
import { logger } from './utils/logger.js';

dotenv.config();

const app = express();
const server = createServer(app);

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
const isProduction = process.env.NODE_ENV === 'production';

// In development, explicitly allow localhost:5173
// In production, use CORS_ORIGIN env var (comma-separated list of allowed origins)
// If CORS_ORIGIN is '*', allow all origins (not recommended for production)
const allowedOrigins = corsOrigin === '*' 
  ? (isProduction ? ['*'] : ['http://localhost:5173', 'http://127.0.0.1:5173'])
  : corsOrigin.split(',').map(origin => origin.trim());

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['*'],
  },
  transports: ['websocket', 'polling'], // Allow both transports
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
});

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check endpoint for Railway
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Debug endpoint to list active rooms (development only)
app.get('/debug/rooms', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  try {
    const { getAllRooms } = await import('./utils/roomManager.js');
    const rooms = getAllRooms();
    
    res.json({
      totalRooms: rooms.length,
      rooms: rooms.map(room => ({
        id: room.id,
        userCount: room.users.size,
        hasPassword: !!room.passwordHash,
        createdAt: room.createdAt,
        users: Array.from(room.users.values()).map(u => ({
          id: u.id,
          displayName: u.displayName,
          isAdmin: u.isAdmin,
        })),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'WebRTC Signaling Server',
    version: '1.0.0',
    status: 'running'
  });
});

// Setup Socket.io handlers
setupSocketHandlers(io);

// Start server
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`Server running on ${HOST}:${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    cors: corsOrigin,
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

