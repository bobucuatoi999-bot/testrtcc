import { useState, useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { SignalingMessage } from '../types';

export function useWebRTC(
  socket: Socket | null,
  roomId: string | null,
  userId: string | null,
  localStream: MediaStream | null
) {
  const [peers, setPeers] = useState<Map<string, RTCPeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turns:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
  };

  // Create offer for new peer
  const createOffer = useCallback(async (peerId: string) => {
    if (!socket || !roomId || !userId) {
      console.warn(`⚠️ Cannot create offer to ${peerId}: missing socket, roomId, or userId`);
      return;
    }

    // CRITICAL FIX: Check if peer connection already exists
    // Don't create duplicate connections!
    let pc = peersRef.current.get(peerId);
    
    if (pc) {
      // Peer connection already exists - check connection state
      const hasLocalDesc = !!pc.localDescription;
      const hasRemoteDesc = !!pc.remoteDescription;
      
      if (hasLocalDesc && hasRemoteDesc) {
        console.log(`✅ Peer connection to ${peerId} already established (${pc.connectionState}), skipping`);
        return;
      }
      
      if (hasLocalDesc && !hasRemoteDesc) {
        console.log(`⏳ Peer connection to ${peerId} has local description, waiting for answer...`);
        return;
      }
      
      if (!hasLocalDesc && hasRemoteDesc) {
        console.log(`⏳ Peer connection to ${peerId} has remote description (answerer), skipping offer`);
        return;
      }
      
      // Connection exists but no descriptions - this shouldn't happen, but reuse it
      console.log(`♻️ Reusing existing peer connection to ${peerId} (no descriptions yet)`);
    } else {
      // Create new peer connection only if it doesn't exist
      console.log(`🆕 Creating new peer connection to ${peerId}`);
      pc = new RTCPeerConnection(iceServers);

      // CRITICAL: Add local tracks FIRST, before creating offer
      // This ensures the offer includes our media tracks (sendrecv direction)
      if (localStream) {
        console.log(`🎥 Adding local tracks to peer connection for ${peerId}`);
        localStream.getTracks().forEach(track => {
          pc!.addTrack(track, localStream);
          console.log(`   Added ${track.kind} track: ${track.id} (enabled: ${track.enabled})`);
        });
      } else {
        // If no local media, ensure we can still receive remote by adding recvonly transceivers
        console.log(`📡 No local media - adding recvonly transceivers for ${peerId}`);
        try {
          pc!.addTransceiver('video', { direction: 'recvonly' });
          pc!.addTransceiver('audio', { direction: 'recvonly' });
          console.log(`   Added recvonly transceivers for video and audio`);
        } catch (e) {
          console.warn('⚠️ Failed to add recvonly transceivers:', e);
        }
      }

      // Handle remote tracks
      pc!.ontrack = (event) => {
        console.log(`📥 ontrack event from ${peerId}`, {
          streams: event.streams.length,
          tracks: event.track ? { kind: event.track.kind, id: event.track.id, enabled: event.track.enabled } : null,
        });
        
        const [remoteStream] = event.streams;
        if (remoteStream) {
          const videoTracks = remoteStream.getVideoTracks();
          const audioTracks = remoteStream.getAudioTracks();
          console.log(`✅ Received remote stream from ${peerId}`, {
            streamId: remoteStream.id,
            videoTracks: videoTracks.length,
            audioTracks: audioTracks.length,
            videoEnabled: videoTracks[0]?.enabled,
            audioEnabled: audioTracks[0]?.enabled,
          });
          
          const newStreams = new Map(remoteStreamsRef.current);
          newStreams.set(peerId, remoteStream);
          remoteStreamsRef.current = newStreams;
          setRemoteStreams(newStreams);
          
          // Log all current remote streams
          console.log(`📊 Total remote streams: ${newStreams.size}`, Array.from(newStreams.keys()));
        } else {
          console.warn(`⚠️ ontrack event but no stream found from ${peerId}`);
        }
      };

      // Handle ICE candidates
      pc!.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal', {
            type: 'ice-candidate',
            from: userId,
            to: peerId,
            roomId: roomId || undefined,
            data: event.candidate,
          });
        }
      };

      // Handle connection state changes
      pc!.onconnectionstatechange = () => {
        console.log(`📊 Peer connection to ${peerId} state: ${pc!.connectionState}`);
        if (pc!.connectionState === 'failed' || pc!.connectionState === 'disconnected') {
          const newPeers = new Map(peersRef.current);
          newPeers.delete(peerId);
          peersRef.current = newPeers;
          setPeers(newPeers);
          
          const newStreams = new Map(remoteStreamsRef.current);
          newStreams.delete(peerId);
          remoteStreamsRef.current = newStreams;
          setRemoteStreams(newStreams);
        } else if (pc!.connectionState === 'connected') {
          console.log(`✅ Peer connection to ${peerId} established!`);
        }
      };

      peersRef.current.set(peerId, pc);
      setPeers(new Map(peersRef.current));
    }

    // Only create offer if connection doesn't have a local description yet
    if (!pc.localDescription) {
      try {
        console.log(`📤 Creating offer to ${peerId}`);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('signal', {
          type: 'offer',
          from: userId,
          to: peerId,
          roomId: roomId || undefined,
          data: offer,
        });
        console.log(`✅ Offer sent to ${peerId}`);
      } catch (error) {
        console.error(`❌ Error creating offer to ${peerId}:`, error);
      }
    } else {
      console.log(`⚠️ Offer already created to ${peerId}, skipping`);
    }
  }, [socket, roomId, userId, localStream]);

  // Handle incoming signals
  const handleSignal = useCallback(async (message: SignalingMessage) => {
    if (!message.from || message.from === userId || !socket) {
      console.log(`⚠️ Ignoring signal: from=${message.from}, userId=${userId}, socket=${!!socket}`);
      return;
    }
    
    // Only process signals addressed to us (prevents misdelivery)
    // BUT: If message.to is undefined or empty, process it (backward compatibility)
    if (message.to && userId && message.to !== userId) {
      console.log(`⚠️ Ignoring signal not addressed to us: from=${message.from}, to=${message.to}, userId=${userId}`);
      return;
    }
    
    console.log(`📨 Processing signal from ${message.from}: type=${message.type}, to=${message.to || 'all'}`);

    let pc = peersRef.current.get(message.from);

    if (message.type === 'offer') {
      // Handle simultaneous offers (glare scenario) - should be rare with deterministic rule
      // If we already sent an offer to this peer, we should close it and become the answerer
      if (pc && pc.localDescription && pc.signalingState === 'have-local-offer') {
        console.log(`🔄 Simultaneous offer detected with ${message.from} - we already sent an offer`);
        console.log(`   Closing our outgoing offer - becoming answerer (deterministic rule: lower userId wins)`);
        // Close our outgoing offer and become the answerer
        // This shouldn't happen often with deterministic rule, but handle it gracefully
        pc.close();
        peersRef.current.delete(message.from);
        setPeers(new Map(peersRef.current));
        // Reset pc to undefined for new connection creation
        pc = undefined as any; // Type assertion needed as pc will be recreated below
      } else if (pc && pc.remoteDescription) {
        // We already received and processed an offer from this peer - ignore duplicate
        console.log(`⚠️ Already processed offer from ${message.from} - ignoring duplicate`);
        return;
      }

      if (!pc) {
        console.log(`📥 Received offer from ${message.from}, creating peer connection`);
        pc = new RTCPeerConnection(iceServers);

        // CRITICAL: Add local tracks FIRST, before processing the offer
        // This ensures we can send media back (bidirectional connection)
        if (localStream) {
          console.log(`🎥 Adding local tracks to peer connection for ${message.from}`);
          localStream.getTracks().forEach(track => {
            pc!.addTrack(track, localStream);
            console.log(`   Added ${track.kind} track: ${track.id} (enabled: ${track.enabled})`);
          });
        } else {
          // If no local media, ensure we can still receive remote by adding recvonly transceivers
          console.log(`📡 No local media - adding recvonly transceivers for ${message.from}`);
          try {
            pc!.addTransceiver('video', { direction: 'recvonly' });
            pc!.addTransceiver('audio', { direction: 'recvonly' });
            console.log(`   Added recvonly transceivers for video and audio`);
          } catch (e) {
            console.warn('⚠️ Failed to add recvonly transceivers:', e);
          }
        }

        // Handle remote tracks
        pc!.ontrack = (event) => {
          console.log(`📥 ontrack event from ${message.from}`, {
            streams: event.streams.length,
            tracks: event.track ? { kind: event.track.kind, id: event.track.id, enabled: event.track.enabled } : null,
          });
          
          const [remoteStream] = event.streams;
          if (remoteStream) {
            const videoTracks = remoteStream.getVideoTracks();
            const audioTracks = remoteStream.getAudioTracks();
            console.log(`✅ Received remote stream from ${message.from}`, {
              streamId: remoteStream.id,
              videoTracks: videoTracks.length,
              audioTracks: audioTracks.length,
              videoEnabled: videoTracks[0]?.enabled,
              audioEnabled: audioTracks[0]?.enabled,
            });
            
            const newStreams = new Map(remoteStreamsRef.current);
            newStreams.set(message.from, remoteStream);
            remoteStreamsRef.current = newStreams;
            setRemoteStreams(newStreams);
            
            // Log all current remote streams
            console.log(`📊 Total remote streams: ${newStreams.size}`, Array.from(newStreams.keys()));
          } else {
            console.warn(`⚠️ ontrack event but no stream found from ${message.from}`);
          }
        };

        // Handle ICE candidates
        pc!.onicecandidate = (event) => {
          if (event.candidate && socket) {
            socket.emit('signal', {
              type: 'ice-candidate',
              from: userId,
              to: message.from,
              roomId: message.roomId || roomId || undefined,
              data: event.candidate,
            });
          }
        };

        // Handle connection state changes
        pc!.onconnectionstatechange = () => {
          console.log(`📊 Peer connection to ${message.from} state: ${pc!.connectionState}`);
          if (pc!.connectionState === 'failed' || pc!.connectionState === 'disconnected') {
            const newPeers = new Map(peersRef.current);
            newPeers.delete(message.from);
            peersRef.current = newPeers;
            setPeers(newPeers);
            
            const newStreams = new Map(remoteStreamsRef.current);
            newStreams.delete(message.from);
            remoteStreamsRef.current = newStreams;
            setRemoteStreams(newStreams);
          } else if (pc!.connectionState === 'connected') {
            console.log(`✅ Peer connection to ${message.from} established!`);
          }
        };

        peersRef.current.set(message.from, pc);
        setPeers(new Map(peersRef.current));
      }

      if (pc) {
        try {
          // Check if we already set this remote description
          if (pc.remoteDescription && pc.remoteDescription.sdp === message.data.sdp) {
            console.log(`⚠️ Already processed this offer from ${message.from}`);
            return;
          }

          console.log(`📥 Setting remote description from ${message.from}`);
          await pc.setRemoteDescription(new RTCSessionDescription(message.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('signal', {
            type: 'answer',
            from: userId,
            to: message.from,
            roomId: message.roomId || roomId || undefined,
            data: answer,
          });
          console.log(`✅ Answer sent to ${message.from}`);

          // Flush any queued ICE candidates now that descriptions are set
          const queued = pendingCandidatesRef.current.get(message.from) || [];
          if (queued.length > 0) {
            console.log(`⏬ Flushing ${queued.length} queued ICE candidates for ${message.from}`);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (err) {
                console.log('⚠️ Failed to add queued candidate:', err);
              }
            }
            pendingCandidatesRef.current.delete(message.from);
          }
        } catch (error) {
          console.error(`❌ Error handling offer from ${message.from}:`, error);
        }
      }
    } else if (message.type === 'answer') {
      if (pc) {
        try {
          // Check if we already set this remote description
          if (pc.remoteDescription && pc.remoteDescription.sdp === message.data.sdp) {
            console.log(`⚠️ Already processed this answer from ${message.from}`);
            return;
          }

          console.log(`📥 Setting answer from ${message.from}`);
          await pc.setRemoteDescription(new RTCSessionDescription(message.data));
          console.log(`✅ Answer processed from ${message.from}`);

          // Flush any queued ICE candidates now that descriptions are set
          const queued = pendingCandidatesRef.current.get(message.from) || [];
          if (queued.length > 0) {
            console.log(`⏬ Flushing ${queued.length} queued ICE candidates for ${message.from}`);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (err) {
                console.log('⚠️ Failed to add queued candidate:', err);
              }
            }
            pendingCandidatesRef.current.delete(message.from);
          }
        } catch (error) {
          console.error(`❌ Error handling answer from ${message.from}:`, error);
        }
      } else {
        console.warn(`⚠️ Received answer from ${message.from} but no peer connection exists`);
      }
    } else if (message.type === 'ice-candidate') {
      if (pc) {
        try {
          // Only add ICE candidate if connection is ready
          if (pc.remoteDescription || pc.localDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(message.data));
          } else {
            // Store candidate for later (shouldn't happen often, but handle it)
            console.log(`⏳ Storing ICE candidate from ${message.from} for later`);
            const list = pendingCandidatesRef.current.get(message.from) || [];
            list.push(message.data);
            pendingCandidatesRef.current.set(message.from, list);
          }
        } catch (error) {
          // Ignore errors adding ICE candidates (often happens during connection setup)
          console.log(`⚠️ Could not add ICE candidate from ${message.from}:`, error);
        }
      } else {
        console.warn(`⚠️ Received ICE candidate from ${message.from} but no peer connection exists - queueing`);
        const list = pendingCandidatesRef.current.get(message.from) || [];
        list.push(message.data);
        pendingCandidatesRef.current.set(message.from, list);
      }
    }
  }, [socket, userId, localStream, roomId]);

  // Update peer connections when localStream changes
  useEffect(() => {
    if (localStream) {
      // Add tracks to existing peer connections
      peersRef.current.forEach((pc) => {
        localStream.getTracks().forEach(track => {
          // Check if track already added
          const senders = pc.getSenders();
          const hasTrack = senders.some(sender => sender.track?.id === track.id);
          if (!hasTrack) {
            pc.addTrack(track, localStream);
          }
        });
      });
    }
  }, [localStream]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      setScreenStream(stream);

      // Replace video track in all peer connections
      const videoTrack = stream.getVideoTracks()[0];
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Handle stop screen sharing
      videoTrack.onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }, []);

  // Stop screen sharing
  const stopScreenShare = useCallback(async () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);

      // Restore camera track
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          peersRef.current.forEach((pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }
      }
    }
  }, [screenStream, localStream]);

  // Cleanup
  useEffect(() => {
    return () => {
      peersRef.current.forEach(pc => pc.close());
      remoteStreamsRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [screenStream]);

  return {
    peers,
    remoteStreams,
    screenStream,
    createOffer,
    handleSignal,
    startScreenShare,
    stopScreenShare,
  };
}

