// ============================================
// WebRTC Client - Video and Voice Call Logic
// Uses PeerJS for peer connections with Socket.io signaling
// ============================================

// ============================================
// Global Variables
// ============================================
let socket = null;              // Socket.io connection
let peer = null;                // PeerJS peer instance
let localStream = null;         // Local media stream (camera/mic)
let screenStream = null;        // Screen share stream
let isMuted = false;            // Mute state
let isCameraOff = false;        // Camera off state
let isSharingScreen = false;   // Screen sharing state
let currentRoomId = null;       // Currently joined room ID
let userName = null;            // User's name
let myPeerId = null;             // My PeerJS ID

// Multi-user support: Map of remote peers
// Format: { socketId: { peerId, userName, call, stream, videoElement, videoWrapper, videoLabel } }
let remotePeers = new Map();

// Maximum users per room
const MAX_USERS = 7;

// ============================================
// Server Configuration
// ============================================
// Get server URL from config.js (set for Railway deployment)
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// WebRTC Configuration with FREE STUN and TURN servers
// Google STUN servers (free) + OpenRelay TURN server (free)
const rtcConfig = {
    iceServers: [
        // Free Google STUN servers
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        // Free TURN server (OpenRelay - no auth required)
        { 
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 10
};

// ============================================
// DOM Elements
// ============================================
let videoContainer = null;
let localVideo = null;
let localVideoWrapper = null;
let localVideoLabel = null;
const nameInput = document.getElementById('nameInput');
const roomIdInput = document.getElementById('roomIdInput');
const startVideoBtn = document.getElementById('startVideoBtn');
const startVoiceBtn = document.getElementById('startVoiceBtn');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const endCallBtn = document.getElementById('endCallBtn');
const statusDiv = document.getElementById('status');

// ============================================
// Utility Functions
// ============================================

/**
 * Display status message to user
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', or 'error'
 */
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

/**
 * Enable or disable UI buttons based on call state
 * @param {boolean} inCall - Whether user is currently in a call
 */
function updateUI(inCall) {
    startVideoBtn.disabled = inCall;
    startVoiceBtn.disabled = inCall;
    muteBtn.disabled = !inCall;
    cameraBtn.disabled = !inCall;
    screenShareBtn.disabled = !inCall;
    endCallBtn.disabled = !inCall;
    nameInput.disabled = inCall;
    roomIdInput.disabled = inCall;
}

/**
 * Create a video element for a remote user
 * @param {string} socketId - Socket ID of the remote user
 * @param {string} userName - Name of the remote user
 * @returns {Object} Object containing video element, wrapper, and label
 */
function createRemoteVideoElement(socketId, userName) {
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.dataset.socketId = socketId;
    
    // Create label
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = userName || 'User';
    wrapper.appendChild(label);
    
    // Create video element
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.id = `remote-video-${socketId}`;
    wrapper.appendChild(video);
    
    // Add to container
    videoContainer.appendChild(wrapper);
    
    return { videoElement: video, videoWrapper: wrapper, videoLabel: label };
}

/**
 * Remove a remote video element
 * @param {string} socketId - Socket ID of the remote user
 */
function removeRemoteVideoElement(socketId) {
    const peerData = remotePeers.get(socketId);
    if (peerData && peerData.videoWrapper) {
        // Stop video stream
        if (peerData.videoElement && peerData.videoElement.srcObject) {
            peerData.videoElement.srcObject.getTracks().forEach(track => track.stop());
            peerData.videoElement.srcObject = null;
        }
        // Remove from DOM
        peerData.videoWrapper.remove();
    }
}

/**
 * Update video grid layout based on number of users
 */
function updateVideoGrid() {
    if (!videoContainer) return;
    
    const totalUsers = 1 + remotePeers.size; // 1 local + remote users
    let gridColumns;
    
    if (totalUsers <= 2) {
        gridColumns = 2;
    } else if (totalUsers <= 4) {
        gridColumns = 2;
    } else if (totalUsers <= 6) {
        gridColumns = 3;
    } else {
        gridColumns = 3; // Max 7 users = 3 columns
    }
    
    videoContainer.style.gridTemplateColumns = `repeat(${gridColumns}, 1fr)`;
}

/**
 * Clean up a specific remote peer connection
 * @param {string} socketId - Socket ID of the peer to clean up
 */
function cleanupRemotePeer(socketId) {
    const peerData = remotePeers.get(socketId);
    if (!peerData) return;
    
    // Close call
    if (peerData.call) {
        try {
            peerData.call.close();
        } catch (e) {
            console.warn('Error closing call:', e);
        }
    }
    
    // Stop stream tracks
    if (peerData.stream) {
        peerData.stream.getTracks().forEach(track => track.stop());
    }
    
    // Remove video element
    removeRemoteVideoElement(socketId);
    
    // Remove from map
    remotePeers.delete(socketId);
    
    // Update grid
    updateVideoGrid();
}

/**
 * Clean up all remote connections (user stays in room)
 */
function cleanupAllRemotePeers() {
    const socketIds = Array.from(remotePeers.keys());
    socketIds.forEach(socketId => cleanupRemotePeer(socketId));
}

/**
 * Clean up all media streams and connections (full cleanup)
 */
function cleanup() {
    // Clean up all remote peers
    cleanupAllRemotePeers();
    
    // Stop local stream tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        localStream = null;
    }

    // Stop screen share stream
    if (screenStream) {
        screenStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        screenStream = null;
    }

    // Destroy peer connection
    if (peer) {
        peer.destroy();
        peer = null;
    }

    // Clear local video
    if (localVideo && localVideo.srcObject) {
        localVideo.srcObject = null;
    }

    // Reset state
    myPeerId = null;
    currentRoomId = null;
    isMuted = false;
    isCameraOff = false;
    isSharingScreen = false;

    // Leave room on server
    if (socket && socket.connected && currentRoomId) {
        socket.emit('leave-room', { roomId: currentRoomId });
    }

    // Reset local video label
    if (localVideoLabel) {
        localVideoLabel.textContent = 'Your Video';
    }

    updateUI(false);
    showStatus('Call ended. Ready for new call.', 'info');
}

// ============================================
// Socket.io Connection Setup
// ============================================

/**
 * Initialize Socket.io connection to signaling server
 */
function initializeSocket() {
    try {
        socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => {
            console.log('✅ Connected to signaling server');
            showStatus('Connected to server', 'success');
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from signaling server');
            showStatus('Disconnected from server. Reconnecting...', 'error');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            showStatus('Connection failed. Please check your internet and refresh.', 'error');
        });

        // Handle room joined event
        socket.on('room-joined', (data) => {
            console.log('✅ Joined room:', data.roomId, `(${data.userCount}/${data.maxUsers} users)`);
            currentRoomId = data.roomId;
            if (data.userCount >= data.maxUsers) {
                showStatus(`Room is full (${data.userCount}/${data.maxUsers})`, 'info');
            }
        });

        // Handle room updated (user count changes)
        socket.on('room-updated', (data) => {
            console.log(`📊 Room updated: ${data.userCount}/${data.maxUsers} users`);
            if (data.userCount >= data.maxUsers) {
                showStatus(`Room is full (${data.userCount}/${data.maxUsers})`, 'info');
            }
        });

        // Handle existing users in room (when joining)
        socket.on('room-users', (data) => {
            console.log('👥 Users in room:', data.users);
            if (data.users && data.users.length > 0) {
                // Connect to each existing user
                data.users.forEach(userData => {
                    if (userData.peerId && myPeerId) {
                        // Create video element for this user
                        const videoElements = createRemoteVideoElement(userData.socketId, userData.userName);
                        remotePeers.set(userData.socketId, {
                            peerId: userData.peerId,
                            userName: userData.userName || 'User',
                            call: null,
                            stream: null,
                            videoElement: videoElements.videoElement,
                            videoWrapper: videoElements.videoWrapper,
                            videoLabel: videoElements.videoLabel
                        });
                        
                        // Connect to this peer
                        setTimeout(() => {
                            connectToUser(userData.peerId, userData.socketId);
                        }, 500);
                    }
                });
                updateVideoGrid();
            }
        });

        // Handle new user joining
        socket.on('user-joined', (data) => {
            console.log('👤 New user joined:', data.userId, data.userName);
            const userName = data.userName || 'User';
            
            // If we already have this peer, update the name
            if (remotePeers.has(data.userId)) {
                const peerData = remotePeers.get(data.userId);
                peerData.userName = userName;
                if (peerData.videoLabel) {
                    peerData.videoLabel.textContent = userName;
                }
            } else {
                // Create a temporary entry with user name (will be updated when peer-id arrives)
                // We'll create the video element when peer-id arrives, but store the name now
                // This is handled by checking if entry exists when peer-id arrives
            }
        });

        // Handle PeerJS ID exchange
        socket.on('peer-id', (data) => {
            console.log('🔑 Received PeerJS ID:', data.peerId, 'from socket:', data.socketId);
            if (data.peerId && data.socketId && myPeerId) {
                // Check if we already have this peer
                if (!remotePeers.has(data.socketId)) {
                    // Create video element for this user
                    const videoElements = createRemoteVideoElement(data.socketId, 'User');
                    remotePeers.set(data.socketId, {
                        peerId: data.peerId,
                        userName: 'User', // Will be updated when we get user info
                        call: null,
                        stream: null,
                        videoElement: videoElements.videoElement,
                        videoWrapper: videoElements.videoWrapper,
                        videoLabel: videoElements.videoLabel
                    });
                    updateVideoGrid();
                } else {
                    // Update peer ID and user name if available
                    const peerData = remotePeers.get(data.socketId);
                    if (peerData) {
                        peerData.peerId = data.peerId;
                        // Update label if we have user name
                        if (peerData.videoLabel && peerData.userName) {
                            peerData.videoLabel.textContent = peerData.userName;
                        }
                    }
                }
                
                // Connect to this peer
                setTimeout(() => {
                    connectToUser(data.peerId, data.socketId);
                }, 500);
            }
        });

        // Handle user leaving
        socket.on('user-left', (data) => {
            console.log('👋 User left:', data.userId, `(${data.userCount}/${data.maxUsers} remaining)`);
            if (remotePeers.has(data.userId)) {
                cleanupRemotePeer(data.userId);
                showStatus(`User left. ${data.userCount}/${data.maxUsers} users in room.`, 'info');
            }
        });

        // Handle call ended (by another user)
        socket.on('call-ended', (data) => {
            console.log('📴 Call ended by user:', data.userId);
            if (remotePeers.has(data.userId)) {
                cleanupRemotePeer(data.userId);
                showStatus('User ended their call. You can stay and wait for others...', 'info');
            }
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error('❌ Server error:', error);
            showStatus(error.message || 'Server error occurred', 'error');
        });

    } catch (error) {
        console.error('❌ Error initializing socket:', error);
        showStatus('Failed to connect to server. Please refresh the page.', 'error');
    }
}

// ============================================
// PeerJS Initialization
// ============================================

/**
 * Initialize PeerJS peer connection
 */
function initializePeer() {
    try {
        // Create PeerJS instance with custom ICE servers
        peer = new Peer({
            config: rtcConfig,
            debug: 2 // Enable debug logging
        });

        peer.on('open', (id) => {
            console.log('✅ PeerJS connected. My ID:', id);
            myPeerId = id;
            showStatus('Ready to connect', 'success');
            
            // Send my PeerJS ID to server so others can connect
            if (socket && socket.connected && currentRoomId) {
                socket.emit('peer-id', {
                    roomId: currentRoomId,
                    peerId: id
                });
            }
        });

        peer.on('error', (error) => {
            console.error('❌ PeerJS error:', error);
            
            // Handle specific errors
            if (error.type === 'peer-unavailable') {
                showStatus('Peer unavailable. Waiting for user to join...', 'info');
            } else if (error.type === 'network') {
                showStatus('Network error. Trying to reconnect...', 'error');
                // Attempt to reconnect
                setTimeout(() => {
                    if (!peer || peer.destroyed) {
                        initializePeer();
                    }
                }, 2000);
            } else {
                showStatus('Connection error: ' + error.message, 'error');
            }
        });

        // Handle incoming calls (for multiple users)
        peer.on('call', (call) => {
            console.log('📞 Incoming call from PeerJS ID:', call.peer);
            
            // Find which socket ID this peer ID belongs to
            let targetSocketId = null;
            for (const [socketId, peerData] of remotePeers.entries()) {
                if (peerData.peerId === call.peer) {
                    targetSocketId = socketId;
                    break;
                }
            }
            
            // If we don't know this peer yet, try to find it or create entry
            if (!targetSocketId) {
                console.warn('⚠️ Received call from unknown peer:', call.peer);
                // Answer anyway - we'll handle it when we get the socket ID
            }
            
            // Answer the call with local stream (if available)
            const streamToSend = localStream || new MediaStream();
            call.answer(streamToSend);

            // Handle remote stream
            call.on('stream', (stream) => {
                console.log('✅ Received remote stream from PeerJS ID:', call.peer);
                
                // Find or create peer entry
                if (targetSocketId && remotePeers.has(targetSocketId)) {
                    const peerData = remotePeers.get(targetSocketId);
                    peerData.call = call;
                    peerData.stream = stream;
                    peerData.videoElement.srcObject = stream;
                    // Update label with user name if available
                    if (peerData.videoLabel && peerData.userName) {
                        peerData.videoLabel.textContent = peerData.userName;
                    }
                    console.log('✅ Stream assigned to socket:', targetSocketId);
                } else {
                    // Try to find by peer ID
                    for (const [socketId, peerData] of remotePeers.entries()) {
                        if (peerData.peerId === call.peer) {
                            peerData.call = call;
                            peerData.stream = stream;
                            peerData.videoElement.srcObject = stream;
                            // Update label with user name if available
                            if (peerData.videoLabel && peerData.userName) {
                                peerData.videoLabel.textContent = peerData.userName;
                            }
                            targetSocketId = socketId;
                            console.log('✅ Stream assigned to socket (found by peer ID):', socketId);
                            break;
                        }
                    }
                }
                
                // Update UI if this is the first connection
                if (remotePeers.size > 0) {
                    updateUI(true);
                }
            });

            // Handle call close
            call.on('close', () => {
                console.log('📴 Call closed from PeerJS ID:', call.peer);
                // Find and cleanup this specific peer
                if (targetSocketId && remotePeers.has(targetSocketId)) {
                    if (currentRoomId) {
                        cleanupRemotePeer(targetSocketId);
                    } else {
                        cleanup();
                    }
                }
            });

            // Handle call error
            call.on('error', (error) => {
                console.error('❌ Call error from PeerJS ID:', call.peer, error);
                if (targetSocketId && remotePeers.has(targetSocketId)) {
                    // Retry connection after delay
                    setTimeout(() => {
                        const peerData = remotePeers.get(targetSocketId);
                        if (peerData && peerData.peerId) {
                            connectToUser(peerData.peerId, targetSocketId);
                        }
                    }, 3000);
                }
            });
        });

        // Handle connection events
        peer.on('connection', (conn) => {
            console.log('🔗 Peer connection established');
        });

    } catch (error) {
        console.error('❌ Error initializing PeerJS:', error);
        showStatus('Failed to initialize connection. Please refresh the page.', 'error');
    }
}

// ============================================
// Media Access Functions
// ============================================

/**
 * Get user media (camera/microphone)
 * @param {boolean} withVideo - Whether to request video
 * @param {boolean} withAudio - Whether to request audio
 * @returns {Promise<MediaStream>} Media stream
 */
async function getUserMedia(withVideo, withAudio) {
    try {
        const constraints = {
            video: withVideo ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            } : false,
            audio: withAudio ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Got media stream:', {
            video: stream.getVideoTracks().length > 0,
            audio: stream.getAudioTracks().length > 0
        });
        return stream;

    } catch (error) {
        console.error('❌ Error getting user media:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Could not access ';
        if (withVideo && withAudio) {
            errorMessage += 'camera and microphone';
        } else if (withVideo) {
            errorMessage += 'camera';
        } else {
            errorMessage += 'microphone';
        }

        if (error.name === 'NotAllowedError') {
            errorMessage += '. Please allow access and try again.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += '. No device found.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += '. Device may be in use by another application.';
        } else {
            errorMessage += '. Error: ' + error.message;
        }

        showStatus(errorMessage, 'error');
        throw error;
    }
}

/**
 * Get screen share stream
 * @returns {Promise<MediaStream>} Screen share stream
 */
async function getScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: true // Request audio for screen share (some browsers support this)
        });

        console.log('✅ Got screen share stream');
        return stream;

    } catch (error) {
        console.error('❌ Error getting screen share:', error);
        showStatus('Could not share screen. ' + error.message, 'error');
        throw error;
    }
}

// ============================================
// Call Management Functions
// ============================================

/**
 * Start a call (video or voice)
 * @param {boolean} withVideo - Whether to start with video
 */
async function startCall(withVideo) {
    try {
        // Get user name and room ID
        userName = nameInput.value.trim();
        const roomId = roomIdInput.value.trim();

        if (!userName) {
            showStatus('Please enter your name', 'error');
            return;
        }

        if (!roomId) {
            showStatus('Please enter a room code', 'error');
            return;
        }

        // Initialize socket if not already connected
        if (!socket || !socket.connected) {
            initializeSocket();
            await new Promise((resolve) => {
                if (socket) {
                    socket.once('connect', resolve);
                    setTimeout(resolve, 2000); // Timeout after 2 seconds
                } else {
                    resolve();
                }
            });
        }

        // Initialize PeerJS if not already initialized
        if (!peer || peer.destroyed) {
            initializePeer();
            // Wait for peer to be ready
            await new Promise((resolve) => {
                if (peer) {
                    peer.once('open', resolve);
                    setTimeout(resolve, 2000); // Timeout after 2 seconds
                } else {
                    resolve();
                }
            });
        }

        // Create local video element if it doesn't exist
        if (!localVideoWrapper) {
            localVideoWrapper = document.createElement('div');
            localVideoWrapper.className = 'video-wrapper';
            localVideoWrapper.id = 'local-video-wrapper';
            
            localVideoLabel = document.createElement('div');
            localVideoLabel.className = 'video-label';
            localVideoLabel.textContent = userName || 'Your Video';
            localVideoWrapper.appendChild(localVideoLabel);
            
            localVideo = document.createElement('video');
            localVideo.autoplay = true;
            localVideo.playsInline = true;
            localVideo.muted = true; // Always mute local video
            localVideo.id = 'localVideo';
            localVideoWrapper.appendChild(localVideo);
            
            // Insert at the beginning of video container
            videoContainer.insertBefore(localVideoWrapper, videoContainer.firstChild);
        }
        
        // Update local video label
        if (localVideoLabel) {
            localVideoLabel.textContent = userName || 'Your Video';
        }

        // Try to get user media (but continue even if it fails)
        try {
            localStream = await getUserMedia(withVideo, true);
            if (localStream && localVideo) {
                localVideo.srcObject = localStream;
            }
        } catch (mediaError) {
            console.warn('⚠️ Could not access camera/microphone:', mediaError);
            
            // Create empty stream if no media available
            // User can still join and receive audio/video from others
            try {
                localStream = new MediaStream();
                console.log('✅ Created empty media stream (no camera/mic)');
                if (localVideo) {
                    localVideo.srcObject = localStream;
                }
                showStatus('No camera/microphone available. You can still join and receive audio/video.', 'info');
            } catch (streamError) {
                console.error('❌ Failed to create empty stream:', streamError);
            }
        }

        // Join room on server
        socket.emit('join-room', {
            roomId: roomId,
            userName: userName
        });

        showStatus('Joining room...', 'info');
        
        // Wait for PeerJS to be ready and send peer ID
        if (peer && myPeerId) {
            socket.emit('peer-id', {
                roomId: roomId,
                peerId: myPeerId
            });
        }
        
        updateUI(true);
        updateVideoGrid();

        // Update button states based on available media
        if (!localStream || localStream.getAudioTracks().length === 0) {
            muteBtn.disabled = true;
            muteBtn.textContent = '🔇 No Mic';
        }
        if (!localStream || localStream.getVideoTracks().length === 0) {
            cameraBtn.disabled = true;
            cameraBtn.textContent = '📷 No Camera';
        }

    } catch (error) {
        console.error('❌ Error starting call:', error);
        showStatus('Failed to start call: ' + error.message, 'error');
        cleanup();
    }
}

/**
 * Connect to a specific user via PeerJS
 * @param {string} peerId - PeerJS ID of the user to connect to
 * @param {string} socketId - Socket ID of the user to connect to
 */
async function connectToUser(peerId, socketId) {
    try {
        if (!peer || peer.destroyed) {
            console.warn('⚠️ Peer not initialized, waiting...');
            setTimeout(() => connectToUser(peerId, socketId), 1000);
            return;
        }

        if (!peer.open) {
            console.warn('⚠️ Peer not ready, waiting...');
            peer.once('open', () => connectToUser(peerId, socketId));
            return;
        }

        // Check if we already have an active call with this peer
        if (socketId && remotePeers.has(socketId)) {
            const peerData = remotePeers.get(socketId);
            if (peerData.call && peerData.call.open) {
                console.log('✅ Already connected to socket:', socketId);
                return;
            }
        }

        console.log('🔗 Connecting to user - PeerJS ID:', peerId, 'Socket ID:', socketId);

        // Create call with local stream (or empty stream if no media)
        const streamToSend = localStream || new MediaStream();
        
        const call = peer.call(peerId, streamToSend);
        
        if (!call) {
            console.warn('⚠️ Could not create call, user may not be ready');
            if (socketId && remotePeers.has(socketId)) {
                setTimeout(() => connectToUser(peerId, socketId), 2000);
            }
            return;
        }

        // Store call reference
        if (socketId && remotePeers.has(socketId)) {
            const peerData = remotePeers.get(socketId);
            peerData.call = call;
        }

        // Handle remote stream
        call.on('stream', (stream) => {
            console.log('✅ Received remote stream from PeerJS ID:', peerId);
            
            if (socketId && remotePeers.has(socketId)) {
                const peerData = remotePeers.get(socketId);
                peerData.stream = stream;
                peerData.videoElement.srcObject = stream;
                console.log('✅ Stream assigned to socket:', socketId);
            } else {
                // Try to find by peer ID
                for (const [sid, peerData] of remotePeers.entries()) {
                    if (peerData.peerId === peerId) {
                        peerData.stream = stream;
                        peerData.call = call;
                        peerData.videoElement.srcObject = stream;
                        console.log('✅ Stream assigned (found by peer ID):', sid);
                        break;
                    }
                }
            }
            
            // Update UI if needed
            if (remotePeers.size > 0) {
                updateUI(true);
            }
        });

        // Handle call close
        call.on('close', () => {
            console.log('📴 Call closed - PeerJS ID:', peerId);
            if (socketId && remotePeers.has(socketId)) {
                if (currentRoomId) {
                    // Keep user in room, just cleanup this peer
                    cleanupRemotePeer(socketId);
                } else {
                    cleanup();
                }
            }
        });

        // Handle call error
        call.on('error', (error) => {
            console.error('❌ Call error - PeerJS ID:', peerId, error);
            // Retry connection after delay if still in room
            if (socketId && remotePeers.has(socketId) && currentRoomId) {
                setTimeout(() => {
                    const peerData = remotePeers.get(socketId);
                    if (peerData && peerData.peerId) {
                        connectToUser(peerData.peerId, socketId);
                    }
                }, 3000);
            }
        });

    } catch (error) {
        console.error('❌ Error connecting to user:', error);
        
        // Retry connection if still in room
        if (socketId && remotePeers.has(socketId) && currentRoomId) {
            setTimeout(() => {
                const peerData = remotePeers.get(socketId);
                if (peerData && peerData.peerId) {
                    connectToUser(peerData.peerId, socketId);
                }
            }, 3000);
        }
    }
}

// ============================================
// Call Control Functions
// ============================================

/**
 * Toggle mute/unmute microphone
 */
function toggleMute() {
    try {
        if (!localStream) {
            showStatus('No microphone available', 'error');
            return;
        }

        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length === 0) {
            showStatus('No audio track available', 'error');
            return;
        }

        isMuted = !isMuted;
        audioTracks.forEach(track => {
            track.enabled = !isMuted;
        });

        muteBtn.textContent = isMuted ? '🔇 Unmute' : '🔊 Mute';
        muteBtn.className = isMuted ? 'btn-muted' : 'btn-warning';

        showStatus(isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');

    } catch (error) {
        console.error('❌ Error toggling mute:', error);
        showStatus('Failed to toggle mute', 'error');
    }
}

/**
 * Toggle camera on/off
 */
function toggleCamera() {
    try {
        if (!localStream) {
            showStatus('No camera available', 'error');
            return;
        }

        const videoTracks = localStream.getVideoTracks();
        if (videoTracks.length === 0) {
            showStatus('No video track available', 'error');
            return;
        }

        isCameraOff = !isCameraOff;
        videoTracks.forEach(track => {
            track.enabled = !isCameraOff;
        });

        cameraBtn.textContent = isCameraOff ? '📷 Camera Off' : '📷 Camera On';
        cameraBtn.className = isCameraOff ? 'btn-camera-off' : 'btn-info';

        // Update local video display
        if (isCameraOff) {
            localVideo.style.opacity = '0.5';
        } else {
            localVideo.style.opacity = '1';
        }

        showStatus(isCameraOff ? 'Camera turned off' : 'Camera turned on', 'info');

    } catch (error) {
        console.error('❌ Error toggling camera:', error);
        showStatus('Failed to toggle camera', 'error');
    }
}

/**
 * Toggle screen sharing
 */
async function toggleScreenShare() {
    try {
        if (isSharingScreen) {
            // Stop screen sharing
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }

            // Restore local video stream in all calls
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    remotePeers.forEach((peerData, socketId) => {
                        if (peerData.call && peerData.call.peerConnection) {
                            const sender = peerData.call.peerConnection.getSenders().find(s => {
                                return s.track && s.track.kind === 'video';
                            });
                            if (sender && videoTrack) {
                                sender.replaceTrack(videoTrack).catch(err => {
                                    console.warn('Error replacing track for', socketId, err);
                                });
                            }
                        }
                    });
                }
            }

            isSharingScreen = false;
            screenShareBtn.textContent = '🖥️ Share Screen';
            screenShareBtn.className = 'btn-info';
            showStatus('Screen sharing stopped', 'info');

        } else {
            // Start screen sharing
            try {
                screenStream = await getScreenShare();
                
                // Replace video track in all active calls
                if (screenStream) {
                    const videoTrack = screenStream.getVideoTracks()[0];
                    if (videoTrack) {
                        remotePeers.forEach((peerData, socketId) => {
                            if (peerData.call && peerData.call.peerConnection) {
                                const sender = peerData.call.peerConnection.getSenders().find(s => {
                                    return s.track && s.track.kind === 'video';
                                });
                                if (sender && videoTrack) {
                                    sender.replaceTrack(videoTrack).catch(err => {
                                        console.warn('Error replacing track for', socketId, err);
                                    });
                                }
                            }
                        });
                    }

                    // Show screen share in local video
                    if (localVideo) {
                        localVideo.srcObject = screenStream;
                    }

                    // Handle screen share ending
                    screenStream.getVideoTracks()[0].onended = () => {
                        toggleScreenShare();
                    };

                    isSharingScreen = true;
                    screenShareBtn.textContent = '🛑 Stop Sharing';
                    screenShareBtn.className = 'btn-danger';
                    showStatus('Screen sharing started', 'success');
                }
            } catch (error) {
                console.error('❌ Error starting screen share:', error);
                showStatus('Could not start screen sharing. ' + error.message, 'error');
            }
        }

    } catch (error) {
        console.error('❌ Error toggling screen share:', error);
        showStatus('Failed to toggle screen share', 'error');
    }
}

/**
 * End the current call
 */
function endCall() {
    try {
        // Notify server
        if (socket && socket.connected && currentRoomId) {
            socket.emit('end-call', { roomId: currentRoomId });
        }

        cleanup();

    } catch (error) {
        console.error('❌ Error ending call:', error);
        cleanup(); // Clean up anyway
    }
}

// ============================================
// Initialize on Page Load
// ============================================

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Page loaded, initializing...');
    
    // Initialize video container reference
    videoContainer = document.querySelector('.video-container') || document.getElementById('videoContainer');
    if (!videoContainer) {
        console.error('❌ Video container not found!');
        return;
    }
    
    // Clear any existing video elements (they will be created dynamically)
    const existingVideos = videoContainer.querySelectorAll('.video-wrapper');
    existingVideos.forEach(video => video.remove());
    
    // Initialize socket connection
    initializeSocket();
    
    // Initialize PeerJS
    initializePeer();
    
    showStatus('Ready to start a call', 'info');
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    cleanup();
});

