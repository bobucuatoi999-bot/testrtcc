// ============================================
// WebRTC Client - Video and Voice Call Logic
// Uses native WebRTC API with Socket.io signaling
// ============================================

// ============================================
// Global Variables
// ============================================
let socket = null;              // Socket.io connection
let peerConnection = null;      // RTCPeerConnection instance
let localStream = null;         // Local media stream (camera/mic)
let remoteStream = null;        // Remote media stream
let isMuted = false;            // Mute state
let currentRoomId = null;       // Currently joined room ID
let userName = null;            // User's name
let remoteUserId = null;        // Currently connected user's socket ID
let isCaller = false;           // Whether this user initiated the call

// ============================================
// Server Configuration
// ============================================
// Get server URL from window.SERVER_URL (set in index.html or config)
// Defaults to localhost for development
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// WebRTC Configuration with STUN servers
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Get DOM elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nameInput = document.getElementById('nameInput');
const roomIdInput = document.getElementById('roomIdInput');
const startVideoBtn = document.getElementById('startVideoBtn');
const startVoiceBtn = document.getElementById('startVoiceBtn');
const muteBtn = document.getElementById('muteBtn');
const endCallBtn = document.getElementById('endCallBtn');
const statusDiv = document.getElementById('status');

// ============================================
// Utility Functions
// ============================================

/**
 * Display status message to user
 * @param {string} message - Message to display
 * @param {string} type - Type of message: 'info', 'success', or 'error'
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
    endCallBtn.disabled = !inCall;
    nameInput.disabled = inCall;
    roomIdInput.disabled = inCall;
}

/**
 * Clean up media streams and connections
 */
function cleanup() {
    // Stop local stream tracks (camera/mic)
    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        localStream = null;
    }

    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Clear video elements
    if (localVideo.srcObject) {
        localVideo.srcObject = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }

    // Reset variables
    remoteStream = null;
    remoteUserId = null;
    currentRoomId = null;
    isMuted = false;
    isCaller = false;
    
    // Update UI
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
    // Connect to Socket.io server using configured URL
    console.log('🔌 Connecting to server:', SERVER_URL);
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
    });

    // ============================================
    // Socket Event Handlers
    // ============================================

    // Connection established
    socket.on('connect', () => {
        console.log('✅ Connected to signaling server:', socket.id);
        showStatus('Connected to server', 'success');
    });

    // Connection error
    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        showStatus('Failed to connect to server. Make sure the server is running.', 'error');
    });

    // Disconnected from server
    socket.on('disconnect', (reason) => {
        console.log('⚠️ Disconnected from server:', reason);
        showStatus('Disconnected from server', 'error');
    });

    // Successfully joined a room
    socket.on('room-joined', (data) => {
        console.log('✅ Joined room:', data.roomId);
        currentRoomId = data.roomId;
        // Send user name to server if available
        if (userName) {
            socket.emit('user-name', { name: userName, roomId: data.roomId });
        }
        showStatus(`${userName || 'You'} joined room: ${data.roomId}`, 'success');
    });

    // Existing users in the room
    socket.on('room-users', (data) => {
        console.log('👥 Existing users in room:', data.users);
        if (data.users && data.users.length > 0) {
            // Connect to the first existing user (1-on-1 call)
            remoteUserId = data.users[0];
            createOffer(data.users[0]);
        }
    });

    // New user joined the room
    socket.on('user-joined', (data) => {
        console.log('👋 New user joined:', data.userId);
        showStatus('New user joined the room', 'info');
        
        // If we have a local stream, create offer to connect
        if (localStream && !peerConnection) {
            remoteUserId = data.userId;
            createOffer(data.userId);
        }
    });

    // User left the room
    socket.on('user-left', (data) => {
        console.log('👋 User left:', data.userId);
        if (data.userId === remoteUserId) {
            showStatus('Other user left the call', 'info');
            cleanup();
        }
    });

    // Call ended notification
    socket.on('call-ended', (data) => {
        console.log('📴 Call ended by:', data.userId);
        showStatus('Call ended by other user', 'info');
        cleanup();
    });

    // Receive WebRTC offer
    socket.on('offer', async (data) => {
        console.log('📥 Received offer from:', data.senderId);
        remoteUserId = data.senderId;
        await handleOffer(data.offer, data.senderId);
    });

    // Receive WebRTC answer
    socket.on('answer', async (data) => {
        console.log('📥 Received answer from:', data.senderId);
        await handleAnswer(data.answer);
    });

    // Receive ICE candidate
    socket.on('ice-candidate', async (data) => {
        console.log('📥 Received ICE candidate from:', data.senderId);
        if (peerConnection && data.candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
            }
        }
    });

    // Error from server
    socket.on('error', (error) => {
        console.error('❌ Server error:', error);
        showStatus(error.message || 'Server error occurred', 'error');
    });
}

// ============================================
// WebRTC Peer Connection Functions
// ============================================

/**
 * Create RTCPeerConnection and set up event handlers
 */
function createPeerConnection() {
    // Create peer connection with STUN servers
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('✅ Added track:', track.kind);
        });
    }

    // Handle ICE candidates - send to remote peer via signaling
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteUserId) {
            console.log('📤 Sending ICE candidate');
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                targetUserId: remoteUserId,
                roomId: currentRoomId
            });
        }
    };

    // Handle remote stream - when we receive media from remote peer
    peerConnection.ontrack = (event) => {
        console.log('✅ Received remote track:', event.track.kind);
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        showStatus('Call connected!', 'success');
        updateUI(true);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed') {
            showStatus('Connection failed. Trying to reconnect...', 'error');
            // Attempt to reconnect
            if (localStream && remoteUserId) {
                if (isCaller) {
                    createOffer(remoteUserId);
                }
            }
        } else if (peerConnection.connectionState === 'connected') {
            showStatus('Call connected!', 'success');
        }
    };

    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'failed') {
            showStatus('Network connection failed', 'error');
        }
    };
}

/**
 * Create WebRTC offer (caller side)
 */
async function createOffer(targetUserId) {
    try {
        console.log('📞 Creating offer for:', targetUserId);
        showStatus('Initiating call...', 'info');

        // Create peer connection if not exists
        if (!peerConnection) {
            createPeerConnection();
        }

        // Create offer
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        // Set local description
        await peerConnection.setLocalDescription(offer);

        // Send offer to remote peer via signaling server
        socket.emit('offer', {
            offer: offer,
            targetUserId: targetUserId,
            roomId: currentRoomId
        });

        isCaller = true;
        console.log('✅ Offer created and sent');

    } catch (error) {
        console.error('❌ Error creating offer:', error);
        showStatus('Failed to initiate call', 'error');
    }
}

/**
 * Handle incoming WebRTC offer (callee side)
 */
async function handleOffer(offer, senderId) {
    try {
        console.log('📥 Handling offer from:', senderId);
        remoteUserId = senderId;
        showStatus('Incoming call...', 'info');

        // Create peer connection if not exists
        if (!peerConnection) {
            createPeerConnection();
        }

        // Set remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Send answer back to caller
        socket.emit('answer', {
            answer: answer,
            targetUserId: senderId,
            roomId: currentRoomId
        });

        isCaller = false;
        console.log('✅ Answer created and sent');

    } catch (error) {
        console.error('❌ Error handling offer:', error);
        showStatus('Failed to answer call', 'error');
    }
}

/**
 * Handle incoming WebRTC answer (caller side)
 */
async function handleAnswer(answer) {
    try {
        console.log('📥 Handling answer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('✅ Answer handled, connection established');
    } catch (error) {
        console.error('❌ Error handling answer:', error);
        showStatus('Failed to establish connection', 'error');
    }
}

// ============================================
// Media Access Functions
// ============================================

/**
 * Get user media (camera and/or microphone)
 * @param {boolean} video - Whether to request video
 * @param {boolean} audio - Whether to request audio
 * @returns {Promise<MediaStream>} Media stream promise
 */
function getUserMedia(video, audio) {
    return navigator.mediaDevices.getUserMedia({
        video: video ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
        } : false,
        audio: audio ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } : false
    });
}

// ============================================
// Call Management Functions
// ============================================

/**
 * Start a call (video or voice only)
 * @param {boolean} withVideo - Whether to include video in the call
 */
async function startCall(withVideo) {
    try {
        // Get user name and room ID from inputs
        userName = nameInput.value.trim();
        const roomId = roomIdInput.value.trim();
        
        // Validate inputs
        if (!userName) {
            alert('Please enter your name');
            nameInput.focus();
            return;
        }
        
        if (!roomId) {
            alert('Please enter a Room Code');
            roomIdInput.focus();
            return;
        }

        console.log(`🚀 Starting ${withVideo ? 'video' : 'voice'} call in room: ${roomId}`);
        showStatus(`Starting ${withVideo ? 'video' : 'voice'} call...`, 'info');

        // Get user media (camera/mic)
        try {
            localStream = await getUserMedia(withVideo, true);
            console.log('✅ Got local media stream');
            
            // Set local video element
            localVideo.srcObject = localStream;
            
            // Mute local video to prevent echo
            localVideo.muted = true;
        } catch (mediaError) {
            console.error('❌ Failed to get user media:', mediaError);
            
            // Provide user-friendly error messages
            let errorMessage = 'Failed to access camera/microphone. ';
            if (mediaError.name === 'NotAllowedError') {
                errorMessage += 'Please allow camera and microphone access in your browser settings.';
            } else if (mediaError.name === 'NotFoundError') {
                errorMessage += 'No camera/microphone found. Please connect a device.';
            } else if (mediaError.name === 'NotReadableError') {
                errorMessage += 'Camera/microphone is being used by another application.';
            } else {
                errorMessage += mediaError.message;
            }
            
            alert(errorMessage);
            showStatus(errorMessage, 'error');
            return;
        }

        // Initialize Socket.io if not already done
        if (!socket || !socket.connected) {
            initializeSocket();
        }

        // Wait for socket to connect if needed
        if (!socket.connected) {
            await new Promise((resolve, reject) => {
                socket.once('connect', resolve);
                socket.once('connect_error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        }

        // Join the room via Socket.io
        socket.emit('join-room', roomId);
        
        // Update UI
        updateUI(true);
        
        showStatus(`Call started. Waiting for other user...`, 'info');

    } catch (error) {
        console.error('❌ Error starting call:', error);
        showStatus(`Failed to start call: ${error.message}`, 'error');
        cleanup();
    }
}

/**
 * Toggle mute/unmute audio
 */
function toggleMute() {
    if (!localStream) {
        return;
    }

    // Toggle audio tracks
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
    });

    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? 'Unmute Audio' : 'Mute Audio';
    
    console.log(isMuted ? '🔇 Audio muted' : '🔊 Audio unmuted');
    showStatus(isMuted ? 'Audio muted' : 'Audio unmuted', 'info');
}

/**
 * End the current call
 */
function endCall() {
    console.log('📴 Ending call');
    
    // Notify server about call end
    if (socket && socket.connected && currentRoomId && remoteUserId) {
        socket.emit('end-call', { roomId: currentRoomId, targetUserId: remoteUserId });
    }

    // Clean up connections and streams
    cleanup();
}

// ============================================
// Initialization
// ============================================

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 WebRTC Client initialized');
    
    // Check if browser supports required APIs
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support WebRTC. Please use a modern browser like Chrome, Firefox, or Edge.');
        showStatus('Browser not supported', 'error');
        return;
    }

    // Check for RTCPeerConnection support
    if (!window.RTCPeerConnection) {
        alert('Your browser does not support WebRTC. Please use a modern browser.');
        showStatus('WebRTC not supported', 'error');
        return;
    }

    // Initialize Socket.io connection
    initializeSocket();

    // Handle page unload - cleanup
    window.addEventListener('beforeunload', () => {
        endCall();
        if (socket) {
            socket.disconnect();
        }
    });

    // Allow Enter key in inputs to start video call
    nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !startVideoBtn.disabled) {
            roomIdInput.focus();
        }
    });
    
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !startVideoBtn.disabled) {
            startCall(true);
        }
    });
    
    console.log('📱 Server URL:', SERVER_URL);
});
