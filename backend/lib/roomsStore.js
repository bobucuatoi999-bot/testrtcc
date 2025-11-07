/**
 * In-memory room store
 * In production, consider using Redis or a database
 */
const logger = require('./logger');

const rooms = new Map(); // roomId -> Room
const ROOM_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Room structure
 * {
 *   id: string,
 *   name: string,
 *   password: string | null,
 *   maxParticipants: number,
 *   participants: Array<{ id, displayName, ws, joinedAt }>,
 *   createdAt: number,
 *   lastActivity: number
 * }
 */

/**
 * Create a new room
 */
function createRoom({ name, password, maxParticipants = 4 }) {
  const roomId = generateRoomId();
  const room = {
    id: roomId,
    name,
    password: password || null,
    maxParticipants,
    participants: [],
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  rooms.set(roomId, room);
  logger.info('Room created', { roomId, name, maxParticipants });

  // Cleanup old rooms periodically
  scheduleCleanup();

  return roomId;
}

/**
 * Get room by ID
 */
function getRoom(roomId) {
  return rooms.get(roomId);
}

/**
 * Join room (add participant)
 */
function addParticipant(roomId, participantId, displayName, ws) {
  const room = getRoom(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  if (room.participants.length >= room.maxParticipants) {
    throw new Error('Room is full');
  }

  // Check if participant already exists
  const existing = room.participants.find(p => p.id === participantId);
  if (existing) {
    existing.ws = ws; // Update WebSocket connection
    existing.lastActivity = Date.now();
    return;
  }

  room.participants.push({
    id: participantId,
    displayName,
    ws,
    joinedAt: Date.now(),
    lastActivity: Date.now()
  });

  room.lastActivity = Date.now();
  logger.info('Participant added', { roomId, participantId, displayName, total: room.participants.length });
}

/**
 * Leave room (remove participant)
 */
function removeParticipant(roomId, participantId) {
  const room = getRoom(roomId);
  if (!room) {
    return;
  }

  room.participants = room.participants.filter(p => p.id !== participantId);
  room.lastActivity = Date.now();

  logger.info('Participant removed', { roomId, participantId, remaining: room.participants.length });

  // Remove room if empty
  if (room.participants.length === 0) {
    setTimeout(() => {
      const checkRoom = getRoom(roomId);
      if (checkRoom && checkRoom.participants.length === 0) {
        rooms.delete(roomId);
        logger.info('Room removed (empty)', { roomId });
      }
    }, 60000); // Wait 1 minute before removing empty room
  }
}

/**
 * Check if room is full
 */
function isRoomFull(roomId) {
  const room = getRoom(roomId);
  if (!room) return true;
  return room.participants.length >= room.maxParticipants;
}

/**
 * Generate unique room ID
 */
function generateRoomId() {
  return Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
}

/**
 * Cleanup old rooms
 */
let cleanupScheduled = false;
function scheduleCleanup() {
  if (cleanupScheduled) return;
  cleanupScheduled = true;

  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      // Remove rooms older than TTL and empty
      if (now - room.lastActivity > ROOM_TTL && room.participants.length === 0) {
        rooms.delete(roomId);
        logger.info('Room cleaned up', { roomId, age: now - room.createdAt });
      }
    }
    cleanupScheduled = false;
  }, 60 * 60 * 1000); // Run every hour
}

module.exports = {
  createRoom,
  getRoom,
  addParticipant,
  removeParticipant,
  isRoomFull,
  getAllRooms: () => Array.from(rooms.values())
};

