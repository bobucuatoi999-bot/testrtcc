import type { Server, Socket } from 'socket.io';
import {
  createRoom,
  getRoom,
  verifyRoomPassword,
  addUserToRoom,
  removeUserFromRoom,
  addChatMessage,
  getRoomUsers,
  isRoomFull,
  generateUserId,
  generateRoomId,
} from '../utils/roomManager.js';
import type { User, ChatMessage, SignalingMessage } from '../types.js';
import { logger } from '../utils/logger.js';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    logger.info('✅ Client connected', { 
      socketId: socket.id,
      transport: socket.conn.transport.name,
      remoteAddress: socket.handshake.address,
    });
    
    // Track socket to user mapping for disconnect handling
    // MUST be declared before disconnect handler to be accessible
    const socketToUser = new Map<string, { roomId: string; userId: string }>();
    
    // Log when client disconnects
    socket.on('disconnect', (reason) => {
      const userInfo = socketToUser.get(socket.id);
      logger.info('❌ Client disconnected', { 
        socketId: socket.id, 
        reason,
        wasInRoom: !!userInfo,
        roomId: userInfo?.roomId,
        userId: userInfo?.userId
      });
      
      if (userInfo) {
        const { roomId, userId } = userInfo;
        const room = getRoom(roomId);
        
        if (room) {
          logger.info('🔄 Removing user from room due to disconnect', { 
            roomId, 
            userId, 
            userCountBefore: room.users.size 
          });
          
          const user = room.users.get(userId);
          if (user) {
            const leaveMessage: ChatMessage = {
              id: generateRoomId(),
              userId: 'system',
              displayName: 'System',
              message: `${user.displayName} left the room`,
              timestamp: Date.now(),
              type: 'system',
            };
            addChatMessage(roomId, leaveMessage);

            const roomDeleted = removeUserFromRoom(roomId, userId);
            
            const roomAfter = getRoom(roomId);
            logger.info('📊 Room state after disconnect', { 
              roomId,
              roomDeleted,
              userCountAfter: roomAfter?.users.size || 0,
              roomStillExists: !!roomAfter
            });

            // Notify others
            socket.to(roomId).emit('user-left', {
              userId,
              message: leaveMessage,
            });

            if (roomDeleted) {
              logger.info('🗑️ Room deleted because it became empty', { roomId });
              socket.to(roomId).emit('room-closed');
            }
          }
        }
        
        socketToUser.delete(socket.id);
      }
    });

    // Create room
    socket.on('create-room', async (data: { displayName: string; password?: string }) => {
      try {
        logger.info('📥 Received create-room event', { socketId: socket.id, displayName: data.displayName });
        
        const { displayName, password } = data;
        
        if (!displayName || displayName.trim().length === 0) {
          logger.warn('❌ Create room failed: Display name is required');
          socket.emit('error', { message: 'Display name is required' });
          return;
        }

        const userId = generateUserId();
        const adminId = userId;

        logger.info('🔄 Creating room...', { userId, adminId, hasPassword: !!password });

        // createRoom returns the roomId (already lowercase)
        const roomId = await createRoom(adminId, password);
        logger.info('✅ Room created in storage', { roomId });

        // Verify room exists immediately after creation
        const { getAllRooms } = await import('../utils/roomManager.js');
        const allRoomsBefore = getAllRooms();
        logger.info('📊 Rooms in storage after creation', { 
          totalRooms: allRoomsBefore.length, 
          roomIds: allRoomsBefore.map(r => r.id) 
        });

        const user: User = {
          id: userId,
          socketId: socket.id,
          displayName: displayName.trim(),
          isAdmin: true,
          joinedAt: Date.now(),
        };

        const room = getRoom(roomId);
        if (!room) {
          logger.error('❌ Room not found after creation', { roomId });
          socket.emit('error', { message: 'Failed to create room' });
          return;
        }

        const added = addUserToRoom(roomId, user);
        if (!added) {
          logger.error('❌ Failed to add user to room', { roomId, userId });
          socket.emit('error', { message: 'Failed to add user to room' });
          return;
        }

        socket.join(roomId);
        socketToUser.set(socket.id, { roomId, userId });

        // Verify room still exists and has user
        const roomAfter = getRoom(roomId);
        const allRoomsAfter = getAllRooms();
        logger.info('📊 Rooms in storage after adding user', { 
          totalRooms: allRoomsAfter.length, 
          roomIds: allRoomsAfter.map(r => r.id),
          userCount: roomAfter?.users.size || 0
        });

        socket.emit('room-created', {
          roomId,
          userId,
          isAdmin: true,
          existingUsers: [], // Empty since room was just created
        });

        logger.info('✅ Room created successfully and user added', { 
          roomId, 
          userId, 
          displayName,
          userCount: roomAfter?.users.size || 0,
          socketConnected: socket.connected
        });
      } catch (error: any) {
        logger.error('❌ Error creating room', { error: error.message, stack: error.stack });
        socket.emit('error', { message: error.message || 'Failed to create room' });
      }
    });

    // Join room
    socket.on('join-room', async (data: { roomId: string; displayName: string; password?: string }) => {
      try {
        const { roomId, displayName, password } = data;
        const normalizedRoomId = roomId.trim().toLowerCase();

        logger.info('Join room request', { roomId: normalizedRoomId, displayName, hasPassword: !!password });

        if (!displayName || displayName.trim().length === 0) {
          socket.emit('error', { message: 'Display name is required' });
          return;
        }

        if (!normalizedRoomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        const room = getRoom(normalizedRoomId);
        if (!room) {
          // Import for debugging - show available rooms
          const { getAllRooms } = await import('../utils/roomManager.js');
          const allRooms = getAllRooms();
          const availableRoomIds = allRooms.map(r => r.id);
          
          logger.warn('Room not found', { 
            requestedRoomId: normalizedRoomId, 
            availableRooms: availableRoomIds,
            roomCount: allRooms.length
          });
          
          if (availableRoomIds.length === 0) {
            socket.emit('error', { 
              message: `Room "${normalizedRoomId}" not found. No active rooms. The room may have been deleted when the creator left.` 
            });
          } else {
            socket.emit('error', { 
              message: `Room "${normalizedRoomId}" not found. Available rooms: ${availableRoomIds.join(', ')}. Make sure the room creator is still in the room.` 
            });
          }
          return;
        }

        // Check if room is full
        if (isRoomFull(normalizedRoomId)) {
          socket.emit('error', { message: 'Room is full (maximum 4 users)' });
          return;
        }

        // Verify password
        if (room.passwordHash) {
          const isValidPassword = await verifyRoomPassword(normalizedRoomId, password || '');
          if (!isValidPassword) {
            socket.emit('error', { message: 'Invalid password' });
            return;
          }
        }

        const userId = generateUserId();
        const user: User = {
          id: userId,
          socketId: socket.id,
          displayName: displayName.trim(),
          isAdmin: false,
          joinedAt: Date.now(),
        };

        addUserToRoom(normalizedRoomId, user);
        socket.join(normalizedRoomId);
        socketToUser.set(socket.id, { roomId: normalizedRoomId, userId });

        // Get existing users in room
        const existingUsers = getRoomUsers(normalizedRoomId).filter(u => u.id !== userId);

        // Notify user of successful join
        socket.emit('room-joined', {
          roomId: normalizedRoomId,
          userId,
          existingUsers: existingUsers.map(u => ({
            id: u.id,
            displayName: u.displayName,
            isAdmin: u.isAdmin,
          })),
          chatHistory: room.chatMessages.slice(-50), // Last 50 messages
        });

        // Add system message for join
        const joinMessage: ChatMessage = {
          id: generateRoomId(),
          userId: 'system',
          displayName: 'System',
          message: `${user.displayName} joined the room`,
          timestamp: Date.now(),
          type: 'system',
        };
        addChatMessage(normalizedRoomId, joinMessage);

        // Notify other users
        socket.to(normalizedRoomId).emit('user-joined', {
          user: {
            id: user.id,
            displayName: user.displayName,
            isAdmin: user.isAdmin,
          },
          message: joinMessage,
        });

        logger.info('User joined room successfully', { roomId: normalizedRoomId, userId, displayName });
      } catch (error) {
        logger.error('Error joining room', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // WebRTC signaling
    socket.on('signal', (data: SignalingMessage) => {
      try {
        const { to, type, from, data: signalData, roomId } = data;
        
        // Get sender's roomId from socketToUser map if not provided
        const senderInfo = socketToUser.get(socket.id);
        const targetRoomId = roomId || senderInfo?.roomId;
        
        if (!targetRoomId) {
          logger.warn('Signal received without roomId and sender not in any room', { from, to, type });
          return;
        }

        const room = getRoom(targetRoomId);
        if (!room) {
          logger.warn('Signal received for non-existent room', { roomId: targetRoomId, from, to, type });
          return;
        }

        if (to) {
          // Send to specific peer by userId
          // Look up target user's socketId from the room
          const targetUser = room.users.get(to);
          if (!targetUser) {
            logger.warn('Signal target user not found in room', { roomId: targetRoomId, targetUserId: to, from });
            return;
          }

          // Forward signal to target user's socketId
          io.to(targetUser.socketId).emit('signal', {
            type,
            from,
            to,
            roomId: targetRoomId,
            data: signalData,
          });

          logger.info('Signal forwarded', { 
            type, 
            from, 
            to, 
            fromSocketId: socket.id, 
            toSocketId: targetUser.socketId,
            roomId: targetRoomId 
          });
        } else {
          // Broadcast to all users in room (except sender)
          const roomUsers = getRoomUsers(targetRoomId);
          roomUsers.forEach(user => {
            if (user.id !== from && user.socketId !== socket.id) {
              io.to(user.socketId).emit('signal', {
                type,
                from,
                to: user.id,
                roomId: targetRoomId,
                data: signalData,
              });
            }
          });
        }
      } catch (error) {
        logger.error('Error handling signal', { error, data });
      }
    });

    // Chat message
    socket.on('chat-message', (data: { roomId: string; message: string; userId: string; displayName: string }) => {
      try {
        const { roomId, message, userId, displayName } = data;
        
        if (!message || message.trim().length === 0) {
          return;
        }

        // Basic XSS protection
        const sanitizedMessage = message.trim().slice(0, 500);

        const chatMessage: ChatMessage = {
          id: generateRoomId(),
          userId,
          displayName,
          message: sanitizedMessage,
          timestamp: Date.now(),
          type: 'message',
        };

        addChatMessage(roomId, chatMessage);

        // Broadcast to all in room
        io.to(roomId).emit('chat-message', chatMessage);

        logger.info('Chat message sent', { roomId, userId });
      } catch (error) {
        logger.error('Error sending chat message', error);
      }
    });


    // Leave room
    socket.on('leave-room', (data: { roomId: string; userId: string }) => {
      try {
        const { roomId, userId } = data;
        const room = getRoom(roomId);
        
        if (room) {
          const user = room.users.get(userId);
          if (user) {
            const leaveMessage: ChatMessage = {
              id: generateRoomId(),
              userId: 'system',
              displayName: 'System',
              message: `${user.displayName} left the room`,
              timestamp: Date.now(),
              type: 'system',
            };
            addChatMessage(roomId, leaveMessage);

            const roomDeleted = removeUserFromRoom(roomId, userId);
            socket.leave(roomId);
            socketToUser.delete(socket.id);

            // Notify others
            socket.to(roomId).emit('user-left', {
              userId,
              message: leaveMessage,
            });

            if (roomDeleted) {
              socket.to(roomId).emit('room-closed');
            }

            logger.info('User left room', { roomId, userId });
          }
        }
      } catch (error) {
        logger.error('Error leaving room', error);
      }
    });
  });
}

