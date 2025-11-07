export interface User {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  message: string;
  timestamp: number;
  type: 'message' | 'system';
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
  roomId?: string; // Added for proper backend routing
  data: any;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  isScreenSharing?: boolean;
}

