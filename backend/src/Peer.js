const { v4: uuidv4 } = require('uuid');

/**
 * Peer Class
 * Represents a connected peer in a room
 */
class Peer {
  constructor(socket, roomId, metadata = {}) {
    this.id = uuidv4();
    this.socket = socket;
    this.roomId = roomId;
    this.transports = new Map(); // transportId -> Transport
    this.producers = new Map(); // producerId -> Producer
    this.consumers = new Map(); // consumerId -> Consumer
    this.metadata = metadata; // {name, avatar, etc.}
    this.joinedAt = Date.now();
    this.lastHeartbeat = Date.now();
    this.isAlive = true;
    this.disconnecting = false;
    this.disconnectTimeout = null;
  }

  /**
   * Create a transport (send or recv)
   */
  async createTransport(router, direction) {
    if (!router) {
      throw new Error('Router not provided');
    }

    const { webRtcTransportConfig } = require('./mediasoup/config');
    
    const transport = await router.createWebRtcTransport(webRtcTransportConfig);
    this.transports.set(transport.id, { transport, direction });
    
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    };
  }

  /**
   * Connect a transport
   */
  async connectTransport(transportId, dtlsParameters) {
    const transportData = this.transports.get(transportId);
    if (!transportData) {
      throw new Error(`Transport ${transportId} not found`);
    }

    await transportData.transport.connect({ dtlsParameters });
  }

  /**
   * Create a producer
   */
  async produce(transportId, kind, rtpParameters, appData = {}) {
    const transportData = this.transports.get(transportId);
    if (!transportData) {
      throw new Error(`Transport ${transportId} not found`);
    }

    if (transportData.direction !== 'send') {
      throw new Error(`Transport ${transportId} is not a send transport`);
    }

    const producer = await transportData.transport.produce({
      kind,
      rtpParameters,
      appData
    });

    this.producers.set(producer.id, producer);
    return producer;
  }

  /**
   * Create a consumer
   */
  async consume(router, producerId, rtpCapabilities) {
    const producer = router.getProducerById(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    // Check if router can consume this producer
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume producer - unsupported codec');
    }

    // Find recv transport
    let recvTransport = null;
    for (const [transportId, transportData] of this.transports) {
      if (transportData.direction === 'recv') {
        recvTransport = transportData.transport;
        break;
      }
    }

    if (!recvTransport) {
      throw new Error('No recv transport found');
    }

    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true // Start paused, resume after setup
    });

    this.consumers.set(consumer.id, consumer);
    return consumer;
  }

  /**
   * Close a producer
   */
  closeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
    }
  }

  /**
   * Pause a producer
   */
  pauseProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.pause();
    }
  }

  /**
   * Resume a producer
   */
  resumeProducer(producerId) {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.resume();
    }
  }

  /**
   * Resume a consumer
   */
  resumeConsumer(consumerId) {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.resume();
    }
  }

  /**
   * Get peer stats
   */
  async getStats() {
    const stats = {
      id: this.id,
      roomId: this.roomId,
      metadata: this.metadata,
      transports: this.transports.size,
      producers: this.producers.size,
      consumers: this.consumers.size,
      joinedAt: this.joinedAt,
      uptime: Date.now() - this.joinedAt
    };

    // Get transport stats
    const transportStats = [];
    for (const [transportId, transportData] of this.transports) {
      try {
        const stats = await transportData.transport.getStats();
        transportStats.push({ transportId, stats });
      } catch (error) {
        console.error(`Error getting stats for transport ${transportId}:`, error);
      }
    }
    stats.transportStats = transportStats;

    return stats;
  }

  /**
   * Update heartbeat
   */
  updateHeartbeat() {
    this.lastHeartbeat = Date.now();
    this.isAlive = true;
  }

  /**
   * Check if peer is alive
   */
  checkAlive() {
    const timeout = require('./config').PEER.HEARTBEAT_TIMEOUT;
    const isAlive = (Date.now() - this.lastHeartbeat) < timeout;
    this.isAlive = isAlive;
    return isAlive;
  }

  /**
   * Close peer and cleanup all resources
   */
  async close() {
    console.log(`🔌 Closing peer ${this.id}`);

    // Close all consumers
    for (const [consumerId, consumer] of this.consumers) {
      try {
        consumer.close();
      } catch (error) {
        console.error(`Error closing consumer ${consumerId}:`, error);
      }
    }
    this.consumers.clear();

    // Close all producers
    for (const [producerId, producer] of this.producers) {
      try {
        producer.close();
      } catch (error) {
        console.error(`Error closing producer ${producerId}:`, error);
      }
    }
    this.producers.clear();

    // Close all transports
    for (const [transportId, transportData] of this.transports) {
      try {
        transportData.transport.close();
      } catch (error) {
        console.error(`Error closing transport ${transportId}:`, error);
      }
    }
    this.transports.clear();

    console.log(`✅ Peer ${this.id} closed`);
  }
}

module.exports = Peer;

