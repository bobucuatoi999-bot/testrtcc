// WebRTC Video Conferencing App - Vanilla JS
// Mesh architecture for up to 4 users

// Configuration
// In production, set window.API_URL before loading this script, or update this line
const API_URL = (() => {
  if (typeof window !== 'undefined' && window.API_URL) {
    return window.API_URL;
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  // Production: Update this to your Railway backend URL
  return 'https://testrtcc-production.up.railway.app';
})();

// STUN/TURN servers
const ICE_SERVERS = {
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
  iceCandidatePoolSize: 10,
};

// App state
let socket = null;
let roomId = null;
let userId = null;
let displayName = null;
let localStream = null;
let screenStream = null;
let peers = new Map(); // userId -> RTCPeerConnection
let remoteStreams = new Map(); // userId -> MediaStream
let users = new Map(); // userId -> { id, displayName, isAdmin }
let videoEnabled = true;
let audioEnabled = true;
let screenSharing = false;
let chatOpen = false;
let connectionRetries = new Map(); // userId -> retry timeout
let keepAliveIntervals = new Map(); // userId -> interval ID

// Initialize Socket.io connection
function initSocket() {
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  
  socket.on('connect', () => {
    console.log('✅ Connected to server:', socket.id);
    hideError();
  });
  
  socket.on('disconnect', (reason) => {
    console.warn('❌ Disconnected:', reason);
    if (reason !== 'io client disconnect') {
      showError('Disconnected from server. Reconnecting...');
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    showError('Failed to connect to server. Please check your connection.');
  });
  
  // Room events
  socket.on('room-created', handleRoomCreated);
  socket.on('room-joined', handleRoomJoined);
  socket.on('user-joined', handleUserJoined);
  socket.on('user-left', handleUserLeft);
  socket.on('room-closed', handleRoomClosed);
  socket.on('error', handleError);
  
  // Signaling events
  socket.on('signal', handleSignal);
  
  // Chat events
  socket.on('chat-message', handleChatMessage);
}

// Create room
async function createRoom() {
  const nameInput = document.getElementById('displayName');
  const passwordInput = document.getElementById('roomPassword');
  const btn = document.getElementById('createRoomBtn');
  
  const name = nameInput.value.trim();
  if (!name) {
    showError('Please enter your display name');
    return;
  }
  
  if (!socket || !socket.connected) {
    showError('Not connected to server. Please wait...');
    return;
  }
  
  // CRITICAL FIX: Get local media BEFORE joining room
  try {
    btn.disabled = true;
    btn.textContent = 'Getting camera...';
    
    await initLocalMedia(); // Get media first!
    
    btn.textContent = 'Creating...';
  } catch (error) {
    console.warn('⚠️ Could not get media, continuing without it:', error);
    // Continue without media
  }
  
  socket.emit('create-room', {
    displayName: name,
    password: passwordInput.value.trim() || undefined,
  });
}

// Join room
async function joinRoom() {
  const nameInput = document.getElementById('displayName');
  const roomIdInput = document.getElementById('roomId');
  const passwordInput = document.getElementById('joinPassword');
  const btn = document.getElementById('joinRoomBtn');
  
  const name = nameInput.value.trim();
  const room = roomIdInput.value.trim().toLowerCase();
  
  if (!name) {
    showError('Please enter your display name');
    return;
  }
  
  if (!room) {
    showError('Please enter a room ID');
    return;
  }
  
  if (!socket || !socket.connected) {
    showError('Not connected to server. Please wait...');
    return;
  }
  
  // CRITICAL FIX: Get local media BEFORE joining room
  try {
    btn.disabled = true;
    btn.textContent = 'Getting camera...';
    
    await initLocalMedia(); // Get media first!
    
    btn.textContent = 'Joining...';
  } catch (error) {
    console.warn('⚠️ Could not get media, continuing without it:', error);
    // Continue without media
  }
  
  socket.emit('join-room', {
    roomId: room,
    displayName: name,
    password: passwordInput.value.trim() || undefined,
  });
}

// Handle room created
function handleRoomCreated(data) {
  console.log('✅ Room created:', data);
  roomId = data.roomId;
  userId = data.userId;
  displayName = document.getElementById('displayName').value.trim();
  
  users.set(userId, {
    id: userId,
    displayName: displayName,
    isAdmin: true,
  });
  
  enterRoom();
}

// Handle room joined
async function handleRoomJoined(data) {
  console.log('✅ Room joined:', data);
  roomId = data.roomId;
  userId = data.userId;
  displayName = document.getElementById('displayName').value.trim();
  
  users.set(userId, {
    id: userId,
    displayName: displayName,
    isAdmin: false,
  });
  
  // Add existing users (support both 'existingUsers' and 'users' for compatibility)
  const existingUsers = data.existingUsers || data.users || [];
  existingUsers.forEach(user => {
    users.set(user.id || user.userId, {
      id: user.id || user.userId,
      displayName: user.displayName,
      isAdmin: user.isAdmin || false,
      socketId: user.socketId,
    });
  });
  
  // Load chat history
  if (data.chatHistory) {
    data.chatHistory.forEach(msg => {
      addChatMessage(msg);
    });
  }
  
  enterRoom();
  
  // CRITICAL FIX: Connect to ALL existing users
  // We're the new joiner, so WE initiate connections to existing users
  const existingUsers = data.existingUsers || data.users || [];
  for (const existingUser of existingUsers) {
    const peerId = existingUser.id || existingUser.userId;
    const socketId = existingUser.socketId;
    
    setTimeout(() => {
      connectToPeer(peerId, socketId, true); // We initiate (isInitiator = true)
    }, Math.random() * 300); // Small stagger to avoid overwhelming
  }
}

// Enter room UI
function enterRoom() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('room').classList.add('active');
  document.getElementById('roomIdDisplay').textContent = `Room: ${roomId}`;
  
  updateRoomInfo();
  updateVideoGrid();
  
  // Reset buttons
  document.getElementById('createRoomBtn').disabled = false;
  document.getElementById('createRoomBtn').textContent = 'Create New Room';
  document.getElementById('joinRoomBtn').disabled = false;
  document.getElementById('joinRoomBtn').textContent = 'Join Room';
}

// Handle user joined
async function handleUserJoined(data) {
  console.log('👤 User joined:', data.user);
  const newUser = data.user;
  
  users.set(newUser.id, newUser);
  addChatMessage(data.message);
  updateRoomInfo();
  updateVideoGrid();
  
  // CRITICAL FIX: When new user joins, existing users wait for their offer
  // The new user will initiate connection (they call connectToPeer with isInitiator=true)
  // We just wait for their offer signal
  console.log(`⏳ Waiting for ${newUser.displayName} to initiate connection`);
}

// Handle user left
function handleUserLeft(data) {
  console.log('👋 User left:', data.userId);
  
  // Close peer connection
  closePeerConnection(data.userId);
  
  users.delete(data.userId);
  addChatMessage(data.message);
  updateRoomInfo();
  updateVideoGrid();
}

// Handle room closed
function handleRoomClosed() {
  showError('Room has been closed');
  setTimeout(() => {
    leaveRoom();
  }, 2000);
}

// Handle error
function handleError(data) {
  console.error('❌ Error:', data.message);
  showError(data.message);
  
  // Reset buttons
  document.getElementById('createRoomBtn').disabled = false;
  document.getElementById('createRoomBtn').textContent = 'Create New Room';
  document.getElementById('joinRoomBtn').disabled = false;
  document.getElementById('joinRoomBtn').textContent = 'Join Room';
}

// Connect to peer (bidirectional mesh connection)
async function connectToPeer(peerId, peerSocketId, isInitiator = false) {
  // Don't connect to self
  if (peerId === userId) return;
  
  // Check if connection already exists
  if (peers.has(peerId)) {
    const pc = peers.get(peerId);
    if (pc.connectionState === 'connected' || pc.connectionState === 'connecting') {
      console.log(`✅ Connection to ${peerId} already exists`);
      return;
    }
    // Connection exists but is failed/disconnected - close and recreate
    console.log(`🔄 Recreating failed connection to ${peerId}`);
    closePeerConnection(peerId);
  }
  
  console.log(`🔌 Connecting to peer: ${peerId}, initiator: ${isInitiator}`);
  
  try {
    // Create peer connection
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peers.set(peerId, pc);
    
    // CRITICAL FIX: Always add local tracks if available
    // Media should be available by now (we get it before joining room)
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
        console.log(`📤 Added ${track.kind} track to ${peerId}`);
      });
    } else {
      console.warn('⚠️ No local stream available when creating peer connection');
      // If no local media, still create connection but may have issues
      // User should have media by now
    }
    
    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received ${event.track.kind} track from ${peerId}`);
      
      // CRITICAL FIX: Properly handle track events
      // Create or update stream for this peer
      let remoteStream = remoteStreams.get(peerId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreams.set(peerId, remoteStream);
      }
      
      // Add track to stream
      remoteStream.addTrack(event.track);
      
      console.log(`✅ Stream ready for ${peerId}:`, {
        videoTracks: remoteStream.getVideoTracks().length,
        audioTracks: remoteStream.getAudioTracks().length,
      });
      
      // Update UI
      updateVideoGrid();
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          type: 'ice-candidate',
          from: userId,
          to: peerId,
          roomId: roomId,
          data: event.candidate,
        });
      }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`📊 Connection to ${peerId}: ${pc.connectionState}`);
      
      if (pc.connectionState === 'connected') {
        // Clear any retry timeouts
        if (connectionRetries.has(peerId)) {
          clearTimeout(connectionRetries.get(peerId));
          connectionRetries.delete(peerId);
        }
        
        // Start keep-alive pings for recvonly connections
        startKeepAlive(peerId, pc);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        // Attempt reconnection
        attemptReconnect(peerId, peerSocketId);
      }
    };
    
    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection to ${peerId}: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        attemptReconnect(peerId, peerSocketId);
      }
    };
    
    // CRITICAL FIX: Connection order
    // - If we're joining an existing room, WE initiate (isInitiator = true)
    // - If someone joins after us, THEY initiate (we wait for their offer)
    if (isInitiator) {
      // We're the new joiner - we create offers to existing users
      console.log(`📤 Creating offer to ${peerId} (we're initiator)`);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);
      
      socket.emit('signal', {
        type: 'offer',
        from: userId,
        to: peerId,
        roomId: roomId,
        data: offer,
      });
    } else {
      // Someone joined after us - they will create the offer
      // We just wait for it (handled in handleSignal)
      console.log(`⏳ Waiting for offer from ${peerId}`);
    }
    
  } catch (error) {
    console.error(`❌ Error connecting to ${peerId}:`, error);
    showError(`Failed to connect to ${users.get(peerId)?.displayName || peerId}`);
  }
}

// Create offer to peer (fallback)
async function createOfferToPeer(peerId, pc) {
  try {
    if (pc.signalingState !== 'stable') {
      console.log(`⏳ Peer ${peerId} signaling state is ${pc.signalingState}, skipping offer`);
      return;
    }
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('signal', {
      type: 'offer',
      from: userId,
      to: peerId,
      roomId: roomId,
      data: offer,
    });
  } catch (error) {
    console.error(`❌ Error creating offer to ${peerId}:`, error);
  }
}

// Handle signaling
async function handleSignal(data) {
  const { type, from, to, data: signalData } = data;
  
  // Ignore signals not for us
  if (to && to !== userId) {
    return;
  }
  
  // Ignore signals from ourselves
  if (from === userId) {
    return;
  }
  
  console.log(`📨 Received signal from ${from}:`, type);
  
  let pc = peers.get(from);
  
  if (!pc) {
    // Create new peer connection
    console.log(`🆕 Creating peer connection for ${from}`);
    pc = new RTCPeerConnection(ICE_SERVERS);
    peers.set(from, pc);
    
    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    } else {
      // Add recvonly transceivers with dummy sender
      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });
      
      try {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0;
        oscillator.connect(gainNode);
        const destination = audioContext.createMediaStreamDestination();
        gainNode.connect(destination);
        oscillator.start();
        
        destination.stream.getAudioTracks().forEach(track => {
          pc.addTrack(track, destination.stream);
        });
      } catch (e) {
        console.warn('⚠️ Could not create dummy audio track:', e);
      }
    }
    
    // Setup event handlers
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${from}:`, event.track.kind);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        remoteStreams.set(from, remoteStream);
        updateVideoGrid();
      }
    };
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          type: 'ice-candidate',
          from: userId,
          to: from,
          roomId: roomId,
          data: event.candidate,
        });
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`📊 Connection to ${from}: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        if (connectionRetries.has(from)) {
          clearTimeout(connectionRetries.get(from));
          connectionRetries.delete(from);
        }
        startKeepAlive(from, pc);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const user = users.get(from);
        if (user && user.socketId) {
          attemptReconnect(from, user.socketId);
        }
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE connection to ${from}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        const user = users.get(from);
        if (user && user.socketId) {
          attemptReconnect(from, user.socketId);
        }
      }
    };
  }
  
  try {
    if (type === 'offer') {
      // Handle simultaneous offers (glare)
      if (pc.localDescription && pc.signalingState === 'have-local-offer') {
        console.log(`🔄 Simultaneous offer with ${from} - closing our offer`);
        pc.close();
        peers.delete(from);
        remoteStreams.delete(from);
        // Recreate connection
        const user = users.get(from);
        if (user && user.socketId) {
          connectToPeer(from, user.socketId);
        }
        return;
      }
      
      if (pc.remoteDescription) {
        console.log(`⚠️ Already have remote description from ${from}`);
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(signalData));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('signal', {
        type: 'answer',
        from: userId,
        to: from,
        roomId: roomId,
        data: answer,
      });
      
      console.log(`✅ Answer sent to ${from}`);
    } else if (type === 'answer') {
      if (pc.remoteDescription) {
        console.log(`⚠️ Already have answer from ${from}`);
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(signalData));
      console.log(`✅ Answer processed from ${from}`);
    } else if (type === 'ice-candidate') {
      if (pc.remoteDescription || pc.localDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData));
      }
    }
  } catch (error) {
    console.error(`❌ Error handling signal from ${from}:`, error);
  }
}

// Attempt reconnection
function attemptReconnect(peerId, peerSocketId) {
  if (connectionRetries.has(peerId)) {
    return; // Already retrying
  }
  
  console.log(`🔄 Attempting to reconnect to ${peerId} in 5 seconds...`);
  
  const timeout = setTimeout(() => {
    connectionRetries.delete(peerId);
    closePeerConnection(peerId);
    connectToPeer(peerId, peerSocketId);
  }, 5000);
  
  connectionRetries.set(peerId, timeout);
}

// Start keep-alive for recvonly connections
function startKeepAlive(peerId, pc) {
  if (keepAliveIntervals.has(peerId)) {
    return; // Already running
  }
  
  // Send periodic data channel messages to keep connection alive
  const interval = setInterval(() => {
    if (pc.connectionState === 'connected') {
      // Connection is alive
      return;
    }
    
    // Connection died - clear interval
    clearInterval(interval);
    keepAliveIntervals.delete(peerId);
  }, 10000); // Check every 10 seconds
  
  keepAliveIntervals.set(peerId, interval);
}

// Close peer connection
function closePeerConnection(peerId) {
  const pc = peers.get(peerId);
  if (pc) {
    pc.close();
    peers.delete(peerId);
  }
  
  remoteStreams.delete(peerId);
  
  if (connectionRetries.has(peerId)) {
    clearTimeout(connectionRetries.get(peerId));
    connectionRetries.delete(peerId);
  }
  
  if (keepAliveIntervals.has(peerId)) {
    clearInterval(keepAliveIntervals.get(peerId));
    keepAliveIntervals.delete(peerId);
  }
}

// Initialize local media (CRITICAL: Called BEFORE joining room)
async function initLocalMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 },
      audio: true,
    });
    
    localStream = stream;
    videoEnabled = stream.getVideoTracks()[0]?.enabled ?? true;
    audioEnabled = stream.getAudioTracks()[0]?.enabled ?? true;
    
    console.log('✅ Got local media:', {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length,
    });
    
    // Update UI
    updateControls();
    updateVideoGrid();
    
  } catch (error) {
    console.warn('⚠️ Could not get user media:', error);
    // Set to null but continue - user can join without media
    localStream = null;
    videoEnabled = false;
    audioEnabled = false;
    
    // Don't show error - just continue without media
    // User can still join and chat
  }
}

// Toggle audio
function toggleAudio() {
  if (!localStream) {
    showError('No audio stream available');
    return;
  }
  
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioEnabled = !audioEnabled;
    audioTrack.enabled = audioEnabled;
    updateControls();
  }
}

// Toggle video
function toggleVideo() {
  if (!localStream) {
    showError('No video stream available');
    return;
  }
  
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoEnabled = !videoEnabled;
    videoTrack.enabled = videoEnabled;
    updateControls();
  }
}

// Toggle screen share
async function toggleScreenShare() {
  try {
    if (screenSharing) {
      // Stop screen share
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
      }
      
      screenSharing = false;
      
      // Restore camera
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          peers.forEach((pc) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
            }
          });
        }
      }
    } else {
      // Start screen share
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      
      screenStream = stream;
      screenSharing = true;
      
      // Replace video track in all peer connections
      const videoTrack = stream.getVideoTracks()[0];
      peers.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Handle stop screen sharing
      videoTrack.onended = () => {
        toggleScreenShare();
      };
    }
    
    updateControls();
    updateVideoGrid();
  } catch (error) {
    console.error('❌ Screen share error:', error);
    showError('Failed to share screen: ' + error.message);
  }
}

// Update controls UI
function updateControls() {
  const audioBtn = document.getElementById('toggleAudio');
  const videoBtn = document.getElementById('toggleVideo');
  const screenBtn = document.getElementById('toggleScreen');
  
  audioBtn.classList.toggle('muted', !audioEnabled);
  videoBtn.classList.toggle('muted', !videoEnabled);
  screenBtn.classList.toggle('active', screenSharing);
}

// Update video grid
function updateVideoGrid() {
  const grid = document.getElementById('videoGrid');
  grid.innerHTML = '';
  
  // Add local user
  const localUser = users.get(userId);
  if (localUser) {
    const tile = createVideoTile(localUser, true);
    grid.appendChild(tile);
  }
  
  // Add remote users
  users.forEach((user, id) => {
    if (id !== userId) {
      const tile = createVideoTile(user, false);
      grid.appendChild(tile);
    }
  });
  
  // Fill remaining slots
  const remaining = 4 - users.size;
  for (let i = 0; i < remaining; i++) {
    const tile = document.createElement('div');
    tile.className = 'video-tile placeholder';
    tile.innerHTML = `
      <div class="avatar">+</div>
      <div class="name">Waiting for user...</div>
    `;
    grid.appendChild(tile);
  }
}

// Create video tile
function createVideoTile(user, isLocal) {
  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = `tile-${user.id}`;
  
  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal; // Mute local video to avoid feedback
  
  // Set stream
  if (isLocal) {
    const stream = screenSharing && screenStream ? screenStream : localStream;
    if (stream) {
      video.srcObject = stream;
    }
  } else {
    const remoteStream = remoteStreams.get(user.id);
    if (remoteStream) {
      video.srcObject = remoteStream;
    }
  }
  
  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="name-badge">${user.displayName}${user.isAdmin ? ' (Admin)' : ''}</div>
    <div class="status-badges">
      ${isLocal && !audioEnabled ? '<div class="status-badge muted">🎤</div>' : ''}
      ${isLocal && !videoEnabled ? '<div class="status-badge muted">📹</div>' : ''}
    </div>
  `;
  
  // If no stream, show placeholder
  if (!video.srcObject) {
    tile.classList.add('placeholder');
    tile.innerHTML = `
      <div class="avatar">${user.displayName.charAt(0).toUpperCase()}</div>
      <div class="name">${user.displayName}</div>
    `;
  } else {
    tile.appendChild(video);
    tile.appendChild(overlay);
  }
  
  return tile;
}

// Update room info
function updateRoomInfo() {
  const info = document.getElementById('roomInfo');
  info.textContent = `${users.size} / 4 participants`;
}

// Chat functions
function toggleChat() {
  chatOpen = !chatOpen;
  const sidebar = document.getElementById('chatSidebar');
  sidebar.style.display = chatOpen ? 'flex' : 'none';
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  
  if (!message || !socket) return;
  
  socket.emit('chat-message', {
    roomId: roomId,
    userId: userId,
    displayName: displayName,
    message: message,
  });
  
  input.value = '';
}

function handleChatKeyPress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

function handleChatMessage(message) {
  addChatMessage(message);
}

function addChatMessage(message) {
  const container = document.getElementById('chatMessages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${message.type}`;
  
  if (message.type === 'system') {
    msgDiv.textContent = message.message;
  } else {
    msgDiv.innerHTML = `
      <div class="sender">${message.displayName}</div>
      <div class="text">${message.message}</div>
    `;
  }
  
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Copy room link
function copyRoomLink() {
  const link = `${window.location.origin}?room=${roomId}`;
  navigator.clipboard.writeText(link).then(() => {
    alert('Room link copied to clipboard!');
  });
}

// Leave room
function leaveRoom() {
  if (socket && roomId && userId) {
    socket.emit('leave-room', {
      roomId: roomId,
      userId: userId,
    });
  }
  
  // Stop all streams
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  
  // Close all peer connections
  peers.forEach((pc, peerId) => {
    closePeerConnection(peerId);
  });
  
  // Reset state
  roomId = null;
  userId = null;
  displayName = null;
  peers.clear();
  remoteStreams.clear();
  users.clear();
  videoEnabled = true;
  audioEnabled = true;
  screenSharing = false;
  
  // Reset UI
  document.getElementById('landing').style.display = 'flex';
  document.getElementById('room').classList.remove('active');
  document.getElementById('chatMessages').innerHTML = '';
  document.getElementById('videoGrid').innerHTML = '';
}

// Show error
function showError(message) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Hide error
function hideError() {
  document.getElementById('error').style.display = 'none';
}

// Check for room in URL
window.addEventListener('DOMContentLoaded', () => {
  initSocket();
  
  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    document.getElementById('roomId').value = roomParam;
  }
});

