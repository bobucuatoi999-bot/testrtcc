import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SignalingMessage, ChatMessage, User } from '../types';

// Use proxy in development, explicit URL in production
const API_URL = (import.meta as any).env?.VITE_API_URL;
const isDevelopment = !API_URL || API_URL.includes('localhost');

// SINGLETON: Global socket instance shared across all components
let globalSocket: Socket | null = null;
let connectionStateListeners: Set<(connected: boolean) => void> = new Set();
let isInitializing = false;

// Initialize socket singleton (only called once)
function initializeSocket(): Socket {
  if (globalSocket && globalSocket.connected) {
    return globalSocket;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    return globalSocket!;
  }

  isInitializing = true;

  const socketOptions = {
    transports: ['websocket', 'polling'] as ('websocket' | 'polling')[],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    autoConnect: true,
    ...(isDevelopment ? {} : { withCredentials: true }),
  };

  // In development, use proxy (no URL) or explicit localhost
  // In production, use VITE_API_URL environment variable
  const socketUrl = isDevelopment 
    ? (API_URL || undefined) // Use explicit URL if provided, otherwise use proxy
    : (API_URL || 'https://testrtcc-production.up.railway.app'); // Production: default to Railway backend
  
  if (!socketUrl && !isDevelopment) {
    console.error('❌ VITE_API_URL not set in production! Using default: https://testrtcc-production.up.railway.app');
  }
  
  console.log('🔌 Initializing singleton Socket.io connection:', {
    isDevelopment,
    socketUrl: socketUrl || 'via proxy',
    apiUrl: API_URL || 'not set'
  });
  
  globalSocket = socketUrl ? io(socketUrl, socketOptions) : io(socketOptions);

  globalSocket.on('connect', () => {
    console.log('✅ Socket.io connected successfully!', { id: globalSocket!.id });
    connectionStateListeners.forEach(listener => listener(true));
  });

  globalSocket.on('disconnect', (reason) => {
    // Only log unexpected disconnects (not manual closes)
    if (reason !== 'io client disconnect') {
      console.warn('❌ Socket.io disconnected:', reason);
    }
    connectionStateListeners.forEach(listener => listener(false));
  });

  globalSocket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error.message);
    connectionStateListeners.forEach(listener => listener(false));
  });

  isInitializing = false;
  return globalSocket;
}

// Cleanup socket (only when entire app unmounts)
export function cleanupSocket(): void {
  if (globalSocket) {
    console.log('🔌 Cleaning up global socket connection');
    globalSocket.close();
    globalSocket = null;
    connectionStateListeners.clear();
    isInitializing = false;
  }
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Initialize singleton socket
    const socket = initializeSocket();
    
    // Set initial connection state
    if (socket.connected) {
      setConnected(true);
    }

    // Register connection state listener
    const connectionListener = (isConnected: boolean) => {
      if (mountedRef.current) {
        setConnected(isConnected);
      }
    };

    connectionStateListeners.add(connectionListener);

    // Update state immediately if socket is already connected
    if (socket.connected) {
      setConnected(true);
    }

    // Cleanup: Remove listener but DON'T close socket (it's shared)
    return () => {
      mountedRef.current = false;
      connectionStateListeners.delete(connectionListener);
      // DON'T close socket here - it's shared across components
    };
  }, []); // Empty deps - only run once per component

  return { 
    socket: globalSocket, 
    connected 
  };
}

export function useSocketEvents(
  socket: Socket | null,
  handlers: {
    onSignal?: (message: SignalingMessage) => void;
    onUserJoined?: (data: { user: User; message: ChatMessage }) => void;
    onUserLeft?: (data: { userId: string; message: ChatMessage }) => void;
    onChatMessage?: (message: ChatMessage) => void;
    onRoomJoined?: (data: any) => void;
    onRoomCreated?: (data: any) => void;
    onError?: (error: { message: string }) => void;
    onRoomClosed?: () => void;
  }
) {
  useEffect(() => {
    if (!socket) return;

    if (handlers.onSignal) {
      socket.on('signal', handlers.onSignal);
    }
    if (handlers.onUserJoined) {
      socket.on('user-joined', handlers.onUserJoined);
    }
    if (handlers.onUserLeft) {
      socket.on('user-left', handlers.onUserLeft);
    }
    if (handlers.onChatMessage) {
      socket.on('chat-message', handlers.onChatMessage);
    }
    if (handlers.onRoomJoined) {
      socket.on('room-joined', handlers.onRoomJoined);
    }
    if (handlers.onRoomCreated) {
      socket.on('room-created', handlers.onRoomCreated);
    }
    if (handlers.onError) {
      socket.on('error', handlers.onError);
    }
    if (handlers.onRoomClosed) {
      socket.on('room-closed', handlers.onRoomClosed);
    }

    return () => {
      if (handlers.onSignal) socket.off('signal', handlers.onSignal);
      if (handlers.onUserJoined) socket.off('user-joined', handlers.onUserJoined);
      if (handlers.onUserLeft) socket.off('user-left', handlers.onUserLeft);
      if (handlers.onChatMessage) socket.off('chat-message', handlers.onChatMessage);
      if (handlers.onRoomJoined) socket.off('room-joined', handlers.onRoomJoined);
      if (handlers.onRoomCreated) socket.off('room-created', handlers.onRoomCreated);
      if (handlers.onError) socket.off('error', handlers.onError);
      if (handlers.onRoomClosed) socket.off('room-closed', handlers.onRoomClosed);
    };
  }, [socket, handlers]);
}
