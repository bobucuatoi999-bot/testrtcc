const { v4: uuidv4 } = require('uuid');
const { routerCodecs } = require('./mediasoup/config');
const { getWorkerPool } = require('./mediasoup/worker');
const config = require('./config');

/**
 * Room Class
 * Manages a video call room with up to 7 peers
 */
class Room {
  constructor(roomId = null) {
    this.id = roomId || uuidv4();
    this.router = null;
    this.peers = new Map(); // peerId -> Peer
    this.producers = new Map(); // producerId -> {peerId, producer}
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.isClosing = false;
  }

  /**
   * Initialize room with mediasoup router
   */
  async initialize() {
    if (this.router) {
      throw new Error('Room already initialized');
    }

    const workerPool = getWorkerPool();
    const worker = workerPool.getNextWorker();
    
    this.router = await worker.createRouter({ mediaCodecs: routerCodecs });
    console.log(`✅ Room ${this.id} initialized with router ${this.router.id}`);
  }

  /**
   * Add a peer to the room
   */
  addPeer(peer) {
    if (this.isFull()) {
      throw new Error('ROOM_FULL');
    }

    if (this.peers.has(peer.id)) {
      throw new Error('Peer already in room');
    }

    this.peers.set(peer.id, peer);
    this.lastActivity = Date.now();
    console.log(`✅ Peer ${peer.id} added to room ${this.id} (${this.peers.size}/${config.ROOM.MAX_PEERS})`);
  }

  /**
   * Remove a peer from the room
   */
  async removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return;
    }

    // Remove all producers from this peer
    for (const [producerId, producerData] of this.producers) {
      if (producerData.peerId === peerId) {
        this.producers.delete(producerId);
      }
    }

    // Close peer resources
    await peer.close();

    // Remove peer
    this.peers.delete(peerId);
    this.lastActivity = Date.now();
    console.log(`✅ Peer ${peerId} removed from room ${this.id} (${this.peers.size}/${config.ROOM.MAX_PEERS})`);
  }

  /**
   * Broadcast event to all peers except one
   */
  broadcast(event, data, excludePeerId = null) {
    for (const [peerId, peer] of this.peers) {
      if (peerId !== excludePeerId && peer.socket) {
        peer.socket.emit(event, data);
      }
    }
  }

  /**
   * Get router RTP capabilities
   */
  getRouterRtpCapabilities() {
    if (!this.router) {
      throw new Error('Room not initialized');
    }
    return this.router.rtpCapabilities;
  }

  /**
   * Get router instance
   */
  getRouter() {
    if (!this.router) {
      throw new Error('Room not initialized');
    }
    return this.router;
  }

  /**
   * Get peer count
   */
  getPeerCount() {
    return this.peers.size;
  }

  /**
   * Check if room is full
   */
  isFull() {
    return this.peers.size >= config.ROOM.MAX_PEERS;
  }

  /**
   * Get active peers info
   */
  getActivePeers() {
    const peers = [];
    for (const [peerId, peer] of this.peers) {
      peers.push({
        id: peerId,
        metadata: peer.metadata,
        joinedAt: peer.joinedAt
      });
    }
    return peers;
  }

  /**
   * Add producer to room tracking
   */
  addProducer(producerId, peerId, producer) {
    this.producers.set(producerId, { peerId, producer });
    this.lastActivity = Date.now();
  }

  /**
   * Remove producer from room tracking
   */
  removeProducer(producerId) {
    this.producers.delete(producerId);
    this.lastActivity = Date.now();
  }

  /**
   * Get producer by ID
   * Returns the producer object if found
   */
  getProducer(producerId) {
    const producerData = this.producers.get(producerId);
    return producerData ? producerData.producer : null;
  }

  /**
   * Find producer by ID and return both producer and peer
   * This is the correct way to find a producer in mediasoup
   */
  findProducer(producerId) {
    // First check room's producer map
    const producerData = this.producers.get(producerId);
    if (producerData) {
      const peer = this.peers.get(producerData.peerId);
      if (peer) {
        // Verify producer still exists in peer's map
        const producer = peer.producers.get(producerId);
        if (producer) {
          return { producer, peer };
        }
      }
    }

    // If not found, search through all peers
    for (const [peerId, peer] of this.peers.entries()) {
      const producer = peer.producers.get(producerId);
      if (producer) {
        // Update room's producer map for consistency
        this.addProducer(producerId, peerId, producer);
        return { producer, peer };
      }
    }

    return null;
  }

  /**
   * Get all producers in room
   */
  getAllProducers() {
    const producers = [];
    for (const [producerId, producerData] of this.producers) {
      const peer = this.peers.get(producerData.peerId);
      producers.push({
        producerId,
        peerId: producerData.peerId,
        kind: producerData.producer.kind,
        metadata: peer ? peer.metadata : {}
      });
    }
    return producers;
  }

  /**
   * Check if room is inactive
   */
  isInactive() {
    const timeout = config.ROOM.INACTIVITY_TIMEOUT;
    return (Date.now() - this.lastActivity) > timeout;
  }

  /**
   * Close room and cleanup all resources
   */
  async close() {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;
    console.log(`🛑 Closing room ${this.id}`);

    // Close all peers
    const closePromises = [];
    for (const [peerId, peer] of this.peers) {
      closePromises.push(peer.close());
    }
    await Promise.all(closePromises);

    // Close router
    if (this.router) {
      this.router.close();
    }

    this.peers.clear();
    this.producers.clear();
    console.log(`✅ Room ${this.id} closed`);
  }
}

module.exports = Room;

