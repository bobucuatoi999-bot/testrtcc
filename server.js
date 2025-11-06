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

// Store chat messages per room
// Format: { roomId: [{ id, userName, message, timestamp, socketId }] }
const roomMessages = new Map();

// Store user message counts for rate limiting
// Format: { socketId: { count, resetTime } }
const userMessageCounts = new Map();

// Store room admins (first user who creates room)
// Format: { roomId: socketId }
const roomAdmins = new Map();

// Store admin user names for persistence (to restore admin on rejoin)
// Format: { roomId: userName }
const roomAdminNames = new Map();

// Store room passwords
// Format: { roomId: password }
const roomPasswords = new Map();

// Chat configuration
const MAX_MESSAGES_PER_ROOM = 100;        // Maximum messages per room (FIFO cleanup)
const MAX_MESSAGE_LENGTH = 500;           // Maximum characters per message
const MAX_MESSAGES_PER_MINUTE = 10;       // Rate limit per user
const RATE_LIMIT_WINDOW = 60000;          // 1 minute in milliseconds

// Maximum users per room
const MAX_USERS_PER_ROOM = 7;

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
      const { roomId, userName, password } = data || {};
      
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

      // Check if this is a new room (first user)
      const isNewRoom = !rooms.has(roomId) || rooms.get(roomId).size === 0;
      
      // If new room and password provided, set it
      if (isNewRoom && password && password.trim().length > 0) {
        roomPasswords.set(roomId, password.trim());
        console.log(`🔒 Password set for new room ${roomId} by ${userName || socket.id}`);
      }

      // Check if room has password
      const roomPassword = roomPasswords.get(roomId);
      if (roomPassword) {
        // Room has password, validate it
        if (!password || password !== roomPassword) {
          socket.emit('error', { 
            message: 'Incorrect password. Please enter the correct password to join.',
            code: 'WRONG_PASSWORD'
          });
          console.log(`❌ User ${socket.id} failed to join room ${roomId} - wrong password`);
          return;
        }
        console.log(`✅ User ${socket.id} provided correct password for room ${roomId}`);
      }

      // Check room capacity
      const currentRoomUsers = rooms.get(roomId);
      if (currentRoomUsers && currentRoomUsers.size >= MAX_USERS_PER_ROOM) {
        socket.emit('error', { 
          message: `Room is full. Maximum ${MAX_USERS_PER_ROOM} users allowed.` 
        });
        console.log(`❌ Room ${roomId} is full (${currentRoomUsers.size}/${MAX_USERS_PER_ROOM})`);
        return;
      }
      
      // Check if user is the original admin (by name) - restore admin if they rejoin
      let isAdmin = isNewRoom;
      if (!isNewRoom && userName) {
        const originalAdminName = roomAdminNames.get(roomId);
        if (originalAdminName === userName) {
          // Original admin rejoining - restore admin status
          isAdmin = true;
          roomAdmins.set(roomId, socket.id);
          console.log(`👑 Admin ${userName} rejoined room ${roomId} - admin status restored`);
        }
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
      
      // Set admin if this is a new room
      if (isAdmin) {
        roomAdmins.set(roomId, socket.id);
        if (userName) {
          roomAdminNames.set(roomId, userName);
        }
        console.log(`👑 User ${socket.id} (${userName || 'Unknown'}) is now admin of room ${roomId}`);
      }
      
      const roomUserCount = rooms.get(roomId).size;
      const adminSocketId = roomAdmins.get(roomId);

      console.log(`📥 User ${socket.id} joined room: ${roomId}${isAdmin ? ' (Admin)' : ''}`);
      
      // Notify the user they've successfully joined
      socket.emit('room-joined', { 
        roomId,
        socketId: socket.id,
        userCount: roomUserCount,
        maxUsers: MAX_USERS_PER_ROOM,
        isAdmin: isAdmin,
        hasPassword: !!roomPassword
      });

      // Get all users in the room (excluding the current user)
      const roomUsers = Array.from(rooms.get(roomId)).filter(id => id !== socket.id);
      
      // Notify about existing users in the room
      if (roomUsers.length > 0) {
        const usersWithNames = roomUsers.map(id => ({
          socketId: id,
          userName: userNames.get(id) || 'User',
          peerId: peerIds.get(id) || null,
          isAdmin: id === adminSocketId
        }));
        socket.emit('room-users', { users: usersWithNames });
        console.log(`👥 Room ${roomId} has ${roomUsers.length} other user(s) (${roomUserCount}/${MAX_USERS_PER_ROOM} total)`);
      }

      // Notify other users in the room about the new user
      socket.to(roomId).emit('user-joined', { 
        userId: socket.id,
        userName: userName || 'User',
        userCount: roomUserCount,
        maxUsers: MAX_USERS_PER_ROOM,
        isAdmin: isAdmin
      });

      // Send my PeerJS ID if I have one (send to all existing users)
      if (peerIds.has(socket.id)) {
        socket.to(roomId).emit('peer-id', {
          peerId: peerIds.get(socket.id),
          socketId: socket.id
        });
      }
      
      // Broadcast updated user count to all users in room
      io.to(roomId).emit('room-updated', {
        roomId: roomId,
        userCount: roomUserCount,
        maxUsers: MAX_USERS_PER_ROOM
      });

      // Send chat history to the new user
      if (roomMessages.has(roomId)) {
        const messages = roomMessages.get(roomId);
        if (messages && messages.length > 0) {
          socket.emit('chat-history', {
            roomId: roomId,
            messages: messages
          });
          console.log(`💬 Sent ${messages.length} chat message(s) to user ${socket.id} in room ${roomId}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ Error joining room: ${error.message}`);
      socket.emit('error', { message: 'Failed to join room', error: error.message });
    }
  });

  // ============================================
  // Handle Chat Messages
  // ============================================
  socket.on('chat-message', (data) => {
    try {
      const { roomId, message } = data || {};

      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      if (!message || typeof message !== 'string') {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      // Validate user is in the room
      if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) {
        socket.emit('error', { message: 'You are not in this room' });
        console.log(`❌ User ${socket.id} tried to send message to room ${roomId} but not in room`);
        return;
      }

      // Validate message length
      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
        socket.emit('error', { 
          message: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.` 
        });
        return;
      }

      // Rate limiting check
      const now = Date.now();
      const userRateLimit = userMessageCounts.get(socket.id);
      
      if (userRateLimit) {
        // Reset counter if window expired
        if (now - userRateLimit.resetTime > RATE_LIMIT_WINDOW) {
          userRateLimit.count = 0;
          userRateLimit.resetTime = now;
        }

        // Check if user exceeded rate limit
        if (userRateLimit.count >= MAX_MESSAGES_PER_MINUTE) {
          socket.emit('error', { 
            message: `Rate limit exceeded. Maximum ${MAX_MESSAGES_PER_MINUTE} messages per minute.` 
          });
          console.log(`⚠️  User ${socket.id} exceeded rate limit in room ${roomId}`);
          return;
        }

        // Increment counter
        userRateLimit.count++;
      } else {
        // Initialize rate limit tracking
        userMessageCounts.set(socket.id, {
          count: 1,
          resetTime: now
        });
      }

      // Sanitize message (prevent XSS) - optimized single-pass replacement
      const sanitizedMessage = trimmedMessage.replace(/[<>"'/]/g, (char) => {
        const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
        return map[char];
      });

      // Get user name
      const senderName = userNames.get(socket.id) || 'User';

      // Create message object
      const messageObj = {
        id: `${socket.id}-${now}-${Math.random().toString(36).substr(2, 9)}`,
        userName: senderName,
        message: sanitizedMessage,
        timestamp: now,
        socketId: socket.id
      };

      // Initialize room messages array if needed
      if (!roomMessages.has(roomId)) {
        roomMessages.set(roomId, []);
      }

      const roomMessagesArray = roomMessages.get(roomId);

      // Enforce message limit per room (FIFO - remove oldest if limit reached)
      if (roomMessagesArray.length >= MAX_MESSAGES_PER_ROOM) {
        roomMessagesArray.shift(); // Remove oldest message
      }

      // Add new message
      roomMessagesArray.push(messageObj);

      // Broadcast message to all users in the room (including sender for consistency)
      io.to(roomId).emit('chat-message', messageObj);

      // Only log in development to reduce I/O overhead in production
      if (process.env.NODE_ENV === 'development') {
        console.log(`💬 User ${socket.id} (${senderName}) sent message in room ${roomId}`);
      }

    } catch (error) {
      console.error(`❌ Error handling chat message: ${error.message}`);
      socket.emit('error', { message: 'Failed to send message', error: error.message });
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
          const remainingCount = rooms.get(roomId).size;
          socket.to(roomId).emit('user-left', { 
            userId: socket.id,
            userCount: remainingCount,
            maxUsers: MAX_USERS_PER_ROOM
          });
          
          // Broadcast updated user count
          io.to(roomId).emit('room-updated', {
            roomId: roomId,
            userCount: remainingCount,
            maxUsers: MAX_USERS_PER_ROOM
          });
          
          if (rooms.get(roomId).size === 0) {
            // Auto-delete all chat messages when room becomes empty
            if (roomMessages.has(roomId)) {
              roomMessages.delete(roomId);
              console.log(`🗑️  Chat messages deleted for empty room ${roomId}`);
            }
            // Clean up admin and password when room is empty
            if (roomAdmins.has(roomId)) {
              roomAdmins.delete(roomId);
              console.log(`🗑️  Admin cleared for empty room ${roomId}`);
            }
            if (roomAdminNames.has(roomId)) {
              roomAdminNames.delete(roomId);
              console.log(`🗑️  Admin name cleared for empty room ${roomId}`);
            }
            if (roomPasswords.has(roomId)) {
              roomPasswords.delete(roomId);
              console.log(`🗑️  Password cleared for empty room ${roomId}`);
            }
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
    
    // Clean up rate limiting data
    userMessageCounts.delete(socket.id);

    // Remove user from all rooms
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        const remainingCount = users.size;
        
        // Notify other users in the room
        socket.to(roomId).emit('user-left', { 
          userId: socket.id,
          userCount: remainingCount,
          maxUsers: MAX_USERS_PER_ROOM
        });
        
        // Broadcast updated user count
        io.to(roomId).emit('room-updated', {
          roomId: roomId,
          userCount: remainingCount,
          maxUsers: MAX_USERS_PER_ROOM
        });

        // Clean up empty rooms
        if (users.size === 0) {
          // Auto-delete all chat messages when room becomes empty
          if (roomMessages.has(roomId)) {
            roomMessages.delete(roomId);
            console.log(`🗑️  Chat messages deleted for empty room ${roomId}`);
          }
          // Clean up admin and password when room is empty
          if (roomAdmins.has(roomId)) {
            roomAdmins.delete(roomId);
            console.log(`🗑️  Admin cleared for empty room ${roomId}`);
          }
          if (roomAdminNames.has(roomId)) {
            roomAdminNames.delete(roomId);
            console.log(`🗑️  Admin name cleared for empty room ${roomId}`);
          }
          if (roomPasswords.has(roomId)) {
            roomPasswords.delete(roomId);
            console.log(`🗑️  Password cleared for empty room ${roomId}`);
          }
          rooms.delete(roomId);
          console.log(`🗑️  Room ${roomId} cleaned up (empty)`);
        }
      }
    });
  });

  // ============================================
  // Handle Room Password Management (Admin Only)
  // ============================================
  socket.on('set-room-password', (data) => {
    try {
      const { roomId, password } = data || {};
      
      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        socket.emit('error', { message: 'Password cannot be empty' });
        return;
      }

      // Check if user is admin of this room
      const adminSocketId = roomAdmins.get(roomId);
      if (adminSocketId !== socket.id) {
        socket.emit('error', { 
          message: 'Only the room admin can set the password.',
          code: 'NOT_ADMIN'
        });
        console.log(`❌ User ${socket.id} tried to set password for room ${roomId} but is not admin`);
        return;
      }

      // Validate user is in the room
      if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      // Set password
      roomPasswords.set(roomId, password.trim());
      console.log(`🔒 Admin ${socket.id} set password for room ${roomId}`);

      // Notify all users in the room
      io.to(roomId).emit('room-password-updated', {
        roomId: roomId,
        hasPassword: true
      });

      socket.emit('password-set-success', {
        roomId: roomId,
        message: 'Password set successfully'
      });

    } catch (error) {
      console.error(`❌ Error setting room password: ${error.message}`);
      socket.emit('error', { message: 'Failed to set password', error: error.message });
    }
  });

  socket.on('reset-room-password', (data) => {
    try {
      const { roomId } = data || {};
      
      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Check if user is admin of this room
      const adminSocketId = roomAdmins.get(roomId);
      if (adminSocketId !== socket.id) {
        socket.emit('error', { 
          message: 'Only the room admin can reset the password.',
          code: 'NOT_ADMIN'
        });
        console.log(`❌ User ${socket.id} tried to reset password for room ${roomId} but is not admin`);
        return;
      }

      // Validate user is in the room
      if (!rooms.has(roomId) || !rooms.get(roomId).has(socket.id)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      // Remove password
      roomPasswords.delete(roomId);
      console.log(`🔓 Admin ${socket.id} removed password for room ${roomId}`);

      // Notify all users in the room
      io.to(roomId).emit('room-password-updated', {
        roomId: roomId,
        hasPassword: false
      });

      socket.emit('password-reset-success', {
        roomId: roomId,
        message: 'Password removed successfully'
      });

    } catch (error) {
      console.error(`❌ Error resetting room password: ${error.message}`);
      socket.emit('error', { message: 'Failed to reset password', error: error.message });
    }
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
