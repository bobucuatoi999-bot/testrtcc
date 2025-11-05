// ============================================
// WebRTC Signaling Server
// Handles real-time communication for video/voice calls
// Uses Express and Socket.io for signaling
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();

// Create HTTP server (Socket.io needs this)
const server = http.createServer(app);

// Configure Socket.io with CORS enabled for global access
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for global access
    methods: ['GET', 'POST']
  }
});

// Serve static files from 'public' folder (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and their users
// Format: { roomId: Set of socketIds }
const rooms = new Map();

// Store user names mapped to socket IDs
// Format: { socketId: userName }
const userNames = new Map();

// Store PeerJS IDs mapped to socket IDs
// Format: { socketId: peerId }
const peerIds = new Map();

// ============================================
// Socket.io Connection Handling
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // ============================================
  // Handle User Joining a Room
  // ============================================
  socket.on('join-room', (data) => {
    try {
      const { roomId, userName } = data || {};
      
      // Validate roomId
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Store user name
      if (userName) {
        userNames.set(socket.id, userName);
        console.log(`👤 User ${socket.id} set name: ${userName}`);
      }

      // Leave any existing rooms
      if (socket.rooms) {
        Array.from(socket.rooms).forEach(room => {
          if (room !== socket.id) {
            socket.leave(room);
            if (rooms.has(room)) {
              rooms.get(room).delete(socket.id);
              if (rooms.get(room).size === 0) {
                rooms.delete(room);
              }
            }
          }
        });
      }

      // Join the new room
      socket.join(roomId);
      
      // Track user in room
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(socket.id);

      console.log(`📥 User ${socket.id} joined room: ${roomId}`);
      
      // Notify the user they've successfully joined
      socket.emit('room-joined', { 
        roomId,
        socketId: socket.id 
      });

      // Get all users in the room (excluding the current user)
      const roomUsers = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
      
      // Notify about existing users in the room
      if (roomUsers.length > 0) {
        const usersWithNames = roomUsers.map(id => ({
          socketId: id,
          userName: userNames.get(id) || 'User'
        }));
        socket.emit('room-users', { users: usersWithNames });
        console.log(`👥 Room ${roomId} has ${roomUsers.length} other user(s)`);
      }

      // Notify other users in the room about the new user
      socket.to(roomId).emit('user-joined', { 
        userId: socket.id,
        userName: userName || 'User'
      });

      // Send my PeerJS ID if I have one
      if (peerIds.has(socket.id)) {
        socket.to(roomId).emit('peer-id', {
          peerId: peerIds.get(socket.id),
          socketId: socket.id
        });
      }
      
    } catch (error) {
      console.error(`❌ Error joining room: ${error.message}`);
      socket.emit('error', { message: 'Failed to join room', error: error.message });
    }
  });

  // ============================================
  // Handle PeerJS ID Exchange
  // ============================================
  socket.on('peer-id', (data) => {
    try {
      const { roomId, peerId } = data || {};

      if (roomId && peerId) {
        // Store PeerJS ID
        peerIds.set(socket.id, peerId);
        console.log(`🔑 User ${socket.id} PeerJS ID: ${peerId}`);

        // Send to other users in the room
        socket.to(roomId).emit('peer-id', {
          peerId: peerId,
          socketId: socket.id
        });
      }
    } catch (error) {
      console.error(`❌ Error handling peer-id: ${error.message}`);
    }
  });

  // ============================================
  // Handle PeerJS Signaling (for WebRTC connection)
  // ============================================
  socket.on('peerjs-signal', (data) => {
    try {
      const { signal, targetUserId, roomId } = data;

      if (!signal || !targetUserId || !roomId) {
        socket.emit('error', { message: 'Missing required signal data' });
        return;
      }

      console.log(`🔗 PeerJS signal from ${socket.id} to ${targetUserId} in room ${roomId}`);

      // Relay signal to the target user
      socket.to(targetUserId).emit('peerjs-signal', {
        signal: signal,
        senderId: socket.id,
        roomId: roomId
      });

    } catch (error) {
      console.error(`❌ Error handling PeerJS signal: ${error.message}`);
      socket.emit('error', { message: 'Failed to send signal', error: error.message });
    }
  });

  // ============================================
  // Handle Call End
  // ============================================
  socket.on('end-call', (data) => {
    try {
      const { roomId } = data || {};

      if (roomId) {
        // Notify all users in the room
        socket.to(roomId).emit('call-ended', { 
          userId: socket.id,
          roomId: roomId 
        });
        console.log(`📴 User ${socket.id} ended call in room ${roomId}`);
      }

    } catch (error) {
      console.error(`❌ Error handling end-call: ${error.message}`);
      socket.emit('error', { message: 'Failed to end call', error: error.message });
    }
  });

  // ============================================
  // Handle User Leaving Room (without ending call)
  // ============================================
  socket.on('leave-room', (data) => {
    try {
      const { roomId } = data || {};

      if (roomId) {
        socket.leave(roomId);
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          socket.to(roomId).emit('user-left', { userId: socket.id });
          if (rooms.get(roomId).size === 0) {
            rooms.delete(roomId);
            console.log(`🗑️  Room ${roomId} cleaned up (empty)`);
          }
        }
        console.log(`👋 User ${socket.id} left room: ${roomId}`);
      }

    } catch (error) {
      console.error(`❌ Error handling leave-room: ${error.message}`);
      socket.emit('error', { message: 'Failed to leave room', error: error.message });
    }
  });

  // ============================================
  // Handle User Disconnection
  // ============================================
  socket.on('disconnect', (reason) => {
    console.log(`👋 User disconnected: ${socket.id} (reason: ${reason})`);

    // Remove user name and PeerJS ID
    userNames.delete(socket.id);
    peerIds.delete(socket.id);

    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        
        // Notify other users in the room
        socket.to(roomId).emit('user-left', { userId: socket.id });

        // Clean up empty rooms
        if (users.size === 0) {
          rooms.delete(roomId);
          console.log(`🗑️  Room ${roomId} cleaned up (empty)`);
        }
      }
    });
  });

  // ============================================
  // Handle Connection Errors
  // ============================================
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// ============================================
// Health Check Endpoint
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    totalConnections: io.sockets.sockets.size
  });
});

// ============================================
// Start Server
// ============================================
// Get port from environment variable (Railway uses PORT)
// Default to 3000 for local development
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 WebRTC Signaling Server is running!');
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌐 CORS enabled for all origins (global access)`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
});

// ============================================
// Graceful Shutdown Handling
// ============================================
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
