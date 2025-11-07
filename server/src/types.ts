export interface User {
  id: string;
  socketId: string;
  displayName: string;
  isAdmin: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
  type: 'message' | 'system';
}

export interface Room {
  id: string;
  passwordHash: string | null;
  adminId: string;
  users: Map<string, User>;
  chatMessages: ChatMessage[];
  createdAt: number;
}

export interface RoomData {
  roomId: string;
  userId: string;
  displayName: string;
  isAdmin: boolean;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'user-joined' | 'user-left';
  from: string;
  to?: string;
  roomId?: string; // Added for proper routing
  data: any;
}

