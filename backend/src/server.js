const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { getWorkerPool } = require('./mediasoup/worker');
const Room = require('./Room');
const Peer = require('./Peer');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebSocket connections
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.FRONTEND_URL,
  credentials: true
}));

// Body parsing
app.use(express.json());

// Serve static files from public directory (frontend)
// Check if public directory exists (could be in parent directory if backend is in subdirectory)
const publicPath = path.join(__dirname, '../../public');
const publicPathAlt = path.join(__dirname, '../public');

if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  console.log(`📁 Serving static files from: ${publicPath}`);
} else if (fs.existsSync(publicPathAlt)) {
  app.use(express.static(publicPathAlt));
  console.log(`📁 Serving static files from: ${publicPathAlt}`);
} else {
  console.warn('⚠️  Public directory not found. Frontend files may not be served.');
}

// Serve index.html for root route
app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  const indexPathAlt = path.join(publicPathAlt, 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else if (fs.existsSync(indexPathAlt)) {
    res.sendFile(indexPathAlt);
  } else {
    res.json({ message: 'Backend API is running. Frontend files not found.' });
  }
});

// Room management (must be defined before routes)
const roomsMap = new Map(); // roomId -> Room
const peersMap = new Map(); // socketId -> Peer

// Health check endpoint
app.get('/health', (req, res) => {
  const workerPool = getWorkerPool();
  const rooms = Array.from(roomsMap.values());
  const totalPeers = rooms.reduce((sum, room) => sum + room.getPeerCount(), 0);
  
  const memUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    rooms: rooms.length,
    peers: totalPeers,
    workers: workerPool.getWorkers().length,
    memory: {
      used: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    }
  });
});

// Server info endpoint
app.get('/api/server-info', (req, res) => {
  res.json({
    announcedIp: config.MEDIASOUP.ANNOUNCED_IP,
    announcedDomain: config.MEDIASOUP.ANNOUNCED_DOMAIN,
    rtcPorts: {
      min: config.MEDIASOUP.MIN_PORT,
      max: config.MEDIASOUP.MAX_PORT
    }
  });
});

// Create HTTP/HTTPS server
let server;
if (config.SSL.CERT_PATH && config.SSL.KEY_PATH && 
    fs.existsSync(config.SSL.CERT_PATH) && fs.existsSync(config.SSL.KEY_PATH)) {
  const options = {
    cert: fs.readFileSync(config.SSL.CERT_PATH),
    key: fs.readFileSync(config.SSL.KEY_PATH)
  };
  server = https.createServer(options, app);
  console.log(`🔒 HTTPS server configured on port ${config.HTTPS_PORT}`);
} else {
  server = http.createServer(app);
  console.log(`🌐 HTTP server configured on port ${config.PORT}`);
}

// Configure Socket.io
const io = socketIo(server, {
  cors: {
    origin: config.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 25000
});


// Initialize worker pool
let workerPool;

async function initialize() {
  try {
    // Initialize worker pool
    workerPool = getWorkerPool();
    await workerPool.initialize();

    // Start cleanup interval
    setInterval(cleanupInactiveRooms, config.ROOM.CLEANUP_INTERVAL);

    // Start heartbeat interval
    setInterval(checkPeerHeartbeats, config.PEER.HEARTBEAT_INTERVAL);

    console.log('✅ Server initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize server:', error);
    process.exit(1);
  }
}

// Cleanup inactive rooms
async function cleanupInactiveRooms() {
  const roomsToClose = [];
  for (const [roomId, room] of roomsMap) {
    if (room.isInactive() || room.getPeerCount() === 0) {
      roomsToClose.push(roomId);
    }
  }

  for (const roomId of roomsToClose) {
    const room = roomsMap.get(roomId);
    if (room) {
      await room.close();
      roomsMap.delete(roomId);
      console.log(`🧹 Cleaned up inactive room ${roomId}`);
    }
  }
}

// Check peer heartbeats
function checkPeerHeartbeats() {
  for (const [socketId, peer] of peersMap) {
    if (!peer.checkAlive()) {
      console.log(`💔 Peer ${peer.id} (socket ${socketId}) is dead, removing...`);
      handlePeerDisconnect(socketId);
    }
  }
}

// Get or create room
function getOrCreateRoom(roomId) {
  let room = roomsMap.get(roomId);
  if (!room) {
    room = new Room(roomId);
    roomsMap.set(roomId, room);
  }
  return room;
}

// Get room
function getRoom(roomId) {
  return roomsMap.get(roomId);
}

// Handle peer disconnect
async function handlePeerDisconnect(socketId) {
  const peer = peersMap.get(socketId);
  if (!peer) {
    return;
  }

  const room = getRoom(peer.roomId);
  if (room) {
    await room.removePeer(peer.id);
    
    // Notify other peers
    room.broadcast('peerLeft', { peerId: peer.id });

    // Close room if empty
    if (room.getPeerCount() === 0) {
      await room.close();
      roomsMap.delete(room.id);
    }
  }

  peersMap.delete(socketId);
}

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`🔌 New socket connection: ${socket.id}`);

  // Create room
  socket.on('createRoom', async (data, callback) => {
    try {
      const room = new Room();
      await room.initialize();
      roomsMap.set(room.id, room);

      const peer = new Peer(socket, room.id, data.metadata || {});
      room.addPeer(peer);
      peersMap.set(socket.id, peer);

      socket.join(room.id);
      socket.emit('roomCreated', { roomId: room.id });

      callback({ roomId: room.id, peerId: peer.id });
    } catch (error) {
      console.error('Error creating room:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'ROOM_CREATE_ERROR', message: error.message });
    }
  });

  // Join room
  socket.on('joinRoom', async (data, callback) => {
    try {
      const { roomId, metadata } = data;
      const room = getOrCreateRoom(roomId);

      if (!room.router) {
        await room.initialize();
      }

      if (room.isFull()) {
        throw new Error('ROOM_FULL');
      }

      const peer = new Peer(socket, room.id, metadata || {});
      room.addPeer(peer);
      peersMap.set(socket.id, peer);

      socket.join(room.id);

      // Get existing peers
      const peers = room.getActivePeers().filter(p => p.id !== peer.id);

      // Notify other peers
      room.broadcast('peerJoined', { peerId: peer.id, metadata: peer.metadata }, peer.id);

      callback({ peerId: peer.id, peers });
    } catch (error) {
      console.error('Error joining room:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'JOIN_ERROR', message: error.message });
    }
  });

  // Get router RTP capabilities
  socket.on('getRouterRtpCapabilities', (data, callback) => {
    try {
      const room = getRoom(data.roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const rtpCapabilities = room.getRouterRtpCapabilities();
      callback({ rtpCapabilities });
    } catch (error) {
      console.error('Error getting RTP capabilities:', error);
      callback({ error: error.message });
    }
  });

  // Create WebRTC transport
  socket.on('createWebRtcTransport', async (data, callback) => {
    try {
      const { roomId, direction } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      const room = getRoom(roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const router = room.getRouter();
      const transportData = await peer.createTransport(router, direction);
      callback(transportData);
    } catch (error) {
      console.error('Error creating transport:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'TRANSPORT_ERROR', message: error.message });
    }
  });

  // Connect WebRTC transport
  socket.on('connectWebRtcTransport', async (data, callback) => {
    try {
      const { roomId, transportId, dtlsParameters } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      await peer.connectTransport(transportId, dtlsParameters);
      callback({ success: true });
    } catch (error) {
      console.error('Error connecting transport:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'TRANSPORT_ERROR', message: error.message });
    }
  });

  // Produce
  socket.on('produce', async (data, callback) => {
    try {
      const { roomId, transportId, kind, rtpParameters, appData } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      const room = getRoom(roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const producer = await peer.produce(transportId, kind, rtpParameters, appData);
      room.addProducer(producer.id, peer.id, producer);

      // Notify other peers
      room.broadcast('newProducer', {
        producerId: producer.id,
        peerId: peer.id,
        kind: producer.kind,
        metadata: peer.metadata
      }, peer.id);

      callback({ producerId: producer.id });
    } catch (error) {
      console.error('Error producing:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'PRODUCER_ERROR', message: error.message });
    }
  });

  // Consume
  socket.on('consume', async (data, callback) => {
    try {
      const { roomId, producerId, rtpCapabilities } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      const room = getRoom(roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const router = room.getRouter();
      const consumer = await peer.consume(router, producerId, rtpCapabilities);

      callback({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (error) {
      console.error('Error consuming:', error);
      callback({ error: error.message });
      socket.emit('error', { code: 'CONSUMER_ERROR', message: error.message });
    }
  });

  // Resume consumer
  socket.on('resumeConsumer', async (data, callback) => {
    try {
      const { roomId, consumerId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      peer.resumeConsumer(consumerId);
      callback({ success: true });
    } catch (error) {
      console.error('Error resuming consumer:', error);
      callback({ error: error.message });
    }
  });

  // Pause producer
  socket.on('pauseProducer', async (data, callback) => {
    try {
      const { roomId, producerId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      peer.pauseProducer(producerId);
      
      const room = getRoom(roomId);
      if (room) {
        room.broadcast('producerPaused', { producerId, peerId: peer.id });
      }

      callback({ success: true });
    } catch (error) {
      console.error('Error pausing producer:', error);
      callback({ error: error.message });
    }
  });

  // Resume producer
  socket.on('resumeProducer', async (data, callback) => {
    try {
      const { roomId, producerId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      peer.resumeProducer(producerId);
      
      const room = getRoom(roomId);
      if (room) {
        room.broadcast('producerResumed', { producerId, peerId: peer.id });
      }

      callback({ success: true });
    } catch (error) {
      console.error('Error resuming producer:', error);
      callback({ error: error.message });
    }
  });

  // Close producer
  socket.on('closeProducer', async (data, callback) => {
    try {
      const { roomId, producerId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        throw new Error('PEER_NOT_FOUND');
      }

      peer.closeProducer(producerId);
      
      const room = getRoom(roomId);
      if (room) {
        room.removeProducer(producerId);
        room.broadcast('producerClosed', { producerId, peerId: peer.id });
      }

      callback({ success: true });
    } catch (error) {
      console.error('Error closing producer:', error);
      callback({ error: error.message });
    }
  });

  // Get producers
  socket.on('getProducers', (data, callback) => {
    try {
      const room = getRoom(data.roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const producers = room.getAllProducers();
      callback({ producers });
    } catch (error) {
      console.error('Error getting producers:', error);
      callback({ error: error.message });
    }
  });

  // Leave room
  socket.on('leaveRoom', async (data) => {
    await handlePeerDisconnect(socket.id);
  });

  // Get room info
  socket.on('getRoomInfo', (data, callback) => {
    try {
      const room = getRoom(data.roomId);
      if (!room) {
        throw new Error('ROOM_NOT_FOUND');
      }

      callback({
        peerCount: room.getPeerCount(),
        peers: room.getActivePeers()
      });
    } catch (error) {
      console.error('Error getting room info:', error);
      callback({ error: error.message });
    }
  });

  // Heartbeat
  socket.on('heartbeat', () => {
    const peer = peersMap.get(socket.id);
    if (peer) {
      peer.updateHeartbeat();
    }
  });

  // ============================================
  // COMPATIBILITY HANDLERS - Frontend uses old event names
  // ============================================

  // join-room (frontend expects room-joined event)
  socket.on('join-room', async (data) => {
    try {
      const { roomId, userName, password } = data || {};
      
      if (!roomId) {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      const room = getOrCreateRoom(roomId);
      if (!room.router) {
        await room.initialize();
      }

      if (room.isFull()) {
        socket.emit('error', { message: `Room is full. Maximum ${config.ROOM.MAX_PEERS} users allowed.` });
        return;
      }

      const peer = new Peer(socket, room.id, { name: userName || 'User' });
      room.addPeer(peer);
      peersMap.set(socket.id, peer);
      socket.join(room.id);

      // Get router RTP capabilities and ICE servers
      const rtpCapabilities = room.getRouterRtpCapabilities();
      const iceServers = { iceServers: [] }; // Add STUN/TURN if needed

      // Emit room-joined event (frontend expects this)
      socket.emit('room-joined', {
        roomId: room.id,
        isAdmin: room.getPeerCount() === 1,
        hasPassword: false,
        rtpCapabilities,
        iceServers
      });

      // Get existing producers and emit
      const producers = room.getAllProducers();
      if (producers.length > 0) {
        socket.emit('existing-producers', { producers });
      }
    } catch (error) {
      console.error('Error in join-room:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // create-send-transport (frontend expects send-transport-created event)
  socket.on('create-send-transport', async (data) => {
    try {
      const { roomId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        socket.emit('error', { message: 'Peer not found' });
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const router = room.getRouter();
      const transportData = await peer.createTransport(router, 'send');
      
      socket.emit('send-transport-created', transportData);
    } catch (error) {
      console.error('Error in create-send-transport:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // create-recv-transport (frontend expects recv-transport-created event)
  socket.on('create-recv-transport', async (data) => {
    try {
      const { roomId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        socket.emit('error', { message: 'Peer not found' });
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const router = room.getRouter();
      const transportData = await peer.createTransport(router, 'recv');
      
      socket.emit('recv-transport-created', transportData);
    } catch (error) {
      console.error('Error in create-recv-transport:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // connect-transport (frontend uses this name)
  socket.on('connect-transport', async (data, callback) => {
    try {
      const { transportId, dtlsParameters, roomId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        if (callback) callback({ error: 'Peer not found' });
        return;
      }

      await peer.connectTransport(transportId, dtlsParameters);
      if (callback) callback({ connected: true });
    } catch (error) {
      console.error('Error in connect-transport:', error);
      if (callback) callback({ error: error.message });
    }
  });

  // create-producer (frontend expects producer-created event)
  socket.on('create-producer', async (data) => {
    try {
      const { roomId, transportId, kind, rtpParameters } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        socket.emit('error', { message: 'Peer not found' });
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const producer = await peer.produce(transportId, kind, rtpParameters);
      room.addProducer(producer.id, peer.id, producer);

      socket.emit('producer-created', {
        producerId: producer.id,
        kind: producer.kind
      });

      // Notify other peers
      room.broadcast('new-producer', {
        producerId: producer.id,
        socketId: socket.id,
        kind: producer.kind,
        userName: peer.metadata.name || 'User'
      }, peer.id);
    } catch (error) {
      console.error('Error in create-producer:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // consume (frontend expects consumed event)
  socket.on('consume', async (data) => {
    try {
      const { roomId, producerId, rtpCapabilities } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        socket.emit('error', { message: 'Peer not found' });
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const router = room.getRouter();
      const consumer = await peer.consume(router, producerId, rtpCapabilities);

      socket.emit('consumed', {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (error) {
      console.error('Error in consume:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // get-producers (frontend expects existing-producers event)
  socket.on('get-producers', (data) => {
    try {
      const room = getRoom(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const producers = room.getAllProducers();
      socket.emit('existing-producers', { producers });
    } catch (error) {
      console.error('Error in get-producers:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // consumer-resume (frontend uses this name)
  socket.on('consumer-resume', async (data, callback) => {
    try {
      const { consumerId, roomId } = data;
      const peer = peersMap.get(socket.id);
      if (!peer) {
        if (callback) callback({ error: 'Peer not found' });
        return;
      }

      peer.resumeConsumer(consumerId);
      if (callback) callback({ success: true });
    } catch (error) {
      console.error('Error in consumer-resume:', error);
      if (callback) callback({ error: error.message });
    }
  });

  // Disconnect handler
  socket.on('disconnect', async () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    await handlePeerDisconnect(socket.id);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await shutdown();
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await shutdown();
});

async function shutdown() {
  // Close all rooms
  for (const [roomId, room] of roomsMap) {
    await room.close();
  }
  roomsMap.clear();

  // Close worker pool
  if (workerPool) {
    await workerPool.close();
  }

  // Close server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}

// Start server
async function start() {
  await initialize();
  
  const port = config.SSL.CERT_PATH ? config.HTTPS_PORT : config.PORT;
  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📡 Mediasoup RTC ports: ${config.MEDIASOUP.MIN_PORT}-${config.MEDIASOUP.MAX_PORT}`);
    if (config.MEDIASOUP.ANNOUNCED_IP) {
      console.log(`🌐 Announced IP: ${config.MEDIASOUP.ANNOUNCED_IP}`);
    }
  });
}

start().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

