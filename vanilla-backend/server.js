// WebRTC Signaling Server - Vanilla JS Version
// Express + Socket.io for mesh WebRTC signaling

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);

// CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// In-memory storage
const rooms = new Map(); // roomId -> Room
const MAX_USERS = 4;

// Room structure: { id, passwordHash, adminId, users: Map<userId, User>, chatMessages: [] }
// User structure: { id, socketId, displayName, isAdmin, joinedAt }

// Generate random IDs
function generateId(length = 8) {
  return Math.random().toString(36).substring(2, length + 2);
}

// Create room
async function createRoom(adminId, password) {
  const roomId = generateId().toLowerCase();
  let passwordHash = null;
  
  if (password && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }
  
  const room = {
    id: roomId,
    passwordHash,
    adminId,
    users: new Map(),
    chatMessages: [],
    createdAt: Date.now(),
  };
  
  rooms.set(roomId, room);
  return roomId;
}

// Get room
function getRoom(roomId) {
  return rooms.get(roomId.toLowerCase());
}

// Verify password
async function verifyPassword(roomId, password) {
  const room = getRoom(roomId);
  if (!room) return false;
  if (!room.passwordHash) return true; // No password
  return await bcrypt.compare(password || '', room.passwordHash);
}

// Add user to room
function addUserToRoom(roomId, user) {
  const room = getRoom(roomId);
  if (!room) return false;
  if (room.users.size >= MAX_USERS) return false;
  
  room.users.set(user.id, user);
  return true;
}

// Remove user from room
function removeUserFromRoom(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return false;
  
  room.users.delete(userId);
  
  // Auto-delete room if empty
  if (room.users.size === 0) {
    rooms.delete(roomId);
    return true; // Room deleted
  }
  
  // Transfer admin if admin left
  if (room.adminId === userId && room.users.size > 0) {
    const newAdmin = Array.from(room.users.values())[0];
    newAdmin.isAdmin = true;
    room.adminId = newAdmin.id;
  }
  
  return false; // Room still exists
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'WebRTC Signaling Server',
    version: '1.0.0',
    status: 'running',
  });
});

// Debug endpoint (development only)
app.get('/debug/rooms', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    userCount: room.users.size,
    hasPassword: !!room.passwordHash,
    users: Array.from(room.users.values()).map(u => ({
      id: u.id,
      displayName: u.displayName,
      isAdmin: u.isAdmin,
    })),
  }));
  
  res.json({
    totalRooms: rooms.size,
    rooms: roomList,
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  // Track socket to user mapping
  const socketToUser = new Map();
  
  // Create room
  socket.on('create-room', async (data) => {
    try {
      const { displayName, password } = data;
      
      if (!displayName || !displayName.trim()) {
        socket.emit('error', { message: 'Display name is required' });
        return;
      }
      
      const userId = generateId(12);
      const roomId = await createRoom(userId, password);
      
      const user = {
        id: userId,
        socketId: socket.id,
        displayName: displayName.trim(),
        isAdmin: true,
        joinedAt: Date.now(),
      };
      
      if (!addUserToRoom(roomId, user)) {
        socket.emit('error', { message: 'Failed to create room' });
        return;
      }
      
      socket.join(roomId);
      socketToUser.set(socket.id, { roomId, userId });
      
      socket.emit('room-created', {
        roomId,
        userId,
        isAdmin: true,
        existingUsers: [], // Empty for new room
      });
      
      console.log('✅ Room created:', roomId, 'User:', displayName);
    } catch (error) {
      console.error('❌ Error creating room:', error);
      socket.emit('error', { message: error.message || 'Failed to create room' });
    }
  });
  
  // Join room
  socket.on('join-room', async (data) => {
    try {
      const { roomId, displayName, password } = data;
      const normalizedRoomId = roomId.trim().toLowerCase();
      
      if (!displayName || !displayName.trim()) {
        socket.emit('error', { message: 'Display name is required' });
        return;
      }
      
      const room = getRoom(normalizedRoomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.users.size >= MAX_USERS) {
        socket.emit('error', { message: 'Room is full (maximum 4 users)' });
        return;
      }
      
      // Verify password
      if (!(await verifyPassword(normalizedRoomId, password))) {
        socket.emit('error', { message: 'Invalid password' });
        return;
      }
      
      const userId = generateId(12);
      const user = {
        id: userId,
        socketId: socket.id,
        displayName: displayName.trim(),
        isAdmin: false,
        joinedAt: Date.now(),
      };
      
      if (!addUserToRoom(normalizedRoomId, user)) {
        socket.emit('error', { message: 'Failed to join room' });
        return;
      }
      
      socket.join(normalizedRoomId);
      socketToUser.set(socket.id, { roomId: normalizedRoomId, userId });
      
      // Get existing users (for new joiner to connect to)
      const existingUsers = Array.from(room.users.values())
        .filter(u => u.id !== userId)
        .map(u => ({
          id: u.id,
          displayName: u.displayName,
          isAdmin: u.isAdmin,
          socketId: u.socketId, // Include socketId for signaling
        }));
      
      // Notify new user
      socket.emit('room-joined', {
        roomId: normalizedRoomId,
        userId,
        existingUsers,
        chatHistory: room.chatMessages.slice(-50),
      });
      
      // Notify existing users about new joiner
      socket.to(normalizedRoomId).emit('user-joined', {
        user: {
          id: user.id,
          displayName: user.displayName,
          isAdmin: user.isAdmin,
          socketId: user.socketId,
        },
        message: {
          id: generateId(),
          userId: 'system',
          displayName: 'System',
          message: `${user.displayName} joined the room`,
          timestamp: Date.now(),
          type: 'system',
        },
      });
      
      console.log('✅ User joined room:', normalizedRoomId, 'User:', displayName);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('error', { message: error.message || 'Failed to join room' });
    }
  });
  
  // WebRTC signaling
  socket.on('signal', (data) => {
    try {
      const { to, type, from, roomId, data: signalData } = data;
      
      // Get sender's room
      const senderInfo = socketToUser.get(socket.id);
      const targetRoomId = roomId || senderInfo?.roomId;
      
      if (!targetRoomId) {
        console.warn('⚠️ Signal without roomId');
        return;
      }
      
      const room = getRoom(targetRoomId);
      if (!room) {
        console.warn('⚠️ Signal for non-existent room');
        return;
      }
      
      if (to) {
        // Send to specific peer
        const targetUser = room.users.get(to);
        if (!targetUser) {
          console.warn('⚠️ Target user not found:', to);
          return;
        }
        
        // Forward signal to target user's socket
        io.to(targetUser.socketId).emit('signal', {
          type,
          from,
          to,
          roomId: targetRoomId,
          data: signalData,
        });
        
        console.log('📤 Signal forwarded:', type, 'from', from, 'to', to);
      } else {
        // Broadcast to all in room (except sender)
        room.users.forEach(user => {
          if (user.id !== from && user.socketId !== socket.id) {
            io.to(user.socketId).emit('signal', {
              type,
              from,
              to: user.id,
              roomId: targetRoomId,
              data: signalData,
            });
          }
        });
      }
    } catch (error) {
      console.error('❌ Error handling signal:', error);
    }
  });
  
  // Chat message
  socket.on('chat-message', (data) => {
    try {
      const { roomId, userId, displayName, message } = data;
      const normalizedRoomId = roomId.toLowerCase().trim();
      
      if (!message || !message.trim()) {
        socket.emit('error', { message: 'Chat message cannot be empty' });
        return;
      }
      
      const room = getRoom(normalizedRoomId);
      if (!room) return;
      
      const chatMessage = {
        id: generateId(),
        userId,
        displayName,
        message: message.trim(),
        timestamp: Date.now(),
        type: 'user',
      };
      
      room.chatMessages.push(chatMessage);
      
      // Keep only last 100 messages
      if (room.chatMessages.length > 100) {
        room.chatMessages = room.chatMessages.slice(-100);
      }
      
      // Broadcast to all in room
      io.to(normalizedRoomId).emit('chat-message', chatMessage);
    } catch (error) {
      console.error('❌ Error sending chat:', error);
    }
  });
  
  // Leave room
  socket.on('leave-room', (data) => {
    try {
      const { roomId, userId } = data;
      const normalizedRoomId = roomId.toLowerCase().trim();
      
      const room = getRoom(normalizedRoomId);
      if (!room) return;
      
      const user = room.users.get(userId);
      if (!user) return;
      
      const leaveMessage = {
        id: generateId(),
        userId: 'system',
        displayName: 'System',
        message: `${user.displayName} left the room`,
        timestamp: Date.now(),
        type: 'system',
      };
      
      const roomDeleted = removeUserFromRoom(normalizedRoomId, userId);
      socket.leave(normalizedRoomId);
      socketToUser.delete(socket.id);
      
      // Notify others
      socket.to(normalizedRoomId).emit('user-left', {
        userId,
        message: leaveMessage,
      });
      
      if (roomDeleted) {
        socket.to(normalizedRoomId).emit('room-closed');
      }
      
      console.log('✅ User left room:', normalizedRoomId, 'User:', userId);
    } catch (error) {
      console.error('❌ Error leaving room:', error);
    }
  });
  
  // Disconnect handling
  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, reason);
    
    const userInfo = socketToUser.get(socket.id);
    if (userInfo) {
      const { roomId, userId } = userInfo;
      const room = getRoom(roomId);
      
      if (room) {
        const user = room.users.get(userId);
        if (user) {
          const leaveMessage = {
            id: generateId(),
            userId: 'system',
            displayName: 'System',
            message: `${user.displayName} left the room`,
            timestamp: Date.now(),
            type: 'system',
          };
          
          const roomDeleted = removeUserFromRoom(roomId, userId);
          
          socket.to(roomId).emit('user-left', {
            userId,
            message: leaveMessage,
          });
          
          if (roomDeleted) {
            socket.to(roomId).emit('room-closed');
          }
        }
      }
      
      socketToUser.delete(socket.id);
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
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

