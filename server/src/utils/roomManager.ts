import bcrypt from 'bcrypt';
import type { Room, User, ChatMessage } from '../types.js';

const rooms = new Map<string, Room>();
const SALT_ROUNDS = 10;

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function generateUserId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function createRoom(adminId: string, password?: string): Promise<string> {
  const roomId = generateRoomId().toLowerCase(); // Ensure lowercase
  
  let passwordHash: string | null = null;
  if (password && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), SALT_ROUNDS);
  }

  const room: Room = {
    id: roomId,
    passwordHash,
    adminId,
    users: new Map(),
    chatMessages: [],
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  
  // Debug: Verify room was created
  if (!rooms.has(roomId)) {
    throw new Error('Failed to create room in storage');
  }
  
  return roomId;
}

export async function verifyRoomPassword(roomId: string, password: string): Promise<boolean> {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return false;
  if (!room.passwordHash) return true; // No password required
  
  return await bcrypt.compare(password, room.passwordHash);
}

export function getRoom(roomId: string): Room | undefined {
  // Normalize room ID to lowercase for lookup
  const normalizedId = roomId.toLowerCase().trim();
  return rooms.get(normalizedId);
}

export function addUserToRoom(roomId: string, user: User): boolean {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return false;
  
  if (room.users.size >= 4) {
    return false; // Room is full
  }

  room.users.set(user.id, user);
  return true;
}

export function removeUserFromRoom(roomId: string, userId: string): boolean {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return false;

  room.users.delete(userId);

  // Auto-delete room if empty
  if (room.users.size === 0) {
    rooms.delete(normalizedId);
    return true; // Room deleted
  }

  // If admin left, assign new admin (first user)
  if (room.adminId === userId && room.users.size > 0) {
    const newAdmin = Array.from(room.users.values())[0];
    newAdmin.isAdmin = true;
    room.adminId = newAdmin.id;
  }

  return false; // Room still exists
}

export function addChatMessage(roomId: string, message: ChatMessage): void {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return;

  room.chatMessages.push(message);
  
  // Keep only last 100 messages to prevent memory issues
  if (room.chatMessages.length > 100) {
    room.chatMessages = room.chatMessages.slice(-100);
  }
}

export function getRoomUsers(roomId: string): User[] {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return [];
  return Array.from(room.users.values());
}

export function isRoomFull(roomId: string): boolean {
  const normalizedId = roomId.toLowerCase().trim();
  const room = rooms.get(normalizedId);
  if (!room) return true;
  return room.users.size >= 4;
}

export function cleanupEmptyRooms(): void {
  // This is handled automatically in removeUserFromRoom
  // But we can add a periodic cleanup if needed
  for (const [roomId, room] of rooms.entries()) {
    if (room.users.size === 0) {
      rooms.delete(roomId);
    }
  }
}

// Debug function to get all rooms
export function getAllRooms(): Room[] {
  const roomList = Array.from(rooms.values());
  console.log('[DEBUG] getAllRooms called, returning', roomList.length, 'rooms');
  roomList.forEach(room => {
    console.log('[DEBUG] Room:', {
      id: room.id,
      userCount: room.users.size,
      createdAt: new Date(room.createdAt).toISOString(),
    });
  });
  return roomList;
}

