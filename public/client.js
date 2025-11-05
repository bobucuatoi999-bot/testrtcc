// ============================================
// WebRTC Client - Video and Voice Call Logic
// Connects to Socket.io signaling server and uses PeerJS for peer connections
// ============================================

// ============================================
// Global Variables
// ============================================
let socket = null;           // Socket.io connection
let peer = null;             // PeerJS instance
let localStream = null;      // Local media stream (camera/mic)
let remoteStream = null;     // Remote media stream
let currentCall = null;      // Current active call object
let isMuted = false;         // Mute state
let currentRoomId = null;    // Currently joined room ID
let userName = null;         // User's name

// ============================================
// Server Configuration
// ============================================
// Get server URL from window.SERVER_URL (set in index.html or config)
// Defaults to localhost for development
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

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

    // Clear video elements
    if (localVideo.srcObject) {
        localVideo.srcObject = null;
    }
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }

    // End current call if active
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }

    // Reset remote stream
    remoteStream = null;
    currentRoomId = null;
    isMuted = false;
    
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
            // Connect to existing users
            data.users.forEach(userId => {
                connectToNewUser(userId, localStream);
            });
        }
    });

    // New user joined the room
    socket.on('user-joined', (data) => {
        console.log('👋 New user joined:', data.userId);
        showStatus('New user joined the room', 'info');
        
        // If we have a local stream, connect to the new user
        if (localStream) {
            connectToNewUser(data.userId, localStream);
        }
    });

    // User left the room
    socket.on('user-left', (data) => {
        console.log('👋 User left:', data.userId);
        showStatus('Other user left the call', 'info');
        
        // Clean up remote stream
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject = null;
        }
    });

    // Call ended notification
    socket.on('call-ended', (data) => {
        console.log('📴 Call ended by:', data.userId);
        showStatus('Call ended by other user', 'info');
        cleanup();
    });

    // Error from server
    socket.on('error', (error) => {
        console.error('❌ Server error:', error);
        showStatus(error.message || 'Server error occurred', 'error');
    });
}

// ============================================
// PeerJS Setup
// ============================================

/**
 * Initialize PeerJS instance for peer-to-peer connections
 */
function initializePeer() {
    // Create PeerJS instance with STUN server for NAT traversal
    // STUN servers help establish connections through firewalls/NAT
    peer = new Peer({
        config: {
            iceServers: [
                { 
                    urls: 'stun:stun.l.google.com:19302' 
                },
                // Additional free STUN server as backup
                { 
                    urls: 'stun:stun1.l.google.com:19302' 
                }
            ]
        },
        debug: 2 // Log level (0-3, higher = more verbose)
    });

    // ============================================
    // PeerJS Event Handlers
    // ============================================

    // PeerJS connection opened - we got our ID
    peer.on('open', (id) => {
        console.log('✅ PeerJS ready with ID:', id);
        showStatus(`Peer ID: ${id}`, 'success');
    });

    // Error in PeerJS
    peer.on('error', (error) => {
        console.error('❌ PeerJS error:', error);
        showStatus(`PeerJS error: ${error.message}`, 'error');
    });

    // Incoming call from another peer
    peer.on('call', (call) => {
        console.log('📞 Incoming call from:', call.peer);
        showStatus('Incoming call...', 'info');

        // Get user media to answer the call
        getUserMedia(true, true)
            .then((stream) => {
                // Answer the call with our stream
                call.answer(stream);
                
                // Store the call object
                currentCall = call;
                
                // Set up local video
                if (localVideo.srcObject !== stream) {
                    localVideo.srcObject = stream;
                    localStream = stream;
                }

                // Handle remote stream when it arrives
                call.on('stream', (remoteStream) => {
                    console.log('✅ Received remote stream');
                    remoteVideo.srcObject = remoteStream;
                    showStatus('Call connected!', 'success');
                    updateUI(true);
                });

                // Handle call close
                call.on('close', () => {
                    console.log('📴 Call closed');
                    cleanup();
                });

                // Handle call error
                call.on('error', (error) => {
                    console.error('❌ Call error:', error);
                    showStatus('Call error occurred', 'error');
                    cleanup();
                });
            })
            .catch((error) => {
                console.error('❌ Failed to get media for incoming call:', error);
                showStatus('Failed to answer call. Check camera/mic permissions.', 'error');
            });
    });

    // PeerJS connection closed
    peer.on('close', () => {
        console.log('⚠️ PeerJS connection closed');
        showStatus('Peer connection closed', 'error');
    });

    // PeerJS disconnected
    peer.on('disconnected', () => {
        console.log('⚠️ PeerJS disconnected');
        // Attempt to reconnect
        if (!peer.destroyed) {
            peer.reconnect();
        }
    });
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

        // Wait a moment for socket to connect if needed
        if (!socket.connected) {
            await new Promise((resolve) => {
                socket.once('connect', resolve);
                setTimeout(resolve, 3000); // Timeout after 3 seconds
            });
        }

        // Initialize PeerJS if not already done
        if (!peer || peer.destroyed) {
            initializePeer();
            
            // Wait for PeerJS to be ready
            await new Promise((resolve, reject) => {
                if (peer.open) {
                    resolve();
                } else {
                    peer.once('open', resolve);
                    peer.once('error', reject);
                    setTimeout(() => reject(new Error('PeerJS initialization timeout')), 5000);
                }
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
 * Connect to a new user in the room
 * @param {string} userId - The PeerJS ID of the user to connect to
 * @param {MediaStream} stream - Our local media stream
 */
function connectToNewUser(userId, stream) {
    try {
        console.log('🔗 Connecting to user:', userId);
        showStatus('Connecting to user...', 'info');

        // Make a call to the other user with our stream
        const call = peer.call(userId, stream);
        
        if (!call) {
            console.error('❌ Failed to create call');
            showStatus('Failed to connect to user', 'error');
            return;
        }

        // Store the call object
        currentCall = call;

        // Handle remote stream when it arrives
        call.on('stream', (remoteStream) => {
            console.log('✅ Received remote stream from:', userId);
            remoteVideo.srcObject = remoteStream;
            showStatus('Call connected!', 'success');
            updateUI(true);
        });

        // Handle call close
        call.on('close', () => {
            console.log('📴 Call closed with:', userId);
            if (remoteVideo.srcObject) {
                remoteVideo.srcObject = null;
            }
        });

        // Handle call error
        call.on('error', (error) => {
            console.error('❌ Call error:', error);
            showStatus('Call error occurred', 'error');
        });

    } catch (error) {
        console.error('❌ Error connecting to user:', error);
        showStatus(`Failed to connect: ${error.message}`, 'error');
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
    if (socket && socket.connected && currentRoomId) {
        socket.emit('end-call', { roomId: currentRoomId });
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

    // Initialize Socket.io connection
    initializeSocket();

    // Initialize PeerJS
    initializePeer();

    // Handle page unload - cleanup
    window.addEventListener('beforeunload', () => {
        endCall();
        if (socket) {
            socket.disconnect();
        }
        if (peer && !peer.destroyed) {
            peer.destroy();
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

