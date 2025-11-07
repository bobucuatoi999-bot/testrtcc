// Ultra Simple Signaling Server for PeerJS
// npm install express socket.io cors

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Store rooms: roomId -> Map(userId -> userInfo)
const rooms = new Map();
const MAX_USERS = 4;

// Helper to generate IDs
function generateId(length = 8) {
  return Math.random().toString(36).substring(2, length + 2);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'PeerJS Signaling Server',
    version: '1.0.0',
    status: 'running',
  });
});

// Debug endpoint
app.get('/debug/rooms', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  const roomList = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    userCount: room.size,
    users: Array.from(room.values()).map(u => ({
      userId: u.userId,
      peerId: u.peerId,
      displayName: u.displayName,
    })),
  }));
  
  res.json({
    totalRooms: rooms.size,
    rooms: roomList,
  });
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Create or join room
  socket.on('create-room', ({ displayName, password }, callback) => {
    try {
      const userId = generateId(12);
      const peerId = generateId(12); // PeerJS peer ID
      const roomId = generateId(8).toLowerCase();

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId);
      
      if (room.size >= MAX_USERS) {
        callback({ error: 'Room is full (max 4 users)' });
        return;
      }

      room.set(userId, {
        userId,
        peerId,
        socketId: socket.id,
        displayName: displayName.trim(),
        isAdmin: true,
        joinedAt: Date.now(),
      });

      socket.userId = userId;
      socket.peerId = peerId;
      socket.roomId = roomId;
      socket.join(roomId);

      const users = Array.from(room.values())
        .filter(u => u.userId !== userId)
        .map(u => ({
          userId: u.userId,
          peerId: u.peerId,
          displayName: u.displayName,
        }));

      callback({
        success: true,
        roomId,
        userId,
        peerId,
        users,
      });

      console.log(`✅ ${displayName} created room ${roomId} (${room.size}/4 users)`);
    } catch (error) {
      console.error('❌ Error creating room:', error);
      callback({ error: error.message });
    }
  });

  // Join existing room
  socket.on('join-room', ({ roomId, displayName, password }, callback) => {
    try {
      const normalizedRoomId = roomId.trim().toLowerCase();

      if (!rooms.has(normalizedRoomId)) {
        callback({ error: 'Room not found' });
        return;
      }

      const room = rooms.get(normalizedRoomId);
      
      if (room.size >= MAX_USERS) {
        callback({ error: 'Room is full (max 4 users)' });
        return;
      }

      const userId = generateId(12);
      const peerId = generateId(12); // PeerJS peer ID

      room.set(userId, {
        userId,
        peerId,
        socketId: socket.id,
        displayName: displayName.trim(),
        isAdmin: false,
        joinedAt: Date.now(),
      });

      socket.userId = userId;
      socket.peerId = peerId;
      socket.roomId = normalizedRoomId;
      socket.join(normalizedRoomId);

      // Get existing users
      const existingUsers = Array.from(room.values())
        .filter(u => u.userId !== userId)
        .map(u => ({
          userId: u.userId,
          peerId: u.peerId,
          displayName: u.displayName,
        }));

      callback({
        success: true,
        roomId: normalizedRoomId,
        userId,
        peerId,
        users: existingUsers,
      });

      // Notify existing users about new joiner
      socket.to(normalizedRoomId).emit('user-joined', {
        userId,
        peerId,
        displayName: displayName.trim(),
      });

      console.log(`✅ ${displayName} joined room ${normalizedRoomId} (${room.size}/4 users)`);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      callback({ error: error.message });
    }
  });

  // Chat message
  socket.on('chat-message', ({ roomId, userId, displayName, message }) => {
    try {
      const normalizedRoomId = roomId.toLowerCase();
      const room = rooms.get(normalizedRoomId);
      if (!room) return;

      io.to(normalizedRoomId).emit('chat-message', {
        userId,
        displayName,
        message: message.trim(),
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Error sending chat:', error);
    }
  });

  // Leave room
  socket.on('leave-room', () => {
    if (!socket.roomId) return;
    
    const room = rooms.get(socket.roomId);
    if (room) {
      room.delete(socket.userId);
      
      socket.to(socket.roomId).emit('user-left', {
        userId: socket.userId,
      });
      
      if (room.size === 0) {
        rooms.delete(socket.roomId);
        console.log(`🗑️ Deleted empty room ${socket.roomId}`);
      }
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
    
    if (!socket.roomId) return;
    
    const room = rooms.get(socket.roomId);
    if (room) {
      room.delete(socket.userId);
      
      socket.to(socket.roomId).emit('user-left', {
        userId: socket.userId,
      });
      
      if (room.size === 0) {
        rooms.delete(socket.roomId);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 PeerJS Signaling Server running on ${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

