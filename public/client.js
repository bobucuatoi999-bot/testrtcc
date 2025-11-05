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
let screenStream = null;        // Screen share stream
let remoteStream = null;        // Remote media stream
let isMuted = false;            // Mute state
let isCameraOff = false;        // Camera off state
let isSharingScreen = false;    // Screen sharing state
let currentRoomId = null;       // Currently joined room ID
let userName = null;            // User's name
let remoteUserId = null;        // Currently connected user's socket ID
let remoteUserName = null;      // Remote user's name
let isCaller = false;           // Whether this user initiated the call
let reconnectAttempts = 0;      // Reconnection attempt counter
let maxReconnectAttempts = 5;   // Maximum reconnection attempts
let reconnectTimeout = null;     // Reconnection timeout
let connectionAttempts = 0;     // Connection attempt counter
let isConnecting = false;       // Connection in progress flag

// Store user names by socket ID
const userNames = new Map();     // { socketId: userName }

// ============================================
// Server Configuration
// ============================================
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// WebRTC Configuration with STUN servers
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
};

// Get DOM elements
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
const localNameOverlay = document.getElementById('localNameOverlay');
const remoteNameOverlay = document.getElementById('remoteNameOverlay');

// ============================================
// Utility Functions
// ============================================

function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'info') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

function updateNameOverlays() {
    // Show local name if we have a name (even without stream)
    if (userName) {
        localNameOverlay.textContent = userName;
        localNameOverlay.style.display = 'block';
    } else {
        localNameOverlay.style.display = 'none';
    }

    // Show remote name if we have remote stream
    if (remoteUserName && remoteStream) {
        remoteNameOverlay.textContent = remoteUserName;
        remoteNameOverlay.style.display = 'block';
    } else {
        remoteNameOverlay.style.display = 'none';
    }
}

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

function cleanupConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }

    remoteStream = null;
    remoteUserId = null;
    remoteUserName = null;
    isCaller = false;
    isConnecting = false;
    connectionAttempts = 0;
    
    updateNameOverlays();
}

function cleanup() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    cleanupConnection();

    if (localVideo.srcObject) {
        localVideo.srcObject = null;
    }

    if (socket && socket.connected && currentRoomId) {
        socket.emit('leave-room', { roomId: currentRoomId });
    }

    currentRoomId = null;
    isMuted = false;
    isCameraOff = false;
    isSharingScreen = false;
    reconnectAttempts = 0;
    
    localNameOverlay.style.display = 'none';
    remoteNameOverlay.style.display = 'none';
    
    updateUI(false);
    showStatus('Left room. Ready for new call.', 'info');
}

// ============================================
// Socket.io Connection Setup
// ============================================

function initializeSocket() {
    console.log('🔌 Connecting to server:', SERVER_URL);
    socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    socket.on('connect', () => {
        console.log('✅ Connected to signaling server:', socket.id);
        showStatus('Connected to server', 'success');
        reconnectAttempts = 0;
        
        // Rejoin room if we were in one
        if (currentRoomId && localStream) {
            socket.emit('join-room', currentRoomId);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        showStatus('Failed to connect to server. Retrying...', 'error');
    });

    socket.on('disconnect', (reason) => {
        console.log('⚠️ Disconnected from server:', reason);
        if (reason === 'io server disconnect') {
            socket.connect();
        } else if (currentRoomId) {
            showStatus('Connection lost. Attempting to reconnect...', 'error');
            setTimeout(() => {
                if (currentRoomId && localStream) {
                    socket.emit('join-room', currentRoomId);
                }
            }, 1000);
        }
    });

    socket.on('room-joined', (data) => {
        console.log('✅ Joined room:', data.roomId);
        currentRoomId = data.roomId;
        if (userName) {
            socket.emit('user-name', { name: userName, roomId: data.roomId });
            userNames.set(socket.id, userName);
        }
        showStatus(`${userName || 'You'} joined room: ${data.roomId}`, 'success');
        updateNameOverlays();
        
        // Wait a moment for other users to be ready
        setTimeout(() => {
            establishConnection();
        }, 500);
    });

    socket.on('user-name-updated', (data) => {
        console.log('👤 User name updated:', data.userId, data.name);
        userNames.set(data.userId, data.name);
        if (data.userId === remoteUserId) {
            remoteUserName = data.name;
            updateNameOverlays();
        }
    });

    // Existing users in room - we join after them
    socket.on('room-users', (data) => {
        console.log('👥 Existing users in room:', data.users);
        if (data.users && data.users.length > 0) {
            // Connect to existing user (even without local stream - can still receive)
            remoteUserId = data.users[0];
            remoteUserName = userNames.get(remoteUserId) || 'User';
            updateNameOverlays();
            
            // Wait a bit then create offer
            setTimeout(() => {
                establishConnection();
            }, 500);
        }
    });

    // New user joined - we were here first
    socket.on('user-joined', (data) => {
        console.log('👋 New user joined:', data.userId);
        showStatus('New user joined the room', 'info');
        
        if (!peerConnection) {
            remoteUserId = data.userId;
            remoteUserName = userNames.get(data.userId) || 'User';
            updateNameOverlays();
            
            // Wait a bit for them to be ready, then create offer
            setTimeout(() => {
                establishConnection();
            }, 500);
        }
    });

    socket.on('user-left', (data) => {
        console.log('👋 User left:', data.userId);
        if (data.userId === remoteUserId) {
            showStatus('Other user left. Waiting for new user...', 'info');
            cleanupConnection();
        }
    });

    socket.on('offer', async (data) => {
        console.log('📥 Received offer from:', data.senderId);
        if (isConnecting) {
            console.log('⚠️ Already connecting, ignoring duplicate offer');
            return;
        }
        
        remoteUserId = data.senderId;
        remoteUserName = userNames.get(data.senderId) || 'User';
        updateNameOverlays();
        await handleOffer(data.offer, data.senderId);
    });

    socket.on('answer', async (data) => {
        console.log('📥 Received answer from:', data.senderId);
        if (peerConnection && peerConnection.signalingState !== 'stable') {
            await handleAnswer(data.answer);
        }
    });

    socket.on('ice-candidate', async (data) => {
        if (peerConnection && data.candidate) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                console.error('❌ Error adding ICE candidate:', error);
            }
        }
    });

    socket.on('error', (error) => {
        console.error('❌ Server error:', error);
        showStatus(error.message || 'Server error occurred', 'error');
    });
}

// ============================================
// WebRTC Connection Functions
// ============================================

function createPeerConnection() {
    if (peerConnection) {
        peerConnection.close();
    }

    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks (if available)
    if (localStream && localStream.getTracks().length > 0) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('✅ Added local track:', track.kind);
        });
    } else {
        console.log('⚠️ No local tracks to add (no camera/mic available)');
    }

    // Add screen share tracks if active
    if (screenStream && screenStream.getTracks().length > 0) {
        screenStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, screenStream);
            console.log('✅ Added screen share track:', track.kind);
        });
    }

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && remoteUserId && socket && socket.connected) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                targetUserId: remoteUserId,
                roomId: currentRoomId
            });
        }
    };

    peerConnection.ontrack = (event) => {
        console.log('✅ Received remote track:', event.track.kind);
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        updateNameOverlays();
        showStatus('Call connected!', 'success');
        updateUI(true);
        isConnecting = false;
        connectionAttempts = 0;
    };

    peerConnection.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
            showStatus('Call connected!', 'success');
            isConnecting = false;
            connectionAttempts = 0;
        } else if (peerConnection.connectionState === 'failed') {
            showStatus('Connection failed. Retrying...', 'error');
            if (connectionAttempts < 3 && localStream && remoteUserId) {
                connectionAttempts++;
                setTimeout(() => {
                    cleanupConnection();
                    establishConnection();
                }, 2000);
            }
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected') {
            showStatus('Network connected!', 'success');
        } else if (peerConnection.iceConnectionState === 'failed') {
            if (connectionAttempts < 3 && localStream && remoteUserId) {
                connectionAttempts++;
                setTimeout(() => {
                    cleanupConnection();
                    establishConnection();
                }, 2000);
            }
        }
    };
}

async function establishConnection() {
    if (isConnecting || !remoteUserId || !socket || !socket.connected) {
        return;
    }
    
    // Allow connection even without local stream (user can still receive)
    if (!localStream) {
        // Create empty stream if needed
        try {
            localStream = new MediaStream();
        } catch (e) {
            console.warn('Could not create empty stream');
        }
    }

    isConnecting = true;
    showStatus('Establishing connection...', 'info');

    try {
        if (!peerConnection) {
            createPeerConnection();
        }

        // Create offer - whoever initiates becomes the caller
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });

        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', {
            offer: offer,
            targetUserId: remoteUserId,
            roomId: currentRoomId
        });

        isCaller = true;
        console.log('✅ Offer created and sent');

        // Timeout if no answer received
        setTimeout(() => {
            if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
                console.log('⚠️ No answer received, retrying...');
                if (connectionAttempts < 3) {
                    connectionAttempts++;
                    cleanupConnection();
                    setTimeout(() => establishConnection(), 1000);
                }
            }
        }, 10000);

    } catch (error) {
        console.error('❌ Error establishing connection:', error);
        showStatus('Failed to connect. Retrying...', 'error');
        isConnecting = false;
        if (connectionAttempts < 3) {
            connectionAttempts++;
            setTimeout(() => establishConnection(), 2000);
        }
    }
}

async function handleOffer(offer, senderId) {
    if (isConnecting) {
        console.log('⚠️ Already handling offer');
        return;
    }

    try {
        isConnecting = true;
        console.log('📥 Handling offer from:', senderId);
        showStatus('Incoming call...', 'info');

        if (!peerConnection) {
            createPeerConnection();
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        if (socket && socket.connected) {
            socket.emit('answer', {
                answer: answer,
                targetUserId: senderId,
                roomId: currentRoomId
            });
            isCaller = false;
            console.log('✅ Answer created and sent');
        }

    } catch (error) {
        console.error('❌ Error handling offer:', error);
        showStatus('Failed to answer call', 'error');
        isConnecting = false;
    }
}

async function handleAnswer(answer) {
    try {
        if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log('✅ Answer handled, connection established');
        }
    } catch (error) {
        console.error('❌ Error handling answer:', error);
        showStatus('Failed to establish connection', 'error');
    }
}

// ============================================
// Media Functions
// ============================================

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

function replaceTrackInPeerConnection(oldTrack, newTrack, stream) {
    if (!peerConnection) return;

    const sender = peerConnection.getSenders().find(s => 
        s.track && s.track.kind === oldTrack.kind
    );

    if (sender) {
        sender.replaceTrack(newTrack);
        console.log(`✅ Replaced ${oldTrack.kind} track`);
    } else {
        // Add new track if no sender found
        peerConnection.addTrack(newTrack, stream);
    }
}

// ============================================
// Call Management
// ============================================

async function startCall(withVideo) {
    try {
        userName = nameInput.value.trim();
        const roomId = roomIdInput.value.trim();
        
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

        // Try to get user media, but continue even if it fails
        try {
            localStream = await getUserMedia(withVideo, true);
            console.log('✅ Got local media stream');
            
            if (localStream) {
                localVideo.srcObject = localStream;
                localVideo.muted = true;
            }
            updateNameOverlays();
        } catch (mediaError) {
            console.warn('⚠️ Could not access camera/microphone:', mediaError);
            
            // Create empty stream if no media available
            try {
                localStream = new MediaStream();
                console.log('✅ Created empty media stream');
                
                // Show message that user can still connect without media
                let warningMessage = 'No camera/microphone available. ';
                if (mediaError.name === 'NotAllowedError') {
                    warningMessage += 'You can still join and receive audio/video from others.';
                } else if (mediaError.name === 'NotFoundError') {
                    warningMessage += 'You can still join and receive audio/video from others.';
                } else if (mediaError.name === 'NotReadableError') {
                    warningMessage += 'You can still join and receive audio/video from others.';
                } else {
                    warningMessage += 'You can still join and receive audio/video from others.';
                }
                
                showStatus(warningMessage, 'info');
                
                // Update UI to show user can still participate
                localVideo.style.display = 'none'; // Hide local video if no stream
            } catch (streamError) {
                console.error('❌ Failed to create empty stream:', streamError);
                // Continue anyway - user can still join room
            }
        }

        if (!socket || !socket.connected) {
            initializeSocket();
        }

        if (!socket.connected) {
            await new Promise((resolve, reject) => {
                socket.once('connect', resolve);
                socket.once('connect_error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        }

        socket.emit('join-room', roomId);
        updateUI(true);
        showStatus(`Call started. Waiting for other user...`, 'info');

    } catch (error) {
        console.error('❌ Error starting call:', error);
        showStatus(`Failed to start call: ${error.message}`, 'error');
        cleanup();
    }
}

function toggleMute() {
    if (!localStream) {
        showStatus('No microphone available', 'info');
        return;
    }

    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
        showStatus('No microphone available', 'info');
        return;
    }

    audioTracks.forEach(track => {
        track.enabled = !track.enabled;
    });

    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? 'Unmute Audio' : 'Mute Audio';
    muteBtn.className = isMuted ? 'btn-mute muted' : 'btn-mute';
    
    console.log(isMuted ? '🔇 Audio muted' : '🔊 Audio unmuted');
    showStatus(isMuted ? 'Audio muted' : 'Audio unmuted', 'info');
}

async function toggleCamera() {
    if (!localStream) {
        showStatus('No camera available', 'info');
        return;
    }

    try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) {
            // Try to get camera if no track exists
            try {
                const newStream = await getUserMedia(true, false);
                const newVideoTrack = newStream.getVideoTracks()[0];
                if (newVideoTrack) {
                    localStream.addTrack(newVideoTrack);
                    localVideo.srcObject = localStream;
                    localVideo.style.display = 'block';
                    updateNameOverlays();
                    
                    if (peerConnection) {
                        peerConnection.addTrack(newVideoTrack, localStream);
                    }
                    
                    isCameraOff = false;
                    cameraBtn.textContent = 'Turn Camera Off';
                    cameraBtn.className = 'btn-camera';
                    showStatus('Camera turned on', 'success');
                }
            } catch (error) {
                showStatus('No camera available', 'info');
            }
            return;
        }

        if (isCameraOff) {
            // Turn camera on
            const newStream = await getUserMedia(true, false);
            const newVideoTrack = newStream.getVideoTracks()[0];
            
            if (peerConnection) {
                replaceTrackInPeerConnection(videoTrack, newVideoTrack, newStream);
            }
            
            localStream.removeTrack(videoTrack);
            videoTrack.stop();
            localStream.addTrack(newVideoTrack);
            
            isCameraOff = false;
            cameraBtn.textContent = 'Turn Camera Off';
            cameraBtn.className = 'btn-camera';
            showStatus('Camera turned on', 'success');
        } else {
            // Turn camera off
            videoTrack.enabled = false;
            if (peerConnection) {
                // Send black frame
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const stream = canvas.captureStream(0);
                const newTrack = stream.getVideoTracks()[0];
                replaceTrackInPeerConnection(videoTrack, newTrack, stream);
            }
            
            isCameraOff = true;
            cameraBtn.textContent = 'Turn Camera On';
            cameraBtn.className = 'btn-camera off';
            showStatus('Camera turned off', 'info');
        }
    } catch (error) {
        console.error('❌ Error toggling camera:', error);
        showStatus('Failed to toggle camera', 'error');
    }
}

async function toggleScreenShare() {
    try {
        if (!isSharingScreen) {
            // Start screen sharing
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            screenStream.getVideoTracks()[0].onended = () => {
                toggleScreenShare(); // Stop sharing when user stops
            };

            if (peerConnection) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const audioTrack = screenStream.getAudioTracks()[0];
                
                if (videoTrack) {
                    const localVideoTrack = localStream.getVideoTracks()[0];
                    if (localVideoTrack) {
                        replaceTrackInPeerConnection(localVideoTrack, videoTrack, screenStream);
                    } else {
                        peerConnection.addTrack(videoTrack, screenStream);
                    }
                }
                
                if (audioTrack) {
                    const localAudioTrack = localStream.getAudioTracks()[0];
                    if (localAudioTrack) {
                        replaceTrackInPeerConnection(localAudioTrack, audioTrack, screenStream);
                    }
                }
            }

            // Show screen share in local video
            localVideo.srcObject = screenStream;
            
            isSharingScreen = true;
            screenShareBtn.textContent = 'Stop Sharing';
            screenShareBtn.className = 'btn-screen active';
            showStatus('Screen sharing started', 'success');
        } else {
            // Stop screen sharing
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }

            if (peerConnection && localStream) {
                const localVideoTrack = localStream.getVideoTracks()[0];
                if (localVideoTrack) {
                    const screenVideoTrack = screenStream ? screenStream.getVideoTracks()[0] : null;
                    if (screenVideoTrack) {
                        replaceTrackInPeerConnection(screenVideoTrack, localVideoTrack, localStream);
                    }
                }
            }

            localVideo.srcObject = localStream;
            screenStream = null;
            
            isSharingScreen = false;
            screenShareBtn.textContent = 'Share Screen';
            screenShareBtn.className = 'btn-screen';
            showStatus('Screen sharing stopped', 'info');
        }
    } catch (error) {
        console.error('❌ Error toggling screen share:', error);
        if (error.name !== 'NotAllowedError') {
            showStatus('Failed to share screen', 'error');
        }
        isSharingScreen = false;
        screenShareBtn.textContent = 'Share Screen';
        screenShareBtn.className = 'btn-screen';
    }
}

function endCall() {
    console.log('📴 Leaving call');
    
    if (socket && socket.connected && currentRoomId) {
        socket.emit('leave-room', { roomId: currentRoomId });
    }

    cleanup();
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 WebRTC Client initialized');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Your browser does not support WebRTC. Please use a modern browser.');
        showStatus('Browser not supported', 'error');
        return;
    }

    if (!window.RTCPeerConnection) {
        alert('Your browser does not support WebRTC.');
        showStatus('WebRTC not supported', 'error');
        return;
    }

    initializeSocket();

    window.addEventListener('beforeunload', () => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        endCall();
        if (socket) socket.disconnect();
    });

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
