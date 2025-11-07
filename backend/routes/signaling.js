const { verifyToken } = require('../lib/jwt');
const { addParticipant, removeParticipant, getRoom, isRoomFull } = require('../lib/roomsStore');
const { setupRateLimiting } = require('../lib/rateLimit');
const logger = require('../lib/logger');

const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '4');

// Track WebSocket connections
const connections = new Map(); // ws -> { roomId, participantId, displayName }

/**
 * Setup WebSocket signaling
 */
function setupSignaling(wss) {
  // Rate limiter for WebSocket messages
  const rateLimiter = setupRateLimiting();

  wss.on('connection', (ws, req) => {
    const user = req.user; // Set by verifyClient
    const roomId = user.roomId;
    const participantId = `participant-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const displayName = user.displayName || 'Anonymous';

    logger.info('WebSocket connection', { roomId, participantId, displayName });

    // Check room capacity
    const room = getRoom(roomId);
    if (!room) {
      ws.close(1008, 'Room not found');
      return;
    }

    if (isRoomFull(roomId)) {
      ws.send(JSON.stringify({ type: 'full', message: 'Room is full' }));
      ws.close(1008, 'Room is full');
      return;
    }

    // Add participant to room
    addParticipant(roomId, participantId, displayName, ws);

    // Store connection
    connections.set(ws, { roomId, participantId, displayName });

    // Send join confirmation
    ws.send(JSON.stringify({
      type: 'joined',
      participantId,
      roomId,
      displayName
    }));

    // Broadcast new participant to others
    broadcastToRoom(roomId, {
      type: 'participant-joined',
      participantId,
      displayName
    }, ws);

    // Send list of existing participants
    const participants = room.participants.filter(p => p.id !== participantId);
    if (participants.length > 0) {
      ws.send(JSON.stringify({
        type: 'participants',
        participants: participants.map(p => ({
          id: p.id,
          displayName: p.displayName
        }))
      }));
    }

    // Handle messages
    ws.on('message', (message) => {
      try {
        // Rate limiting
        const clientId = req.socket.remoteAddress;
        if (!rateLimiter.allow(clientId)) {
          logger.warn('Rate limit exceeded', { clientId, participantId });
          ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
          return;
        }

        const data = JSON.parse(message.toString());

        // Handle different message types
        switch (data.type) {
          case 'offer':
          case 'answer':
          case 'candidate':
            // Relay to target participant
            relayToParticipant(data.target, {
              ...data,
              from: participantId,
              type: data.type
            });
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            logger.warn('Unknown message type', { type: data.type, participantId });
        }
      } catch (error) {
        logger.error('Error handling message', { error: error.message, participantId });
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      logger.info('WebSocket disconnected', { roomId, participantId });

      // Remove from room
      removeParticipant(roomId, participantId);

      // Remove connection
      connections.delete(ws);

      // Broadcast leave to others
      broadcastToRoom(roomId, {
        type: 'participant-left',
        participantId
      }, ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { error: error.message, participantId });
    });
  });
}

/**
 * Broadcast message to all participants in a room except sender
 */
function broadcastToRoom(roomId, message, excludeWs) {
  const room = getRoom(roomId);
  if (!room) return;

  room.participants.forEach(participant => {
    if (participant.ws && participant.ws !== excludeWs && participant.ws.readyState === 1) {
      try {
        participant.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error broadcasting message', { error: error.message, participantId: participant.id });
      }
    }
  });
}

/**
 * Relay message to specific participant
 */
function relayToParticipant(targetParticipantId, message) {
  const room = getRoom(message.roomId || findRoomByParticipant(targetParticipantId));
  if (!room) return;

  const participant = room.participants.find(p => p.id === targetParticipantId);
  if (participant && participant.ws && participant.ws.readyState === 1) {
    try {
      participant.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Error relaying message', { error: error.message, targetParticipantId });
    }
  }
}

/**
 * Find room ID by participant ID
 */
function findRoomByParticipant(participantId) {
  for (const [ws, conn] of connections.entries()) {
    if (conn.participantId === participantId) {
      return conn.roomId;
    }
  }
  return null;
}

module.exports = setupSignaling;

