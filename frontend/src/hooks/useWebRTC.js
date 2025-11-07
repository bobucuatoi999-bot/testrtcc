import { useState, useEffect, useRef, useCallback } from 'react';

// Use environment variable for API URL, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export function useWebRTC() {
  const [peers, setPeers] = useState({});
  const [iceServers, setIceServers] = useState(null);
  const iceServersFetched = useRef(false);

  // Fetch ICE servers (TURN/STUN)
  useEffect(() => {
    if (!iceServersFetched.current) {
      fetchIceServers();
      iceServersFetched.current = true;
    }
  }, []);

  const fetchIceServers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/turn`);
      const data = await response.json();
      setIceServers(data.iceServers);
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      // Fallback to public STUN servers
      setIceServers([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]);
    }
  };

  const createPeerConnection = useCallback((participantId, onTrack, onIceCandidate) => {
    if (!iceServers) {
      console.warn('ICE servers not loaded yet');
      return null;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServers
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind, event.track.id);
      const stream = event.streams[0];
      if (stream) {
        onTrack(stream);
        
        // Handle track ended/replaced for screen sharing
        event.track.onended = () => {
          console.log('Remote track ended:', event.track.kind, event.track.id);
        };
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Peer connection state:', pc.connectionState);
    };

    return pc;
  }, [iceServers]);

  const addPeer = useCallback((participantId, localStream, onOffer, onAnswer, onCandidate) => {
    const remoteStreamRef = { current: null };

    const onTrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // If we already have a stream, merge tracks or create new stream
      if (remoteStreamRef.current) {
        // Check if this is a new track or replacement
        const existingVideoTrack = remoteStreamRef.current.getVideoTracks()[0];
        const newVideoTrack = stream.getVideoTracks()[0];
        
        if (newVideoTrack && (!existingVideoTrack || existingVideoTrack.id !== newVideoTrack.id)) {
          // New or replaced video track - update stream
          const newStream = new MediaStream();
          
          // Add all audio tracks from existing stream
          remoteStreamRef.current.getAudioTracks().forEach(track => {
            if (track.readyState === 'live') {
              newStream.addTrack(track);
            }
          });
          
          // Add new video track
          newStream.addTrack(newVideoTrack);
          
          remoteStreamRef.current = newStream;
          setPeers(prev => ({
            ...prev,
            [participantId]: {
              ...prev[participantId],
              remoteStream: newStream
            }
          }));
        }
      } else {
        // First track received
        remoteStreamRef.current = stream;
        setPeers(prev => ({
          ...prev,
          [participantId]: {
            ...prev[participantId],
            remoteStream: stream
          }
        }));
      }
    };

    const onIceCandidate = (candidate) => {
      onCandidate(participantId, candidate);
    };

    const pc = createPeerConnection(participantId, onTrack, onIceCandidate);

    if (!pc) {
      return null;
    }

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Create offer
    pc.createOffer().then(offer => {
      return pc.setLocalDescription(offer);
    }).then(() => {
      onOffer(participantId, pc.localDescription);
    }).catch(error => {
      console.error('Error creating offer:', error);
    });

    setPeers(prev => ({
      ...prev,
      [participantId]: {
        pc,
        remoteStream: null,
        remoteStreamRef
      }
    }));

    return pc;
  }, [createPeerConnection]);

  const handleOffer = useCallback((participantId, offer, localStream, onAnswer, onCandidate) => {
    const remoteStreamRef = { current: null };

    const onTrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      // If we already have a stream, merge tracks or create new stream
      if (remoteStreamRef.current) {
        // Check if this is a new track or replacement
        const existingVideoTrack = remoteStreamRef.current.getVideoTracks()[0];
        const newVideoTrack = stream.getVideoTracks()[0];
        
        if (newVideoTrack && (!existingVideoTrack || existingVideoTrack.id !== newVideoTrack.id)) {
          // New or replaced video track - update stream
          const newStream = new MediaStream();
          
          // Add all audio tracks from existing stream
          remoteStreamRef.current.getAudioTracks().forEach(track => {
            if (track.readyState === 'live') {
              newStream.addTrack(track);
            }
          });
          
          // Add new video track
          newStream.addTrack(newVideoTrack);
          
          remoteStreamRef.current = newStream;
          setPeers(prev => ({
            ...prev,
            [participantId]: {
              ...prev[participantId],
              remoteStream: newStream
            }
          }));
        }
      } else {
        // First track received
        remoteStreamRef.current = stream;
        setPeers(prev => ({
          ...prev,
          [participantId]: {
            ...prev[participantId],
            remoteStream: stream
          }
        }));
      }
    };

    const onIceCandidate = (candidate) => {
      onCandidate(participantId, candidate);
    };

    const pc = createPeerConnection(participantId, onTrack, onIceCandidate);

    if (!pc) {
      return;
    }

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Set remote description and create answer
    pc.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => {
        return pc.createAnswer();
      })
      .then(answer => {
        return pc.setLocalDescription(answer);
      })
      .then(() => {
        onAnswer(participantId, pc.localDescription);
      })
      .catch(error => {
        console.error('Error handling offer:', error);
      });

    setPeers(prev => ({
      ...prev,
      [participantId]: {
        pc,
        remoteStream: null,
        remoteStreamRef
      }
    }));
  }, [createPeerConnection]);

  const handleAnswer = useCallback((participantId, answer) => {
    const peer = peers[participantId];
    if (peer && peer.pc) {
      peer.pc.setRemoteDescription(new RTCSessionDescription(answer))
        .catch(error => {
          console.error('Error setting remote description:', error);
        });
    }
  }, [peers]);

  const handleCandidate = useCallback((participantId, candidate) => {
    const peer = peers[participantId];
    if (peer && peer.pc) {
      peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(error => {
          console.error('Error adding ICE candidate:', error);
        });
    }
  }, [peers]);

  const replaceTrack = useCallback((participantId, newTrack) => {
    const peer = peers[participantId];
    if (peer && peer.pc && peer.pc.connectionState !== 'closed') {
      // Find all senders of the same track kind
      const senders = peer.pc.getSenders().filter(s => s.track && s.track.kind === newTrack.kind);
      
      if (senders.length > 0) {
        // Replace track in the first sender of this kind
        const sender = senders[0];
        if (newTrack) {
          sender.replaceTrack(newTrack).then(() => {
            console.log('Track replaced successfully for', participantId, newTrack.kind, newTrack.id);
          }).catch(error => {
            console.error('Error replacing track:', error);
          });
        } else {
          // If newTrack is null, stop the current track
          sender.replaceTrack(null).catch(error => {
            console.error('Error stopping track:', error);
          });
        }
      } else {
        // If no sender exists for this track kind, add the track
        console.log('No sender found for', newTrack.kind, '- adding track');
        if (newTrack) {
          peer.pc.addTrack(newTrack);
        }
      }
    } else {
      console.warn('Cannot replace track - peer connection not available or closed', participantId);
    }
  }, [peers]);

  const removePeer = useCallback((participantId) => {
    const peer = peers[participantId];
    if (peer && peer.pc) {
      peer.pc.close();
    }
    setPeers(prev => {
      const newPeers = { ...prev };
      delete newPeers[participantId];
      return newPeers;
    });
  }, [peers]);

  return {
    peers,
    addPeer,
    handleOffer,
    handleAnswer,
    handleCandidate,
    replaceTrack,
    removePeer
  };
}

