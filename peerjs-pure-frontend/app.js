// Global variables
let peer = null;
let localStream = null;
let screenStream = null;
let connections = new Map(); // peerId -> { connection, call, stream, userName }
let currentRoomId = null;
let userName = '';
let isVideoEnabled = true;
let isAudioEnabled = true;
let isSharingScreen = false;
let isRoomHost = false;

// Initialize PeerJS with free PeerServer Cloud
function initializePeer(roomId = null) {
    return new Promise((resolve, reject) => {
        // Create peer with free PeerServer Cloud
        // If roomId provided, use it as peer ID (room host)
        // Otherwise, let PeerJS generate one
        peer = new Peer(roomId, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            config: {
                iceServers: [
                    // Google STUN servers
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    // Open Relay TURN servers (free)
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
                ],
                iceTransportPolicy: 'all',
                iceCandidatePoolSize: 10,
            },
            debug: 2,
        });
        
        peer.on('open', (id) => {
            console.log('✅ My peer ID:', id);
            resolve(id);
        });
        
        peer.on('error', (error) => {
            console.error('❌ Peer error:', error);
            if (error.type === 'peer-unavailable') {
                // Peer ID taken, generate new one
                console.log('⚠️ Peer ID unavailable, generating new one...');
                peer.destroy();
                initializePeer().then(resolve).catch(reject);
            } else {
                reject(error);
            }
        });
        
        // Handle incoming connections (for signaling)
        peer.on('connection', (conn) => {
            console.log('📥 Incoming connection from:', conn.peer);
            handleIncomingConnection(conn);
        });
        
        // Handle incoming calls (for media)
        peer.on('call', (call) => {
            console.log('📞 Incoming call from:', call.peer);
            handleIncomingCall(call);
        });
    });
}

// Generate unique room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 10).toLowerCase();
}

// Create room
async function createRoom() {
    try {
        userName = document.getElementById('user-name').value.trim();
        if (!userName) {
            alert('Please enter your name');
            return;
        }
        
        // Generate room ID
        currentRoomId = generateRoomId();
        isRoomHost = true;
        
        // Initialize peer with room ID as peer ID
        const peerId = await initializePeer(currentRoomId);
        
        // Get local media
        await getLocalStream();
        
        // Show call screen
        showCallScreen();
        
        console.log('✅ Room created:', currentRoomId, 'Peer ID:', peerId);
        
    } catch (error) {
        console.error('❌ Error creating room:', error);
        alert('Failed to create room. Please check camera/microphone permissions.');
    }
}

// Join room
async function joinRoom() {
    try {
        userName = document.getElementById('user-name').value.trim();
        const roomId = document.getElementById('room-id-input').value.trim().toLowerCase();
        
        if (!userName) {
            alert('Please enter your name');
            return;
        }
        
        if (!roomId) {
            alert('Please enter room ID');
            return;
        }
        
        currentRoomId = roomId;
        isRoomHost = false;
        
        // Initialize peer (let PeerJS generate ID)
        const peerId = await initializePeer();
        
        // Get local media
        await getLocalStream();
        
        // Show call screen
        showCallScreen();
        
        // Connect to room host (room ID = host's peer ID)
        await connectToPeer(roomId);
        
        console.log('✅ Joined room:', currentRoomId, 'My Peer ID:', peerId);
        
    } catch (error) {
        console.error('❌ Error joining room:', error);
        alert('Failed to join room. Please check the room ID and camera/microphone permissions.');
    }
}

// Get local media stream
async function getLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
            },
        });
        
        // Display local video
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        console.log('✅ Local stream obtained');
        
    } catch (error) {
        console.error('❌ Error getting local stream:', error);
        throw error;
    }
}

// Connect to peer (mesh topology)
async function connectToPeer(peerId) {
    try {
        // Don't connect to self
        if (peerId === peer.id) {
            return;
        }
        
        // Check if already connected
        if (connections.has(peerId)) {
            console.log('⚠️ Already connected to:', peerId);
            return;
        }
        
        console.log('🔗 Connecting to peer:', peerId);
        
        // Create data connection for signaling
        const conn = peer.connect(peerId, {
            metadata: { 
                userName: userName,
                peerId: peer.id,
                roomId: currentRoomId,
            },
            reliable: true,
        });
        
        if (!conn) {
            console.error('❌ Failed to create connection to:', peerId);
            return;
        }
        
        // Store connection
        connections.set(peerId, {
            connection: conn,
            userName: 'User',
        });
        
        conn.on('open', () => {
            console.log('✅ Data connection opened with:', peerId);
            
            // Send user info
            conn.send({
                type: 'user-info',
                userName: userName,
                peerId: peer.id,
            });
            
            // Request participant list from host
            if (isRoomHost) {
                // We're the host, send our participant list
                sendParticipantList(conn);
            } else {
                // Request participant list
                conn.send({
                    type: 'request-participants',
                });
            }
            
            // Call the peer with our stream
            const call = peer.call(peerId, localStream, {
                metadata: { 
                    userName: userName,
                    peerId: peer.id,
                },
            });
            
            if (call) {
                handleOutgoingCall(call, peerId);
            } else {
                console.error('❌ Failed to create call to:', peerId);
            }
        });
        
        conn.on('data', (data) => {
            handleIncomingData(data, peerId);
        });
        
        conn.on('error', (error) => {
            console.error('❌ Connection error with', peerId, ':', error);
        });
        
        conn.on('close', () => {
            console.log('Connection closed:', peerId);
            removeRemoteVideo(peerId);
        });
        
    } catch (error) {
        console.error('❌ Error connecting to peer:', error);
    }
}

// Send participant list
function sendParticipantList(conn) {
    const participants = Array.from(connections.keys()).filter(id => id !== conn.peer);
    conn.send({
        type: 'participant-list',
        participants: participants,
    });
}

// Handle incoming connection
function handleIncomingConnection(conn) {
    conn.on('open', () => {
        console.log('✅ Accepted connection from:', conn.peer);
        
        // Store connection
        if (!connections.has(conn.peer)) {
            connections.set(conn.peer, {});
        }
        connections.get(conn.peer).connection = conn;
        
        // If we're the host, send participant list
        if (isRoomHost) {
            sendParticipantList(conn);
        }
    });
    
    conn.on('data', (data) => {
        handleIncomingData(data, conn.peer);
    });
    
    conn.on('error', (error) => {
        console.error('❌ Connection error from', conn.peer, ':', error);
    });
    
    conn.on('close', () => {
        removeRemoteVideo(conn.peer);
    });
}

// Handle incoming call
function handleIncomingCall(call) {
    console.log('📞 Answering call from:', call.peer);
    
    // Answer with our local stream
    call.answer(localStream);
    
    call.on('stream', (remoteStream) => {
        console.log('✅ Received stream from:', call.peer);
        
        // Store call and stream
        if (!connections.has(call.peer)) {
            connections.set(call.peer, {});
        }
        const peerData = connections.get(call.peer);
        peerData.call = call;
        peerData.stream = remoteStream;
        
        // Get user name from metadata or stored data
        const userName = call.metadata?.userName || peerData.userName || 'User';
        
        // Display remote video
        addRemoteVideo(call.peer, remoteStream, userName);
    });
    
    call.on('close', () => {
        console.log('Call closed:', call.peer);
        removeRemoteVideo(call.peer);
    });
    
    call.on('error', (error) => {
        console.error('❌ Call error from', call.peer, ':', error);
    });
}

// Handle outgoing call
function handleOutgoingCall(call, peerId) {
    call.on('stream', (remoteStream) => {
        console.log('✅ Received stream from:', call.peer);
        
        // Store call and stream
        const peerData = connections.get(peerId);
        if (peerData) {
            peerData.call = call;
            peerData.stream = remoteStream;
            
            // Get user name
            const userName = call.metadata?.userName || peerData.userName || 'User';
            
            // Display remote video
            addRemoteVideo(peerId, remoteStream, userName);
        }
    });
    
    call.on('close', () => {
        removeRemoteVideo(peerId);
    });
    
    call.on('error', (error) => {
        console.error('❌ Call error to', peerId, ':', error);
    });
}

// Handle incoming data messages
function handleIncomingData(data, peerId) {
    console.log('📨 Data from', peerId, ':', data);
    
    const peerData = connections.get(peerId);
    
    switch (data.type) {
        case 'user-info':
            // Update user info
            if (peerData) {
                peerData.userName = data.userName;
                // Update video label if exists
                const label = document.querySelector(`#wrapper-${peerId} .video-label`);
                if (label) {
                    label.textContent = data.userName;
                }
            }
            break;
            
        case 'participant-list':
            // Connect to all existing participants (mesh topology)
            console.log('📋 Connecting to participants:', data.participants);
            data.participants.forEach(participantId => {
                if (participantId !== peer.id && !connections.has(participantId)) {
                    setTimeout(() => {
                        connectToPeer(participantId);
                    }, Math.random() * 1000); // Stagger connections
                }
            });
            break;
            
        case 'request-participants':
            // Send our participant list
            if (isRoomHost && peerData?.connection) {
                sendParticipantList(peerData.connection);
            }
            break;
            
        case 'screen-share-start':
            console.log('User started screen sharing:', peerId);
            break;
            
        case 'screen-share-stop':
            console.log('User stopped screen sharing:', peerId);
            break;
    }
}

// Add remote video
function addRemoteVideo(peerId, stream, userName) {
    // Check if already exists
    if (document.getElementById(`video-${peerId}`)) {
        const existingVideo = document.getElementById(`video-${peerId}`);
        existingVideo.srcObject = stream;
        return;
    }
    
    // Check max participants (4 total including local)
    const currentCount = document.querySelectorAll('.video-wrapper').length;
    if (currentCount >= 4) {
        console.warn('⚠️ Room is full (4 participants max)');
        return;
    }
    
    const videoContainer = document.getElementById('video-container');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.id = `wrapper-${peerId}`;
    
    const video = document.createElement('video');
    video.id = `video-${peerId}`;
    video.autoplay = true;
    video.playsinline = true;
    video.srcObject = stream;
    
    // Handle video errors
    video.onerror = (e) => {
        console.error(`Video error for ${peerId}:`, e);
    };
    
    video.onloadedmetadata = () => {
        video.play().catch(err => {
            console.error(`Failed to play video for ${peerId}:`, err);
        });
    };
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = userName;
    
    wrapper.appendChild(video);
    wrapper.appendChild(label);
    videoContainer.appendChild(wrapper);
    
    updateParticipantCount();
    
    console.log('✅ Added remote video for:', peerId, userName);
}

// Remove remote video
function removeRemoteVideo(peerId) {
    const wrapper = document.getElementById(`wrapper-${peerId}`);
    if (wrapper) {
        wrapper.remove();
    }
    
    connections.delete(peerId);
    updateParticipantCount();
    
    console.log('🗑️ Removed video for:', peerId);
}

// Update participant count
function updateParticipantCount() {
    const count = connections.size + 1; // +1 for local user
    document.getElementById('participant-count').textContent = 
        `${count} participant${count > 1 ? 's' : ''}`;
}

// Toggle video
function toggleVideo() {
    isVideoEnabled = !isVideoEnabled;
    
    const videoTrack = localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = isVideoEnabled;
    }
    
    const btn = document.getElementById('toggle-video-btn');
    btn.textContent = isVideoEnabled ? '📹' : '📹❌';
    btn.classList.toggle('disabled', !isVideoEnabled);
    
    console.log('Video:', isVideoEnabled ? 'enabled' : 'disabled');
}

// Toggle audio
function toggleAudio() {
    isAudioEnabled = !isAudioEnabled;
    
    const audioTrack = localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = isAudioEnabled;
    }
    
    const btn = document.getElementById('toggle-audio-btn');
    btn.textContent = isAudioEnabled ? '🎤' : '🎤❌';
    btn.classList.toggle('disabled', !isAudioEnabled);
    
    console.log('Audio:', isAudioEnabled ? 'enabled' : 'disabled');
}

// Share screen
async function shareScreen() {
    try {
        if (isSharingScreen) {
            stopScreenShare();
            return;
        }
        
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
            },
            audio: true,
        });
        
        isSharingScreen = true;
        
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace video track in all calls
        connections.forEach(({ call }) => {
            if (call && call.peerConnection) {
                const sender = call.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            }
        });
        
        // Update local video
        document.getElementById('local-video').srcObject = screenStream;
        
        // Update button
        document.getElementById('share-screen-btn').textContent = '🛑 Stop Sharing';
        
        // Handle screen share stop
        screenTrack.onended = () => {
            stopScreenShare();
        };
        
        // Notify others
        broadcastMessage({ type: 'screen-share-start' });
        
        console.log('✅ Screen sharing started');
        
    } catch (error) {
        console.error('❌ Error sharing screen:', error);
        if (error.name !== 'NotAllowedError') {
            alert('Failed to share screen. Please try again.');
        }
    }
}

// Stop screen share
function stopScreenShare() {
    if (!isSharingScreen) return;
    
    // Stop screen stream
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    isSharingScreen = false;
    
    // Restore camera track
    const videoTrack = localStream?.getVideoTracks()[0];
    
    if (videoTrack) {
        connections.forEach(({ call }) => {
            if (call && call.peerConnection) {
                const sender = call.peerConnection
                    .getSenders()
                    .find(s => s.track && s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            }
        });
        
        // Restore local video
        document.getElementById('local-video').srcObject = localStream;
    }
    
    // Update button
    document.getElementById('share-screen-btn').textContent = '🖥️ Share Screen';
    
    // Notify others
    broadcastMessage({ type: 'screen-share-stop' });
    
    console.log('🛑 Screen sharing stopped');
}

// Broadcast message to all peers
function broadcastMessage(message) {
    connections.forEach(({ connection }) => {
        if (connection && connection.open) {
            try {
                connection.send(message);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        }
    });
}

// Copy room link
function copyRoomLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    
    navigator.clipboard.writeText(link).then(() => {
        alert('Room link copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback
        prompt('Copy this link:', link);
    });
}

// Leave call
function leaveCall() {
    // Close all connections
    connections.forEach(({ connection, call }) => {
        if (connection) {
            try {
                connection.close();
            } catch (e) {
                console.warn('Error closing connection:', e);
            }
        }
        if (call) {
            try {
                call.close();
            } catch (e) {
                console.warn('Error closing call:', e);
            }
        }
    });
    connections.clear();
    
    // Stop streams
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    // Destroy peer
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    // Reset state
    currentRoomId = null;
    isRoomHost = false;
    isSharingScreen = false;
    
    // Reset UI
    showHomeScreen();
    
    console.log('📞 Left call');
}

// Show call screen
function showCallScreen() {
    document.getElementById('home-screen').classList.remove('active');
    document.getElementById('call-screen').classList.add('active');
    
    document.getElementById('room-id-display').textContent = `Room: ${currentRoomId}`;
    updateParticipantCount();
}

// Show home screen
function showHomeScreen() {
    document.getElementById('call-screen').classList.remove('active');
    document.getElementById('home-screen').classList.add('active');
    
    // Clear remote videos
    const videoContainer = document.getElementById('video-container');
    const remoteVideos = videoContainer.querySelectorAll('.video-wrapper:not(#local-video-container)');
    remoteVideos.forEach(v => v.remove());
}

// Event listeners
document.getElementById('create-room-btn').addEventListener('click', createRoom);
document.getElementById('join-room-btn').addEventListener('click', joinRoom);
document.getElementById('toggle-video-btn').addEventListener('click', toggleVideo);
document.getElementById('toggle-audio-btn').addEventListener('click', toggleAudio);
document.getElementById('share-screen-btn').addEventListener('click', shareScreen);
document.getElementById('copy-link-btn').addEventListener('click', copyRoomLink);
document.getElementById('leave-call-btn').addEventListener('click', leaveCall);

// Check for room in URL
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        document.getElementById('room-id-input').value = roomId;
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    leaveCall();
});

console.log('✅ App initialized');

