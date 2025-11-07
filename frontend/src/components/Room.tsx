import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket, useSocketEvents } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { getUserMedia, stopMediaStream } from '../utils/webrtc';
import type { RoomData, User, ChatMessage, SignalingMessage } from '../types';
import VideoTile from './VideoTile';
import Controls from './Controls';
import Chat from './Chat';

interface RoomProps {
  roomData: RoomData;
  onLeaveRoom: () => void;
}

export default function Room({ roomData, onLeaveRoom }: RoomProps) {
  const [users, setUsers] = useState<User[]>([{
    id: roomData.userId,
    displayName: roomData.displayName,
    isAdmin: roomData.isAdmin,
  }]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [hasVideoDevice, setHasVideoDevice] = useState(false);
  const [hasAudioDevice, setHasAudioDevice] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const { socket, connected } = useSocket();
  const {
    peers,
    remoteStreams,
    screenStream,
    createOffer,
    handleSignal,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC(socket, roomData.roomId, roomData.userId, localStream);
  
  // Track connection timeouts for fallback mechanism
  const connectionTimeoutsRef = useRef<Map<string, number>>(new Map());
  
  // Monitor peer connections and clear timeouts when connections are established
  useEffect(() => {
    // When a peer connection is established, clear any pending timeout
    peers.forEach((_pc, peerId) => {
      const timeoutId = connectionTimeoutsRef.current.get(peerId);
      if (timeoutId) {
        console.log(`✅ Clearing fallback timeout for ${peerId} - connection established`);
        clearTimeout(timeoutId);
        connectionTimeoutsRef.current.delete(peerId);
      }
    });
  }, [peers]);

  // Initialize media stream with graceful fallback
  useEffect(() => {
    const initMedia = async () => {
      try {
        // Check device availability first
        const { checkMediaDevices } = await import('../utils/webrtc');
        const deviceStatus = await checkMediaDevices().catch(() => ({ hasVideo: false, hasAudio: false }));
        setHasVideoDevice(deviceStatus.hasVideo);
        setHasAudioDevice(deviceStatus.hasAudio);

        // Only request media if devices are available
        if (deviceStatus.hasVideo || deviceStatus.hasAudio) {
          const stream = await getUserMedia({
            video: deviceStatus.hasVideo,
            audio: deviceStatus.hasAudio,
          });

          if (stream) {
            setLocalStream(stream);
            // Set enabled state based on actual tracks
            const videoTrack = stream.getVideoTracks()[0];
            const audioTrack = stream.getAudioTracks()[0];
            setVideoEnabled(videoTrack?.enabled ?? false);
            setAudioEnabled(audioTrack?.enabled ?? false);
            setMediaError(null);
          } else {
            // No media available, but user can still join room
            setMediaError('Camera/microphone not available. You can still join and chat.');
            console.log('✅ User joined room without media devices');
          }
        } else {
          // No devices at all - user can still join room
          setMediaError('No camera/microphone detected. You can still join and chat.');
          console.log('✅ User joined room without any media devices');
        }
      } catch (error: any) {
        // Don't block room access on media errors
        console.warn('Media initialization warning:', error.message);
        setMediaError('Could not access camera/microphone. You can still join and chat.');
      }
    };

    initMedia();

    return () => {
      if (localStream) {
        stopMediaStream(localStream);
      }
    };
  }, []);

  // Socket event handlers
  useSocketEvents(socket, {
    onSignal: (message: SignalingMessage) => {
      handleSignal(message);
    },
    onUserJoined: (data: { user: User; message: ChatMessage }) => {
      setUsers(prev => {
        if (prev.find(u => u.id === data.user.id)) return prev;
        return [...prev, data.user];
      });
      setChatMessages(prev => [...prev, data.message]);
      
      // CRITICAL FIX: When a NEW user joins, ALL existing users must create connections to them
      // This ensures full mesh formation: A→C, B→C (when C joins)
      // We use deterministic rule to avoid glare, but ALL existing users initiate
      const newUserId = data.user.id;
      const ourUserId = roomData.userId;
      
      // Check if connection already exists
      if (peers.has(newUserId)) {
        console.log(`✅ User ${data.user.displayName} joined - connection already exists`);
        // Clear any pending timeout
        const timeoutId = connectionTimeoutsRef.current.get(newUserId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          connectionTimeoutsRef.current.delete(newUserId);
        }
        return;
      }
      
      // IMPORTANT: When a NEW user joins, ALL existing users should initiate connection
      // Use deterministic rule: lower userId creates offer to prevent glare
      // But don't wait - if we have lower userId, we initiate immediately
      if (ourUserId < newUserId) {
        // We have the "lower" userId, so we create the offer
        console.log(`👤 [NEW USER] ${data.user.displayName} joined - we initiate connection (ourId: ${ourUserId} < theirId: ${newUserId})`);
        setTimeout(() => {
          createOffer(newUserId);
        }, 500); // Small delay to ensure peer connection is ready
      } else {
        // They have the "lower" userId - they should create the offer
        // BUT: Set a SHORT fallback timeout to ensure connection happens
        console.log(`👤 [NEW USER] ${data.user.displayName} joined - waiting for their offer (theirId: ${newUserId} < ourId: ${ourUserId})`);
        
        // FALLBACK: If we don't receive an offer within 2 seconds, create one ourselves
        // This ensures connection even if there's a timing issue or the new user has issues
        const timeoutId = setTimeout(() => {
          if (peers.has(newUserId)) {
            console.log(`✅ Connection to ${data.user.displayName} established during wait, canceling fallback`);
            connectionTimeoutsRef.current.delete(newUserId);
            return;
          }
          
          console.log(`⏰ [FALLBACK] No connection to ${data.user.displayName} after 2s, creating offer ourselves`);
          createOffer(newUserId);
          connectionTimeoutsRef.current.delete(newUserId);
        }, 2000); // Shorter timeout for faster recovery
        
        connectionTimeoutsRef.current.set(newUserId, timeoutId);
      }
    },
    onUserLeft: (data: { userId: string; message: ChatMessage }) => {
      setUsers(prev => prev.filter(u => u.id !== data.userId));
      setChatMessages(prev => [...prev, data.message]);
    },
    onChatMessage: (message: ChatMessage) => {
      setChatMessages(prev => [...prev, message]);
    },
    onRoomJoined: (data: { existingUsers: User[]; chatHistory: ChatMessage[] }) => {
      setUsers(prev => {
        const existing = [...prev];
        data.existingUsers.forEach(user => {
          if (!existing.find(u => u.id === user.id)) {
            existing.push(user);
          }
        });
        return existing;
      });
      setChatMessages(data.chatHistory || []);
      
      // CRITICAL FIX: When WE join a room with existing users, establish connections to ALL of them
      // Use deterministic rule per-pair to avoid glare, but ensure ALL connections are attempted
      const ourUserId = roomData.userId;
      console.log(`🏠 [JOINING ROOM] Found ${data.existingUsers.length} existing users`);
      console.log(`   Our userId: ${ourUserId}`);
      console.log(`   Existing users:`, data.existingUsers.map(u => `${u.displayName} (${u.id})`));
      
      // Process each existing user with a small stagger to avoid overwhelming the system
      data.existingUsers.forEach((user, index) => {
        const existingUserId = user.id;
        
        // Check if connection already exists
        if (peers.has(existingUserId)) {
          console.log(`✅ Connection to ${user.displayName} already exists`);
          return;
        }
        
        // Apply deterministic rule: lower userId creates offer
        // This ensures each pair has a clear initiator, preventing glare
        setTimeout(() => {
          if (ourUserId < existingUserId) {
            // We have the "lower" userId, so we create the offer
            console.log(`📤 [EXISTING USER] Creating offer to ${user.displayName} (ourId: ${ourUserId} < theirId: ${existingUserId})`);
            createOffer(existingUserId);
          } else {
            // They have the "lower" userId - they should already be creating offers to us
            // But set a fallback in case their offers don't arrive
            console.log(`⏳ [EXISTING USER] Waiting for ${user.displayName} to initiate connection (theirId: ${existingUserId} < ourId: ${ourUserId})`);
            
            // FALLBACK: If we don't receive an offer within 2 seconds, create one ourselves
            const timeoutId = setTimeout(() => {
              if (peers.has(existingUserId)) {
                console.log(`✅ Connection to ${user.displayName} established during wait, canceling fallback`);
                connectionTimeoutsRef.current.delete(existingUserId);
                return;
              }
              
              console.log(`⏰ [FALLBACK] No connection to ${user.displayName} after 2s, creating offer ourselves`);
              createOffer(existingUserId);
              connectionTimeoutsRef.current.delete(existingUserId);
            }, 2000);
            
            connectionTimeoutsRef.current.set(existingUserId, timeoutId);
          }
        }, index * 200); // Stagger connections by 200ms each to avoid race conditions
      });
    },
    onRoomCreated: () => {
      // Room created, user is already in
    },
    onError: (err: { message: string }) => {
      setError(err.message);
    },
    onRoomClosed: () => {
      setError('Room has been closed');
      setTimeout(() => {
        handleLeaveRoom();
      }, 2000);
    },
  });

  const handleToggleVideo = useCallback(async () => {
    if (!hasVideoDevice) {
      setError('No camera device available');
      return;
    }

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    } else {
      // Try to get video stream if we don't have one
      try {
        const stream = await getUserMedia({ video: true, audio: hasAudioDevice });
        if (stream) {
          setLocalStream(stream);
          const videoTrack = stream.getVideoTracks()[0];
          setVideoEnabled(videoTrack?.enabled ?? true);
        }
      } catch (error: any) {
        setError(`Could not enable camera: ${error.message}`);
      }
    }
  }, [localStream, hasVideoDevice, hasAudioDevice]);

  const handleToggleAudio = useCallback(async () => {
    if (!hasAudioDevice) {
      setError('No microphone device available');
      return;
    }

    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    } else {
      // Try to get audio stream if we don't have one
      try {
        const stream = await getUserMedia({ video: hasVideoDevice, audio: true });
        if (stream) {
          setLocalStream(stream);
          const audioTrack = stream.getAudioTracks()[0];
          setAudioEnabled(audioTrack?.enabled ?? true);
        }
      } catch (error: any) {
        setError(`Could not enable microphone: ${error.message}`);
      }
    }
  }, [localStream, hasVideoDevice, hasAudioDevice]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      if (screenSharing) {
        await stopScreenShare();
        setScreenSharing(false);
      } else {
        await startScreenShare();
        setScreenSharing(true);
      }
    } catch (error: any) {
      setError(`Screen share failed: ${error.message}`);
    }
  }, [screenSharing, startScreenShare, stopScreenShare]);

  const handleSendMessage = useCallback((message: string) => {
    if (socket && message.trim()) {
      socket.emit('chat-message', {
        roomId: roomData.roomId,
        message: message.trim(),
        userId: roomData.userId,
        displayName: roomData.displayName,
      });
    }
  }, [socket, roomData]);

  const handleLeaveRoom = useCallback(() => {
    if (socket) {
      socket.emit('leave-room', {
        roomId: roomData.roomId,
        userId: roomData.userId,
      });
    }
    
    if (localStream) {
      stopMediaStream(localStream);
    }
    
    if (screenStream) {
      stopMediaStream(screenStream);
    }

    onLeaveRoom();
  }, [socket, roomData, localStream, screenStream, onLeaveRoom]);

  // Grid layout for video tiles (up to 4)
  const videoTiles = [];
  const localUser = users.find(u => u.id === roomData.userId);
  
  // Always show local user first
  if (localUser) {
    videoTiles.push(
      <VideoTile
        key={localUser.id}
        user={localUser}
        stream={screenSharing && screenStream ? screenStream : localStream}
        isLocal
        audioMuted={!audioEnabled}
        videoMuted={!videoEnabled}
      />
    );
  }

  // Show all remote users (with or without streams)
  users.forEach(user => {
    if (user.id !== roomData.userId) {
      const remoteStream = remoteStreams.get(user.id) || null;
      const hasStream = remoteStream !== null;
      
      // Debug logging
      if (hasStream) {
        console.log(`🎥 Rendering video tile for ${user.displayName} (${user.id}) with stream`);
      } else {
        console.log(`⏳ Rendering placeholder for ${user.displayName} (${user.id}) - no stream yet`);
      }
      
      videoTiles.push(
        <VideoTile
          key={user.id}
          user={user}
          stream={remoteStream}
        />
      );
    }
  });
  
  // Debug: Log current state
  console.log(`📊 Video tiles: ${videoTiles.length} tiles, ${users.length} users, ${remoteStreams.size} remote streams`);
  console.log(`   Users:`, users.map(u => ({ id: u.id, name: u.displayName })));
  console.log(`   Remote streams:`, Array.from(remoteStreams.keys()));

  // Fill remaining slots up to 4
  while (videoTiles.length < 4) {
    videoTiles.push(
      <div key={`empty-${videoTiles.length}`} className="bg-slate-800 rounded-lg aspect-video border-2 border-dashed border-slate-600 flex items-center justify-center">
        <span className="text-slate-500">Waiting for user...</span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Room: {roomData.roomId}</h2>
          <p className="text-sm text-slate-400">
            {users.length} / 4 participants | {peers.size} peer connections | {remoteStreams.size} streams
            {!connected && <span className="ml-2 text-yellow-400">(Reconnecting...)</span>}
          </p>
          <div className="text-xs text-slate-500 mt-1">
            Users: {users.map(u => u.displayName).join(', ')} | 
            Peers: {Array.from(peers.keys()).map(id => {
              const user = users.find(u => u.id === id);
              return user?.displayName || id.substring(0, 6);
            }).join(', ') || 'none'} | 
            Streams: {Array.from(remoteStreams.keys()).map(id => {
              const user = users.find(u => u.id === id);
              return user?.displayName || id.substring(0, 6);
            }).join(', ') || 'none'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors"
            title="Toggle chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}?room=${roomData.roomId}`);
              alert('Room link copied to clipboard!');
            }}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded text-white text-sm transition-colors"
          >
            Copy Room Link
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Media warning (non-blocking) */}
      {mediaError && (
        <div className="bg-yellow-900/50 border-b border-yellow-700 p-3 text-yellow-200 text-sm">
          ℹ️ {mediaError}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className={`flex-1 p-4 ${showChat ? 'mr-4' : ''}`}>
          <div className="grid grid-cols-2 gap-4 h-full max-w-7xl mx-auto">
            {videoTiles.slice(0, 4)}
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l border-slate-700">
            <Chat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              currentUserId={roomData.userId}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <Controls
        videoEnabled={videoEnabled}
        audioEnabled={audioEnabled}
        screenSharing={screenSharing}
        hasVideoDevice={hasVideoDevice}
        hasAudioDevice={hasAudioDevice}
        onToggleVideo={handleToggleVideo}
        onToggleAudio={handleToggleAudio}
        onToggleScreenShare={handleToggleScreenShare}
        onLeaveRoom={handleLeaveRoom}
      />
    </div>
  );
}

