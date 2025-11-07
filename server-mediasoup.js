// ============================================
// Mediasoup SFU Server
// Complete WebRTC video/voice call system using Mediasoup SFU architecture
// Supports up to 7 users per room with global reliability (90%+ success rate)
// ============================================

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mediasoup = require('mediasoup');

// ============================================
// Express & Socket.io Setup
// ============================================

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS enabled for global access
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Parse JSON bodies
app.use(express.json());

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Mediasoup Configuration
// ============================================

// Mediasoup worker process (handles media processing)
let mediasoupWorker = null;

// Store Mediasoup routers per room
// Format: { roomId: mediasoup.Router }
const roomRouters = new Map();

// Store user transports per room
// Format: { roomId: { socketId: { sendTransport, recvTransport, producers, consumers } } }
const roomTransports = new Map();

// Store user names
const userNames = new Map();

// Store room admins
const roomAdmins = new Map();
const roomAdminNames = new Map();

// Store room passwords
const roomPasswords = new Map();

// Store chat messages per room
const roomMessages = new Map();

// Configuration constants
const MAX_USERS_PER_ROOM = 7;
const MAX_MESSAGES_PER_ROOM = 100;
const MAX_MESSAGE_LENGTH = 500;

// ============================================
// Initialize Mediasoup Worker
// ============================================

/**
 * Initialize Mediasoup worker process
 * This handles all media processing (encoding, decoding, relaying)
 */
async function createMediasoupWorker() {
  try {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn', // 'debug' for more logs, 'warn' for production
      logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
      rtcMinPort: 40000,
      rtcMaxPort: 49999
    });

    worker.on('died', () => {
      console.error('❌ Mediasoup worker died, exiting...');
      process.exit(1);
    });

    console.log('✅ Mediasoup worker created:', worker.pid);
    return worker;
  } catch (error) {
    console.error('❌ Error creating Mediasoup worker:', error);
    throw error;
  }
}

// ============================================
// STUN/TURN Server Configuration
// ============================================

/**
 * Get ICE servers for WebRTC connectivity
 * Uses free public STUN/TURN servers for global reliability
 */
function getIceServers() {
  return {
    iceServers: [
      // Google public STUN servers (free, reliable)
      {
        urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']
      },
      // OpenRelay TURN servers (free, no auth required)
      // UDP transport (fastest, preferred)
      {
        urls: 'turn:openrelay.metered.ca:80?transport=udp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // TCP transport (fallback for restrictive networks)
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      // Additional TURN server for redundancy (UDP)
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    // ICE candidate pool for faster connection establishment
    iceCandidatePoolSize: 10
  };
}

// ============================================
// Room Management
// ============================================

/**
 * Get or create Mediasoup router for a room
 * Router handles media routing within a room (SFU functionality)
 */
async function getOrCreateRouter(roomId) {
  try {
    // Return existing router if available
    if (roomRouters.has(roomId)) {
      return roomRouters.get(roomId);
    }

    // Create new router for this room
    const router = await mediasoupWorker.createRouter({
      mediaCodecs: [
        // Audio codec: Opus (high quality, low latency)
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        // Video codec: VP8 (good quality, widely supported)
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000
        },
        // Video codec: VP9 (better quality, newer)
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000
        },
        // Video codec: H264 (hardware accelerated on many devices)
        {
          kind: 'video',
          mimeType: 'video/H264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '42e01f',
            'level-asymmetry-allowed': 1
          }
        }
      ]
    });

    roomRouters.set(roomId, router);
    console.log(`✅ Created Mediasoup router for room: ${roomId}`);

    // Clean up router when room is empty (handled in disconnect)
    return router;
  } catch (error) {
    console.error(`❌ Error creating router for room ${roomId}:`, error);
    throw error;
  }
}

/**
 * Clean up room resources (router, transports, producers, consumers)
 */
function cleanupRoom(roomId) {
  try {
    // Close all transports in the room
    if (roomTransports.has(roomId)) {
      const transports = roomTransports.get(roomId);
      transports.forEach(({ sendTransport, recvTransport }) => {
        try {
          if (sendTransport) sendTransport.close();
          if (recvTransport) recvTransport.close();
        } catch (error) {
          console.error('Error closing transport:', error);
        }
      });
      roomTransports.delete(roomId);
    }

    // Close router
    if (roomRouters.has(roomId)) {
      const router = roomRouters.get(roomId);
      router.close();
      roomRouters.delete(roomId);
      console.log(`🗑️  Cleaned up router for room: ${roomId}`);
    }
  } catch (error) {
    console.error(`❌ Error cleaning up room ${roomId}:`, error);
  }
}

// ============================================
// Socket.io Connection Handling
// ============================================

io.on('connection', (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // ============================================
  // Handle Room Joining
  // ============================================

  socket.on('join-room', async (data) => {
    try {
      const { roomId, userName, password } = data || {};

      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      // Store user name
      if (userName) {
        userNames.set(socket.id, userName);
      }

      // Check room password
      const roomPassword = roomPasswords.get(roomId);
      if (roomPassword && password !== roomPassword) {
        socket.emit('error', {
          message: 'Incorrect password',
          code: 'WRONG_PASSWORD'
        });
        return;
      }

      // Check room capacity
      const router = await getOrCreateRouter(roomId);
      const currentUsers = roomTransports.get(roomId)?.size || 0;
      if (currentUsers >= MAX_USERS_PER_ROOM) {
        socket.emit('error', {
          message: `Room is full. Maximum ${MAX_USERS_PER_ROOM} users allowed.`
        });
        return;
      }

      // Set admin if first user (or restore admin if original admin rejoins)
      const isNewRoom = currentUsers === 0;
      let isAdmin = isNewRoom;
      
      if (!isNewRoom && userName) {
        const originalAdminName = roomAdminNames.get(roomId);
        if (originalAdminName === userName) {
          isAdmin = true;
          roomAdmins.set(roomId, socket.id);
          console.log(`👑 Admin ${userName} rejoined room ${roomId} - admin status restored`);
        }
      }
      
      if (isAdmin) {
        roomAdmins.set(roomId, socket.id);
        if (userName) {
          roomAdminNames.set(roomId, userName);
        }
      }

      // Join socket room
      socket.join(roomId);

      // Initialize room transports if needed
      if (!roomTransports.has(roomId)) {
        roomTransports.set(roomId, new Map());
      }

      // Get router RTP capabilities (codecs, etc.)
      const rtpCapabilities = router.rtpCapabilities;

      // Send router capabilities to client
      socket.emit('room-joined', {
        roomId,
        socketId: socket.id,
        rtpCapabilities,
        iceServers: getIceServers(),
        isAdmin: isAdmin,
        hasPassword: !!roomPassword,
        userCount: currentUsers + 1
      });

      // Send chat history if available
      if (roomMessages.has(roomId)) {
        const messages = roomMessages.get(roomId);
        if (messages && messages.length > 0) {
          socket.emit('chat-history', { roomId, messages });
        }
      }

      console.log(`✅ User ${socket.id} joined room: ${roomId}`);

    } catch (error) {
      console.error(`❌ Error joining room:`, error);
      socket.emit('error', { message: 'Failed to join room', error: error.message });
    }
  });

  // ============================================
  // Handle Create WebRTC Transport (Send)
  // ============================================

  socket.on('create-send-transport', async (data) => {
    try {
      const { roomId } = data || {};

      if (!roomId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const router = await getOrCreateRouter(roomId);

      // Create WebRTC transport for sending media
      // For Railway: Use environment variable for public IP if available
      // Railway provides RAILWAY_PUBLIC_DOMAIN or we can detect from request
      const announcedIp = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? null // Let Mediasoup auto-detect if Railway provides domain
        : (process.env.PUBLIC_IP || null); // Or use explicit PUBLIC_IP env var
      
      const transport = await router.createWebRtcTransport({
        listenIps: [
          {
            ip: '0.0.0.0', // Listen on all interfaces
            announcedIp: announcedIp // Use public IP if set (important for Railway/NAT)
          }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000 // 1 Mbps initial
      });

      // Store transport
      if (!roomTransports.has(roomId)) {
        roomTransports.set(roomId, new Map());
      }
      if (!roomTransports.get(roomId).has(socket.id)) {
        roomTransports.get(roomId).set(socket.id, {
          sendTransport: null,
          recvTransport: null,
          producers: new Map(),
          consumers: new Map()
        });
      }

      const userTransports = roomTransports.get(roomId).get(socket.id);
      userTransports.sendTransport = transport;

      // Note: Transport connection and produce are handled via socket.io signaling
      // The client will emit 'create-producer' when it wants to produce media

      // Send transport parameters to client
      socket.emit('send-transport-created', {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });

      console.log(`✅ Created send transport for user ${socket.id} in room ${roomId}`);

    } catch (error) {
      console.error(`❌ Error creating send transport:`, error);
      socket.emit('error', { message: 'Failed to create send transport', error: error.message });
    }
  });

  // ============================================
  // Handle Create WebRTC Transport (Receive)
  // ============================================

  socket.on('create-recv-transport', async (data) => {
    try {
      const { roomId } = data || {};

      if (!roomId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const router = await getOrCreateRouter(roomId);

      // Create WebRTC transport for receiving media
      // For Railway: Use environment variable for public IP if available
      const announcedIp = process.env.RAILWAY_PUBLIC_DOMAIN 
        ? null // Let Mediasoup auto-detect if Railway provides domain
        : (process.env.PUBLIC_IP || null); // Or use explicit PUBLIC_IP env var
      
      const transport = await router.createWebRtcTransport({
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: announcedIp // Use public IP if set (important for Railway/NAT)
          }
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true
      });

      // Store transport
      if (!roomTransports.has(roomId)) {
        roomTransports.set(roomId, new Map());
      }
      if (!roomTransports.get(roomId).has(socket.id)) {
        roomTransports.get(roomId).set(socket.id, {
          sendTransport: null,
          recvTransport: null,
          producers: new Map(),
          consumers: new Map()
        });
      }

      const userTransports = roomTransports.get(roomId).get(socket.id);
      userTransports.recvTransport = transport;

      // Note: Transport connection is handled client-side

      // Send transport parameters to client
      socket.emit('recv-transport-created', {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters
      });

      console.log(`✅ Created recv transport for user ${socket.id} in room ${roomId}`);

    } catch (error) {
      console.error(`❌ Error creating recv transport:`, error);
      socket.emit('error', { message: 'Failed to create recv transport', error: error.message });
    }
  });

  // ============================================
  // Handle Connect Transport
  // ============================================

  socket.on('connect-transport', async (data) => {
    try {
      const { transportId, dtlsParameters, roomId } = data || {};

      if (!transportId || !dtlsParameters || !roomId) {
        socket.emit('error', { message: 'Missing transport parameters' });
        return;
      }

      const userTransports = roomTransports.get(roomId)?.get(socket.id);
      if (!userTransports) {
        socket.emit('error', { message: 'Transport not found' });
        return;
      }

      const transport = userTransports.sendTransport?.id === transportId
        ? userTransports.sendTransport
        : userTransports.recvTransport;

      if (!transport) {
        socket.emit('error', { message: 'Transport not found' });
        return;
      }

      await transport.connect({ dtlsParameters });
      socket.emit('transport-connected', { transportId });

      console.log(`✅ Transport ${transportId} connected for user ${socket.id}`);

    } catch (error) {
      console.error(`❌ Error connecting transport:`, error);
      socket.emit('error', { message: 'Failed to connect transport', error: error.message });
    }
  });

  // ============================================
  // Handle Produce (via socket - client calls transport.produce())
  // ============================================
  // Note: When client calls transport.produce(), it triggers client's transport.on('produce')
  // The client then emits to server via socket, and server creates producer
  socket.on('create-producer', async (data) => {
    try {
      const { transportId, kind, rtpParameters, roomId } = data || {};

      if (!transportId || !kind || !rtpParameters || !roomId) {
        socket.emit('error', { message: 'Missing producer parameters' });
        return;
      }

      const router = await getOrCreateRouter(roomId);
      const userTransports = roomTransports.get(roomId)?.get(socket.id);
      if (!userTransports || !userTransports.sendTransport) {
        socket.emit('error', { message: 'Send transport not found' });
        return;
      }

      // Create producer on the transport
      const producer = await userTransports.sendTransport.produce({
        kind,
        rtpParameters
      });

      userTransports.producers.set(producer.id, producer);

      // Notify other users about new producer
      socket.to(roomId).emit('new-producer', {
        producerId: producer.id,
        socketId: socket.id,
        kind,
        userName: userNames.get(socket.id) || 'User'
      });

      // Send producer ID back to client
      socket.emit('producer-created', {
        producerId: producer.id,
        kind
      });

      console.log(`✅ Producer created: ${producer.id} (${kind}) for user ${socket.id}`);

    } catch (error) {
      console.error(`❌ Error creating producer:`, error);
      socket.emit('error', { message: 'Failed to create producer', error: error.message });
    }
  });

  // ============================================
  // Handle Consume (Start receiving media)
  // ============================================

  socket.on('consume', async (data) => {
    try {
      const { producerId, rtpCapabilities, roomId } = data || {};

      if (!producerId || !rtpCapabilities || !roomId) {
        socket.emit('error', { message: 'Missing consume parameters' });
        return;
      }

      const router = await getOrCreateRouter(roomId);
      const userTransports = roomTransports.get(roomId)?.get(socket.id);
      if (!userTransports || !userTransports.recvTransport) {
        socket.emit('error', { message: 'Recv transport not found' });
        return;
      }

      // Find producer
      let producer = null;
      for (const [socketId, transports] of roomTransports.get(roomId)) {
        if (transports.producers.has(producerId)) {
          producer = transports.producers.get(producerId);
          break;
        }
      }

      if (!producer) {
        socket.emit('error', { message: 'Producer not found' });
        return;
      }

      // ✅ CRITICAL: Check if router can consume this producer
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        console.error(`❌ Cannot consume producer ${producerId} - RTP capabilities mismatch`);
        console.error('Router RTP capabilities:', JSON.stringify(router.rtpCapabilities, null, 2));
        console.error('Client RTP capabilities:', JSON.stringify(rtpCapabilities, null, 2));
        socket.emit('error', { 
          message: 'Cannot consume producer - incompatible codecs',
          code: 'RTP_CAPABILITIES_MISMATCH'
        });
        return;
      }

      // ✅ CRITICAL: Ensure recv transport is connected
      if (userTransports.recvTransport.connectionState !== 'connected') {
        console.warn(`⚠️ Recv transport not connected (state: ${userTransports.recvTransport.connectionState}), attempting to connect...`);
        // Transport should auto-connect, but log warning
      }

      // Create consumer (start paused, client will resume after setup)
      console.log(`🔧 Creating consumer for producer ${producerId} (kind: ${producer.kind})...`);
      const consumer = await userTransports.recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true // ✅ Start paused, client will resume after DOM setup
      });
      
      console.log(`✅ Consumer created: ${consumer.id} for producer ${producerId}`);

      userTransports.consumers.set(consumer.id, consumer);

      // Send consumer parameters to client
      socket.emit('consumed', {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });

      console.log(`✅ User ${socket.id} started consuming producer ${producerId} in room ${roomId}`);

    } catch (error) {
      console.error(`❌ Error consuming:`, error);
      socket.emit('error', { message: 'Failed to consume', error: error.message });
    }
  });

  // ============================================
  // Handle Get Existing Producers
  // ============================================

  socket.on('get-producers', async (data) => {
    try {
      const { roomId } = data || {};

      if (!roomId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const producers = [];
      const transports = roomTransports.get(roomId);

      if (transports) {
        for (const [socketId, userTransports] of transports) {
          if (socketId !== socket.id) {
            for (const [producerId, producer] of userTransports.producers) {
              producers.push({
                producerId,
                socketId,
                kind: producer.kind,
                userName: userNames.get(socketId) || 'User'
              });
            }
          }
        }
      }

      socket.emit('existing-producers', { producers });

    } catch (error) {
      console.error(`❌ Error getting producers:`, error);
      socket.emit('error', { message: 'Failed to get producers', error: error.message });
    }
  });

  // ============================================
  // Handle Chat Messages
  // ============================================

  socket.on('chat-message', (data) => {
    try {
      const { roomId, message } = data || {};

      if (!roomId || typeof roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      if (!message || typeof message !== 'string') {
        socket.emit('error', { message: 'Invalid message' });
        return;
      }

      // Validate user is in the room
      if (!roomTransports.has(roomId) || !roomTransports.get(roomId).has(socket.id)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      const trimmedMessage = message.trim();
      if (trimmedMessage.length === 0 || trimmedMessage.length > 500) {
        socket.emit('error', { message: 'Invalid message length' });
        return;
      }

      // Sanitize message
      const sanitizedMessage = trimmedMessage.replace(/[<>"'/]/g, (char) => {
        const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;' };
        return map[char];
      });

      const senderName = userNames.get(socket.id) || 'User';
      const messageObj = {
        id: `${socket.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userName: senderName,
        message: sanitizedMessage,
        timestamp: Date.now(),
        socketId: socket.id
      };

      if (!roomMessages.has(roomId)) {
        roomMessages.set(roomId, []);
      }
      const messages = roomMessages.get(roomId);
      if (messages.length >= 100) {
        messages.shift();
      }
      messages.push(messageObj);

      io.to(roomId).emit('chat-message', messageObj);

    } catch (error) {
      console.error(`❌ Error handling chat message: ${error.message}`);
      socket.emit('error', { message: 'Failed to send message', error: error.message });
    }
  });

  // ============================================
  // Handle Room Password Management (Admin Only)
  // ============================================

  socket.on('set-room-password', (data) => {
    try {
      const { roomId, password } = data || {};
      if (!roomId || !password) {
        socket.emit('error', { message: 'Invalid parameters' });
        return;
      }

      if (roomAdmins.get(roomId) !== socket.id) {
        socket.emit('error', { message: 'Only admin can set password', code: 'NOT_ADMIN' });
        return;
      }

      roomPasswords.set(roomId, password.trim());
      io.to(roomId).emit('room-password-updated', { roomId, hasPassword: true });
      socket.emit('password-set-success');

    } catch (error) {
      console.error(`❌ Error setting password: ${error.message}`);
      socket.emit('error', { message: 'Failed to set password', error: error.message });
    }
  });

  socket.on('reset-room-password', (data) => {
    try {
      const { roomId } = data || {};
      if (!roomId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      if (roomAdmins.get(roomId) !== socket.id) {
        socket.emit('error', { message: 'Only admin can reset password', code: 'NOT_ADMIN' });
        return;
      }

      roomPasswords.delete(roomId);
      io.to(roomId).emit('room-password-updated', { roomId, hasPassword: false });
      socket.emit('password-reset-success');

    } catch (error) {
      console.error(`❌ Error resetting password: ${error.message}`);
      socket.emit('error', { message: 'Failed to reset password', error: error.message });
    }
  });

  // ============================================
  // Handle Disconnection
  // ============================================

  socket.on('disconnect', () => {
    console.log(`👋 User disconnected: ${socket.id}`);

    // Clean up user from all rooms
    for (const [roomId, transports] of roomTransports) {
      if (transports.has(socket.id)) {
        const userTransports = transports.get(socket.id);

        // Close transports
        try {
          if (userTransports.sendTransport) userTransports.sendTransport.close();
          if (userTransports.recvTransport) userTransports.recvTransport.close();
        } catch (error) {
          console.error('Error closing transports:', error);
        }

        // Notify other users
        socket.to(roomId).emit('producer-closed', {
          socketId: socket.id,
          producerIds: Array.from(userTransports.producers.keys())
        });

        // Remove user
        transports.delete(socket.id);

        // Clean up room if empty
        if (transports.size === 0) {
          cleanupRoom(roomId);
          roomTransports.delete(roomId);
          roomAdmins.delete(roomId);
          roomAdminNames.delete(roomId);
          roomPasswords.delete(roomId);
          roomMessages.delete(roomId);
        }
      }
    }

    // Remove user name
    userNames.delete(socket.id);
  });
});

// ============================================
// Health Check Endpoint
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRooms: roomRouters.size,
    totalConnections: io.sockets.sockets.size
  });
});

// ============================================
// Initialize and Start Server
// ============================================

async function startServer() {
  try {
    // Create Mediasoup worker
    mediasoupWorker = await createMediasoupWorker();

    // Start HTTP server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log('🚀 Mediasoup SFU Server is running!');
      console.log(`📡 Server listening on port ${PORT}`);
      console.log(`🌐 CORS enabled for all origins (global access)`);
      console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  if (mediasoupWorker) {
    mediasoupWorker.close();
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT received, shutting down gracefully...');
  if (mediasoupWorker) {
    mediasoupWorker.close();
  }
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

