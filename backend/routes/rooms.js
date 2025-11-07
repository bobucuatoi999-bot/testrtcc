const express = require('express');
const router = express.Router();
const { createToken } = require('../lib/jwt');
const { createRoom, joinRoom, leaveRoom, getRoom } = require('../lib/roomsStore');
const logger = require('../lib/logger');

const MAX_PARTICIPANTS = parseInt(process.env.MAX_PARTICIPANTS || '4');

/**
 * POST /api/rooms
 * Create a new room
 */
router.post('/', (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomId = createRoom({
      name: name.trim(),
      password: password || null,
      maxParticipants: MAX_PARTICIPANTS
    });

    logger.info('Room created', { roomId, name, hasPassword: !!password, requestId: req.id });

    res.json({
      roomId,
      name,
      maxParticipants: MAX_PARTICIPANTS
    });
  } catch (error) {
    logger.error('Error creating room', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * POST /api/rooms/join
 * Join a room (validates password and capacity)
 */
router.post('/join', (req, res) => {
  try {
    const { roomId, password, displayName } = req.body;

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const room = getRoom(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check password
    if (room.password && room.password !== password) {
      logger.warn('Invalid password attempt', { roomId, requestId: req.id });
      return res.status(403).json({ error: 'Invalid password' });
    }

    // Check capacity
    if (room.participants.length >= room.maxParticipants) {
      logger.warn('Room full', { roomId, participants: room.participants.length, requestId: req.id });
      return res.status(403).json({ error: 'Room is full' });
    }

    // Generate JWT token for WebSocket authentication
    const token = createToken({
      roomId,
      displayName: displayName || 'Anonymous',
      joinedAt: Date.now()
    });

    logger.info('Room join successful', { roomId, displayName, requestId: req.id });

    res.json({
      token,
      roomId,
      name: room.name,
      maxParticipants: room.maxParticipants,
      currentParticipants: room.participants.length
    });
  } catch (error) {
    logger.error('Error joining room', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to join room' });
  }
});

/**
 * POST /api/rooms/leave
 * Leave a room (cleanup)
 */
router.post('/leave', (req, res) => {
  try {
    const { roomId, participantId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    leaveRoom(roomId, participantId);

    logger.info('Room leave', { roomId, participantId, requestId: req.id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error leaving room', { error: error.message, requestId: req.id });
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

module.exports = router;

