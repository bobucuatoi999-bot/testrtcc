import { useEffect, useState, useRef } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useSignaling } from '../hooks/useSignaling';
import Controls from './Controls';
import UserList from './UserList';
import VideoTile from './VideoTile';
import ConnectionIndicator from './ConnectionIndicator';

const MAX_PARTICIPANTS = 4;

function Room({ roomData, onLeaveRoom }) {
  const [participants, setParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [error, setError] = useState('');
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [myParticipantId, setMyParticipantId] = useState(null);

  const { peers, addPeer, handleOffer, handleAnswer, handleCandidate, removePeer, replaceTrack } = useWebRTC();
  const { connected, sendMessage, participants: signalingParticipants, onMessage } = useSignaling(
    roomData.token,
    roomData.roomId
  );

  // Update participants from signaling
  useEffect(() => {
    setParticipants(signalingParticipants);
    
    // Check if room is full
    if (signalingParticipants.length >= MAX_PARTICIPANTS) {
      setIsRoomFull(true);
    }
  }, [signalingParticipants]);

  // Update connection status
  useEffect(() => {
    setConnectionStatus(connected ? 'connected' : 'disconnected');
  }, [connected]);

  // Initialize local media
  useEffect(() => {
    initializeMedia();
    return () => {
      cleanup();
    };
  }, []);

  // Handle signaling messages for WebRTC
  useEffect(() => {
    if (!onMessage || !connected) return;

    const unsubscribe = onMessage((message) => {
      switch (message.type) {
        case 'joined':
          setMyParticipantId(message.participantId);
          break;

        case 'participant-joined':
          // Create peer connection for new participant
          if (localStream && message.participantId !== myParticipantId) {
            addPeer(
              message.participantId,
              localStream,
              (targetId, offer) => {
                sendMessage({ type: 'offer', target: targetId, offer, roomId: roomData.roomId });
              },
              (targetId, answer) => {
                sendMessage({ type: 'answer', target: targetId, answer, roomId: roomData.roomId });
              },
              (targetId, candidate) => {
                sendMessage({ type: 'candidate', target: targetId, candidate, roomId: roomData.roomId });
              }
            );
          }
          break;

        case 'participant-left':
          removePeer(message.participantId);
          break;

        case 'offer':
          if (localStream) {
            handleOffer(message.from, message.offer, localStream, (targetId, answer) => {
              sendMessage({ type: 'answer', target: targetId, answer, roomId: roomData.roomId });
            }, (targetId, candidate) => {
              sendMessage({ type: 'candidate', target: targetId, candidate, roomId: roomData.roomId });
            });
          }
          break;

        case 'answer':
          handleAnswer(message.from, message.answer);
          break;

        case 'candidate':
          handleCandidate(message.from, message.candidate);
          break;

        case 'full':
          setIsRoomFull(true);
          break;
      }
    });

    return unsubscribe;
  }, [onMessage, connected, localStream, myParticipantId, addPeer, handleOffer, handleAnswer, handleCandidate, removePeer, sendMessage, roomData.roomId]);

  // Create peer connections when existing participants are listed
  useEffect(() => {
    if (!localStream || !connected || !myParticipantId) return;

    signalingParticipants.forEach(participant => {
      if (participant.id !== myParticipantId && !peers[participant.id]) {
        // Create peer connection for existing participants
        addPeer(
          participant.id,
          localStream,
          (targetId, offer) => {
            sendMessage({ type: 'offer', target: targetId, offer, roomId: roomData.roomId });
          },
          (targetId, answer) => {
            sendMessage({ type: 'answer', target: targetId, answer, roomId: roomData.roomId });
          },
          (targetId, candidate) => {
            sendMessage({ type: 'candidate', target: targetId, candidate, roomId: roomData.roomId });
          }
        );
      }
    });
  }, [localStream, connected, myParticipantId, signalingParticipants, peers, addPeer, sendMessage, roomData.roomId]);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 1280, height: 720 }
      });
      setLocalStream(stream);
      setIsMuted(false);
      setIsVideoOff(false);
    } catch (err) {
      setError('Failed to access camera/microphone: ' + err.message);
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peers).forEach(peer => {
      if (peer.pc) {
        peer.pc.close();
      }
    });
  };

  const handleToggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        // Switch back to camera
        if (localStream) {
          const videoTrack = localStream.getVideoTracks()[0];
          if (videoTrack && videoTrack.readyState === 'live') {
            Object.keys(peers).forEach(participantId => {
              replaceTrack(participantId, videoTrack);
            });
          }
        }
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100
          }
        });

        setScreenStream(stream);
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Replace video track in all existing peer connections
        if (videoTrack) {
          Object.keys(peers).forEach(participantId => {
            replaceTrack(participantId, videoTrack);
          });
        }

        // Handle screen share audio if available
        if (audioTrack) {
          // Audio from screen share can be added as a separate track or replace the existing audio
          // For simplicity, we'll keep the microphone audio and add screen share audio
          // You might want to replace microphone audio with screen share audio instead
        }

        // Handle screen share end (user stops sharing via browser UI)
        videoTrack.onended = () => {
          if (isScreenSharing) {
            handleScreenShare();
          }
        };

        setIsScreenSharing(true);
      }
    } catch (err) {
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        setError('Failed to share screen: ' + err.message);
      }
      console.error('Screen share error:', err);
    }
  };

  const handleLeave = () => {
    cleanup();
    onLeaveRoom();
  };

  // Create video tiles
  const videoTiles = [];
  
  // Local video tile
  if (localStream || screenStream) {
    videoTiles.push(
      <VideoTile
        key="local"
        stream={screenStream || localStream}
        displayName={roomData.displayName + ' (You)'}
        isLocal={true}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
      />
    );
  }

  // Remote video tiles
  Object.entries(peers).forEach(([participantId, peer]) => {
    const participant = participants.find(p => p.id === participantId);
    if (peer && peer.remoteStream) {
      videoTiles.push(
        <VideoTile
          key={participantId}
          stream={peer.remoteStream}
          displayName={participant?.displayName || 'Unknown'}
          isLocal={false}
        />
      );
    }
  });

  return (
    <div className="room">
      {isRoomFull && (
        <div className="room-full-overlay">
          <div className="room-full-message">
            Room is full (maximum {MAX_PARTICIPANTS} participants)
          </div>
        </div>
      )}

      <div className="room-header">
        <div className="room-info">
          <h2>{roomData.roomName || roomData.roomId}</h2>
          <ConnectionIndicator status={connectionStatus} />
        </div>
        <div className="room-id">Room ID: {roomData.roomId}</div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="video-grid">
        {videoTiles.length === 0 ? (
          <div className="no-video">Waiting for video...</div>
        ) : (
          videoTiles
        )}
      </div>

      <Controls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onScreenShare={handleScreenShare}
        onLeave={handleLeave}
      />

      <UserList participants={participants} />
    </div>
  );
}

export default Room;
