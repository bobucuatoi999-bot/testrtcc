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
let remoteStream = null;        // Remote media stream
let currentCall = null;         // Active PeerJS call
let isMuted = false;            // Mute state
let isCameraOff = false;        // Camera off state
let isSharingScreen = false;   // Screen sharing state
let currentRoomId = null;       // Currently joined room ID
let userName = null;            // User's name
let myPeerId = null;             // My PeerJS ID
let remotePeerId = null;        // Remote user's PeerJS ID
let remoteUserName = null;      // Remote user's name
let iceCandidateQueue = [];     // Queue for ICE candidates received before connection

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
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
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
 * Clean up all media streams and connections
 */
function cleanup() {
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

    // Close current call
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }

    // Destroy peer connection
    if (peer) {
        peer.destroy();
        peer = null;
    }

    // Clear video elements
    if (localVideo.srcObject) {
        localVideo.srcObject = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }

    // Reset state
    remoteStream = null;
    remotePeerId = null;
    remoteUserName = null;
    myPeerId = null;
    currentRoomId = null;
    isMuted = false;
    isCameraOff = false;
    isSharingScreen = false;
    iceCandidateQueue = [];

    // Leave room on server
    if (socket && socket.connected && currentRoomId) {
        socket.emit('leave-room', { roomId: currentRoomId });
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
            console.log('✅ Joined room:', data.roomId);
            currentRoomId = data.roomId;
        });

        // Handle existing users in room
        socket.on('room-users', (data) => {
            console.log('👥 Users in room:', data.users);
            if (data.users.length > 0) {
                // Another user is already in the room - wait for their PeerJS ID
                const otherUser = data.users[0];
                remoteUserName = otherUser.userName;
                // They will send their peer-id via socket
            }
        });

        // Handle new user joining
        socket.on('user-joined', (data) => {
            console.log('👤 New user joined:', data.userId);
            remoteUserName = data.userName || 'User';
            // Wait for them to send their PeerJS ID
        });

        // Handle PeerJS ID exchange
        socket.on('peer-id', (data) => {
            console.log('🔑 Received PeerJS ID:', data.peerId);
            if (data.peerId && myPeerId) {
                remotePeerId = data.peerId;
                // Wait a bit for both peers to be ready, then connect
                setTimeout(() => {
                    connectToUser(data.peerId);
                }, 500);
            }
        });

        // Handle user leaving
        socket.on('user-left', (data) => {
            console.log('👋 User left:', data.userId);
            if (remotePeerId) {
                showStatus('Other user left. Waiting for new user...', 'info');
                cleanup();
            }
        });


        // Handle call ended
        socket.on('call-ended', (data) => {
            console.log('📴 Call ended by other user');
            showStatus('Other user ended the call', 'info');
            cleanup();
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

        // Handle incoming calls
        peer.on('call', (call) => {
            console.log('📞 Incoming call from:', call.peer);
            
            // Answer the call with local stream (if available)
            if (localStream) {
                call.answer(localStream);
            } else {
                // Create empty stream if no media available
                const emptyStream = new MediaStream();
                call.answer(emptyStream);
            }

            // Handle remote stream
            call.on('stream', (stream) => {
                console.log('✅ Received remote stream');
                remoteStream = stream;
                remoteVideo.srcObject = stream;
                showStatus('Call connected!', 'success');
                updateUI(true);
            });

            // Handle call close
            call.on('close', () => {
                console.log('📴 Call closed');
                showStatus('Call ended', 'info');
                cleanup();
            });

            // Handle call error
            call.on('error', (error) => {
                console.error('❌ Call error:', error);
                showStatus('Call error: ' + error.message, 'error');
            });

            currentCall = call;
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

        // Try to get user media (but continue even if it fails)
        try {
            localStream = await getUserMedia(withVideo, true);
            if (localStream) {
                localVideo.srcObject = localStream;
                localVideo.muted = true; // Mute local video to avoid feedback
            }
        } catch (mediaError) {
            console.warn('⚠️ Could not access camera/microphone:', mediaError);
            
            // Create empty stream if no media available
            // User can still join and receive audio/video from others
            try {
                localStream = new MediaStream();
                console.log('✅ Created empty media stream (no camera/mic)');
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
 */
async function connectToUser(peerId) {
    try {
        if (!peer || peer.destroyed) {
            console.warn('⚠️ Peer not initialized, waiting...');
            setTimeout(() => connectToUser(peerId), 1000);
            return;
        }

        if (!peer.open) {
            console.warn('⚠️ Peer not ready, waiting...');
            peer.once('open', () => connectToUser(peerId));
            return;
        }

        console.log('🔗 Connecting to user with PeerJS ID:', peerId);

        // Create call with local stream (or empty stream if no media)
        const streamToSend = localStream || new MediaStream();
        
        const call = peer.call(peerId, streamToSend);
        
        if (!call) {
            console.warn('⚠️ Could not create call, user may not be ready');
            showStatus('Waiting for other user to be ready...', 'info');
            setTimeout(() => connectToUser(peerId), 2000);
            return;
        }

        // Handle remote stream
        call.on('stream', (stream) => {
            console.log('✅ Received remote stream');
            remoteStream = stream;
            remoteVideo.srcObject = stream;
            showStatus('Call connected!', 'success');
            updateUI(true);
        });

        // Handle call close
        call.on('close', () => {
            console.log('📴 Call closed');
            if (currentCall === call) {
                showStatus('Call ended', 'info');
                cleanup();
            }
        });

        // Handle call error
        call.on('error', (error) => {
            console.error('❌ Call error:', error);
            showStatus('Connection error. Trying to reconnect...', 'error');
            // Try to reconnect after a delay
            setTimeout(() => {
                if (remoteUserId) {
                    connectToUser(remoteUserId);
                }
            }, 3000);
        });

        currentCall = call;

    } catch (error) {
        console.error('❌ Error connecting to user:', error);
        showStatus('Failed to connect. Please try again.', 'error');
        
        // Retry connection
        setTimeout(() => {
            if (remotePeerId) {
                connectToUser(remotePeerId);
            }
        }, 3000);
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

            // Restore local video stream
            if (localStream && currentCall) {
                // Replace video track in the call
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack && currentCall.peerConnection) {
                    const sender = currentCall.peerConnection.getSenders().find(s => {
                        return s.track && s.track.kind === 'video';
                    });
                    if (sender && videoTrack) {
                        sender.replaceTrack(videoTrack);
                    }
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
                
                if (screenStream && currentCall) {
                    // Replace video track in the call
                    const videoTrack = screenStream.getVideoTracks()[0];
                    if (videoTrack && currentCall.peerConnection) {
                        const sender = currentCall.peerConnection.getSenders().find(s => {
                            return s.track && s.track.kind === 'video';
                        });
                        if (sender && videoTrack) {
                            sender.replaceTrack(videoTrack);
                        }
                    }

                    // Show screen share in local video
                    localVideo.srcObject = screenStream;

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
