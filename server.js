// ============================================
// WebRTC Signaling Server
// Handles real-time communication for video/voice calls
// ============================================

// Import required modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Initialize Express app
const app = express();

// Create HTTP server (Socket.io needs this)
const server = http.createServer(app);

// Configure Socket.io with CORS enabled for testing
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for testing
    methods: ['GET', 'POST']
  }
});

// Serve static files from 'public' folder (for frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Store active rooms and their users
// Format: { roomId: Set of socketIds }
const rooms = new Map();

// Store user names mapped to socket IDs
// Format: { socketId: userName }
const userNames = new Map();

// ============================================
// Socket.io Connection Handling
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // ============================================
  // Handle User Joining a Room
  // ============================================
  socket.on('join-room', (roomId) => {
    try {
      // Validate roomId
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Leave any existing rooms
      if (socket.rooms) {
        Array.from(socket.rooms).forEach(room => {
          if (room !== socket.id) {
            socket.leave(room);
            // Remove user from room tracking
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
      socket.emit('room-joined', { roomId });

      // Handle user name registration
      socket.on('user-name', (data) => {
        if (data.name && data.roomId === roomId) {
          userNames.set(socket.id, data.name);
          console.log(`👤 User ${socket.id} set name: ${data.name}`);
          // Broadcast name to other users in room
          socket.to(roomId).emit('user-name-updated', { userId: socket.id, name: data.name });
        }
      });

      // Get all users in the room (excluding the current user)
      const roomUsers = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
      
      // Notify about existing users in the room
      if (roomUsers.length > 0) {
        socket.emit('room-users', { users: roomUsers });
        console.log(`👥 Room ${roomId} has ${roomUsers.length} other user(s)`);
      }

      // Notify other users in the room about the new user
      socket.to(roomId).emit('user-joined', { userId: socket.id });
      
    } catch (error) {
      console.error(`❌ Error joining room: ${error.message}`);
      socket.emit('error', { message: 'Failed to join room', error: error.message });
    }
  });

  // ============================================
  // Handle WebRTC Offer (call initiation)
  // ============================================
  socket.on('offer', (data) => {
    try {
      const { offer, targetUserId, roomId } = data;

      if (!offer || !targetUserId || !roomId) {
        socket.emit('error', { message: 'Missing required offer data' });
        return;
      }

      console.log(`📤 Offer from ${socket.id} to ${targetUserId} in room ${roomId}`);

      // Relay offer to the target user
      socket.to(targetUserId).emit('offer', {
        offer: offer,
        senderId: socket.id,
        roomId: roomId
      });

    } catch (error) {
      console.error(`❌ Error handling offer: ${error.message}`);
      socket.emit('error', { message: 'Failed to send offer', error: error.message });
    }
  });

  // ============================================
  // Handle WebRTC Answer (call response)
  // ============================================
  socket.on('answer', (data) => {
    try {
      const { answer, targetUserId, roomId } = data;

      if (!answer || !targetUserId || !roomId) {
        socket.emit('error', { message: 'Missing required answer data' });
        return;
      }

      console.log(`📥 Answer from ${socket.id} to ${targetUserId} in room ${roomId}`);

      // Relay answer to the target user
      socket.to(targetUserId).emit('answer', {
        answer: answer,
        senderId: socket.id,
        roomId: roomId
      });

    } catch (error) {
      console.error(`❌ Error handling answer: ${error.message}`);
      socket.emit('error', { message: 'Failed to send answer', error: error.message });
    }
  });

  // ============================================
  // Handle ICE Candidates (network connectivity)
  // ============================================
  socket.on('ice-candidate', (data) => {
    try {
      const { candidate, targetUserId, roomId } = data;

      if (!candidate || !targetUserId || !roomId) {
        socket.emit('error', { message: 'Missing required ICE candidate data' });
        return;
      }

      // Relay ICE candidate to the target user
      socket.to(targetUserId).emit('ice-candidate', {
        candidate: candidate,
        senderId: socket.id,
        roomId: roomId
      });

    } catch (error) {
      console.error(`❌ Error handling ICE candidate: ${error.message}`);
      socket.emit('error', { message: 'Failed to send ICE candidate', error: error.message });
    }
  });

  // ============================================
  // Handle PeerJS Events (if using PeerJS library)
  // ============================================
  // PeerJS typically handles signaling differently, but we can support it
  socket.on('peerjs-signal', (data) => {
    try {
      const { signal, targetUserId, roomId } = data;

      if (!signal || !targetUserId || !roomId) {
        socket.emit('error', { message: 'Missing required PeerJS signal data' });
        return;
      }

      console.log(`🔗 PeerJS signal from ${socket.id} to ${targetUserId}`);

      // Relay PeerJS signal to the target user
      socket.to(targetUserId).emit('peerjs-signal', {
        signal: signal,
        senderId: socket.id,
        roomId: roomId
      });

    } catch (error) {
      console.error(`❌ Error handling PeerJS signal: ${error.message}`);
      socket.emit('error', { message: 'Failed to send PeerJS signal', error: error.message });
    }
  });

  // ============================================
  // Handle User Leaving Room (user quits, room stays active)
  // ============================================
  socket.on('leave-room', (data) => {
    try {
      const { roomId } = data || {};

      if (roomId) {
        // Leave the room
        socket.leave(roomId);
        
        // Remove user from room tracking
        if (rooms.has(roomId)) {
          rooms.get(roomId).delete(socket.id);
          
          // Notify other users in the room that this user left
          socket.to(roomId).emit('user-left', { userId: socket.id });
          
          // Clean up empty rooms
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
  // Handle Call End (kept for backward compatibility)
  // ============================================
  socket.on('end-call', (data) => {
    try {
      const { roomId, targetUserId } = data || {};

      if (targetUserId) {
        // Notify specific user about call end
        socket.to(targetUserId).emit('call-ended', { 
          userId: socket.id,
          roomId: roomId 
        });
      } else if (roomId) {
        // Notify all users in the room
        socket.to(roomId).emit('call-ended', { 
          userId: socket.id,
          roomId: roomId 
        });
      }

      console.log(`📴 User ${socket.id} ended call in room ${roomId || 'unknown'}`);

    } catch (error) {
      console.error(`❌ Error handling end-call: ${error.message}`);
      socket.emit('error', { message: 'Failed to end call', error: error.message });
    }
  });

  // ============================================
  // Handle User Disconnection
  // ============================================
  socket.on('disconnect', (reason) => {
    console.log(`👋 User disconnected: ${socket.id} (reason: ${reason})`);

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
// Get port from environment variable or default to 3000
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('🚀 WebRTC Signaling Server is running!');
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌐 CORS enabled for all origins (testing mode)`);
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

