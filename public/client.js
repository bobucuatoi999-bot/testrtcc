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
let isRoomAdmin = false;        // Whether current user is room admin
let roomHasPassword = false;    // Whether room has password
let pendingPassword = null;     // Password to use when joining (if needed)

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
let nameInput = null;
let roomIdInput = null;
let startVideoBtn = null;
let startVoiceBtn = null;
let muteBtn = null;
let cameraBtn = null;
let screenShareBtn = null;
let endCallBtn = null;
let statusDiv = null;
let chatBtn = null;
let participantsBtn = null;

// ============================================
// Utility Functions
// ============================================

/**
 * Display status message to user
 * @param {string} message - Message to display
 * @param {string} type - Type: 'info', 'success', or 'error'
 */
function showStatus(message, type = 'info') {
    if (!statusDiv) {
        // Try to find status element
        statusDiv = document.getElementById('status');
        if (!statusDiv) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
    }
    
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide info messages after 5 seconds
    if (type === 'info') {
        setTimeout(() => {
            if (statusDiv) {
            statusDiv.style.display = 'none';
            }
        }, 5000);
    }
}

/**
 * Enable or disable UI buttons based on call state
 * @param {boolean} inCall - Whether user is currently in a call
 */
function updateUI(inCall) {
    if (startVideoBtn) startVideoBtn.disabled = inCall;
    if (startVoiceBtn) startVoiceBtn.disabled = inCall;
    if (muteBtn) muteBtn.disabled = !inCall;
    if (cameraBtn) cameraBtn.disabled = !inCall;
    if (screenShareBtn) screenShareBtn.disabled = !inCall;
    if (endCallBtn) endCallBtn.disabled = !inCall;
    if (nameInput) nameInput.disabled = inCall;
    if (roomIdInput) roomIdInput.disabled = inCall;
    
    // Update button states
    if (muteBtn) {
        muteBtn.classList.toggle('active', isMuted);
    }
    if (cameraBtn) {
        cameraBtn.classList.toggle('active', isCameraOff);
    }
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
    
    // Create placeholder for video
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    const avatar = document.createElement('div');
    avatar.className = 'video-placeholder-avatar';
    avatar.textContent = (userName || 'User').charAt(0).toUpperCase();
    placeholder.appendChild(avatar);
    wrapper.appendChild(placeholder);
    
    // Create label
    const label = document.createElement('div');
    label.className = 'video-label';
    label.innerHTML = `<span>${userName || 'User'}</span>`;
    wrapper.appendChild(label);
    
    // Create video element
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.id = `remote-video-${socketId}`;
    video.style.display = 'none'; // Hidden until stream arrives
    wrapper.appendChild(video);
    
    // Add to container
    videoContainer.appendChild(wrapper);
    
    return { videoElement: video, videoWrapper: wrapper, videoLabel: label, placeholder: placeholder };
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
    // Grid layout is handled by CSS media queries
    // Just ensure proper spacing
}

/**
 * Update video label with mute status
 */
function updateVideoLabel(peerData) {
    if (!peerData.videoLabel) return;
    
    const isMuted = peerData.stream && peerData.stream.getAudioTracks().length > 0 && 
                    !peerData.stream.getAudioTracks()[0].enabled;
    
    peerData.videoLabel.innerHTML = `
        <span>${peerData.userName || 'User'}</span>
        ${isMuted ? 
            '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>' :
            '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
        }
    `;
}

/**
 * Update participants list in side panel
 */
function updateParticipantsList() {
    const participantsList = document.getElementById('participantsList');
    const participantsCount = document.getElementById('participantsCount');
    if (!participantsList) return;
    
    const totalCount = 1 + remotePeers.size;
    if (participantsCount) {
        participantsCount.textContent = `Participants (${totalCount})`;
    }
    
    participantsList.innerHTML = '';
    
    // Add local user
    const localItem = document.createElement('div');
    localItem.className = 'participant-item';
    const adminBadge = isRoomAdmin ? `
        <span class="participant-admin">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Admin
        </span>
    ` : '';
    localItem.innerHTML = `
        <div class="participant-info">
            <div class="participant-avatar">${(userName || 'You').charAt(0).toUpperCase()}</div>
            <div>
                <span class="participant-name">${userName || 'You'}</span>
                <span class="participant-host">(You)</span>
                ${adminBadge}
            </div>
        </div>
        <div class="participant-status">
            ${isMuted ? 
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: hsl(var(--destructive));"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
                '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
            }
        </div>
    `;
    participantsList.appendChild(localItem);
    
    // Add remote users
    remotePeers.forEach((peerData, socketId) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        const isRemoteMuted = peerData.stream && peerData.stream.getAudioTracks().length > 0 && 
                             !peerData.stream.getAudioTracks()[0].enabled;
        const remoteAdminBadge = peerData.isAdmin ? `
            <span class="participant-admin">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Admin
            </span>
        ` : '';
        item.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar">${(peerData.userName || 'User').charAt(0).toUpperCase()}</div>
                <div>
                    <span class="participant-name">${peerData.userName || 'User'}</span>
                    ${remoteAdminBadge}
                </div>
            </div>
            <div class="participant-status">
                ${isRemoteMuted ? 
                    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: hsl(var(--destructive));"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
                    '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
                }
            </div>
        `;
        participantsList.appendChild(item);
    });
    
    // Show/hide admin controls
    const adminControls = document.getElementById('adminControls');
    if (adminControls) {
        adminControls.style.display = isRoomAdmin ? 'flex' : 'none';
    }
    
    // Update password button visibility
    const setPasswordBtn = document.getElementById('setPasswordBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    if (setPasswordBtn && resetPasswordBtn) {
        setPasswordBtn.style.display = roomHasPassword ? 'none' : 'flex';
        resetPasswordBtn.style.display = roomHasPassword ? 'flex' : 'none';
    }
}

/**
 * Display meeting ID in the room
 */
function displayMeetingId(roomId) {
    const meetingIdValue = document.getElementById('meetingIdValue');
    if (meetingIdValue && roomId) {
        meetingIdValue.textContent = roomId;
    }
}

/**
 * Copy meeting ID to clipboard
 */
function copyMeetingId() {
    const meetingIdValue = document.getElementById('meetingIdValue');
    if (!meetingIdValue || !meetingIdValue.textContent || meetingIdValue.textContent === '-') {
        showStatus('No meeting ID available', 'error');
        return;
    }
    
    const meetingId = meetingIdValue.textContent;
    
    // Copy to clipboard
    navigator.clipboard.writeText(meetingId).then(() => {
        showStatus('Meeting ID copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: select text
        const range = document.createRange();
        range.selectNode(meetingIdValue);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        try {
            document.execCommand('copy');
            showStatus('Meeting ID copied!', 'success');
        } catch (e) {
            showStatus('Failed to copy meeting ID', 'error');
        }
    });
}

function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    const participantsPanel = document.getElementById('participantsPanel');
    if (chatPanel) {
        const isVisible = chatPanel.style.display !== 'none';
        chatPanel.style.display = isVisible ? 'none' : 'flex';
        // Close participants panel if opening chat
        if (!isVisible && participantsPanel) {
            participantsPanel.style.display = 'none';
        }
    }
}

/**
 * Toggle participants panel
 */
function toggleParticipants() {
    const participantsPanel = document.getElementById('participantsPanel');
    const chatPanel = document.getElementById('chatPanel');
    if (participantsPanel) {
        const isVisible = participantsPanel.style.display !== 'none';
        participantsPanel.style.display = isVisible ? 'none' : 'flex';
        // Close chat panel if opening participants
        if (!isVisible && chatPanel) {
            chatPanel.style.display = 'none';
        }
        // Update participants list
        if (!isVisible) {
            updateParticipantsList();
        }
    }
}

/**
 * Display a chat message in the chat panel
 * @param {Object} messageData - Message object with { id, userName, message, timestamp, socketId }
 * @param {boolean} isOwnMessage - Whether this is the current user's message
 */
/**
 * Get initials from a name for avatar
 */
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Display chat message with avatar
 * @param {Object} messageData - Message object with { id, userName, message, timestamp, socketId }
 * @param {boolean} isOwnMessage - Whether this is the current user's message
 */
function displayChatMessage(messageData, isOwnMessage = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages || !messageData) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwnMessage ? 'chat-message-own' : ''}`;
    messageDiv.dataset.messageId = messageData.id;

    const time = new Date(messageData.timestamp);
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderName = isOwnMessage ? 'You' : (messageData.userName || 'User');
    const initials = getInitials(messageData.userName || 'User');

    if (isOwnMessage) {
        // Own message: right-aligned with avatar on right
        messageDiv.innerHTML = `
            <div class="chat-message-header">
                <span class="chat-message-time">${timeString}</span>
                <span class="chat-message-sender">You</span>
            </div>
            <div class="chat-message-content">
                <div class="chat-message-bubble chat-message-bubble-own">${messageData.message}</div>
                <div class="chat-message-avatar chat-message-avatar-own">${initials}</div>
            </div>
        `;
    } else {
        // Other user's message: left-aligned with avatar on left
        messageDiv.innerHTML = `
            <div class="chat-message-content">
                <div class="chat-message-avatar">${initials}</div>
                <div class="chat-message-bubble-wrapper">
                    <div class="chat-message-header">
                        <span class="chat-message-sender">${senderName}</span>
                        <span class="chat-message-time">${timeString}</span>
                    </div>
                    <div class="chat-message-bubble">${messageData.message}</div>
                </div>
            </div>
        `;
    }

    chatMessages.appendChild(messageDiv);
    
    // Update message count
    updateChatMessageCount();
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Update chat message count in header
 */
function updateChatMessageCount() {
    const chatMessages = document.getElementById('chatMessages');
    const messageCountEl = document.getElementById('chatMessageCount');
    if (!chatMessages || !messageCountEl) return;
    
    const count = chatMessages.children.length;
    messageCountEl.textContent = `${count} message${count !== 1 ? 's' : ''}`;
}

/**
 * Send chat message to server
 */
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !socket || !currentRoomId) return;
    
    const message = chatInput.value.trim();
    if (!message) return;

    // Emit message to server
    socket.emit('chat-message', {
        roomId: currentRoomId,
        message: message
    });

    // Clear input immediately (optimistic UI update)
    chatInput.value = '';
    
    // Note: Message will be displayed when server broadcasts it back
    // This ensures consistency across all clients
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

    // Clear chat messages
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        updateChatMessageCount();
    }
    
    // Reset admin and password status
    isRoomAdmin = false;
    roomHasPassword = false;
    pendingPassword = null;

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
            
            // Set admin status
            isRoomAdmin = data.isAdmin || false;
            roomHasPassword = data.hasPassword || false;
            
            // Display meeting ID
            displayMeetingId(data.roomId);
            
            // Update participants list to show admin badge and controls
            updateParticipantsList();
            
            if (data.userCount >= data.maxUsers) {
                showStatus(`Room is full (${data.userCount}/${data.maxUsers})`, 'info');
            }
            
            if (isRoomAdmin) {
                showStatus('You are the room admin', 'info');
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
                data.users.forEach((userData, index) => {
                    if (userData.peerId && myPeerId) {
                        // Create video element for this user
                        const videoElements = createRemoteVideoElement(userData.socketId, userData.userName);
                        remotePeers.set(userData.socketId, {
                            peerId: userData.peerId,
                            userName: userData.userName || 'User',
                            isAdmin: userData.isAdmin || false,
                            call: null,
                            stream: null,
                            videoElement: videoElements.videoElement,
                            videoWrapper: videoElements.videoWrapper,
                            videoLabel: videoElements.videoLabel,
                            placeholder: videoElements.placeholder
                        });
                        
                        // Connect to this peer with staggered delays to avoid race conditions
                        setTimeout(() => {
                            connectToUser(userData.peerId, userData.socketId);
                        }, 500 + (index * 200));
                    }
                });
                updateVideoGrid();
                // Update participants list
                updateParticipantsList();
            }
        });

        // Handle new user joining
        socket.on('user-joined', (data) => {
            console.log('👤 New user joined:', data.userId, data.userName);
            const remoteUserName = data.userName || 'User';
            
            // If we already have this peer, update the name and admin status
            if (remotePeers.has(data.userId)) {
                const peerData = remotePeers.get(data.userId);
                peerData.userName = remoteUserName;
                peerData.isAdmin = data.isAdmin || false;
                updateVideoLabel(peerData);
                // Update placeholder avatar if visible
                if (peerData.placeholder) {
                    const avatar = peerData.placeholder.querySelector('.video-placeholder-avatar');
                    if (avatar) {
                        avatar.textContent = remoteUserName.charAt(0).toUpperCase();
                    }
                }
                updateParticipantsList();
            } else {
                // Store admin status for when peer-id arrives
                remotePeers.set(data.userId, {
                    userName: remoteUserName,
                    isAdmin: data.isAdmin || false,
                    peerId: null,
                    call: null,
                    stream: null,
                    videoElement: null,
                    videoWrapper: null,
                    videoLabel: null,
                    placeholder: null
                });
            }
            // Otherwise, we'll create the entry when peer-id arrives
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
                        isAdmin: false, // Will be updated when we get user info
                        call: null,
                        stream: null,
                        videoElement: videoElements.videoElement,
                        videoWrapper: videoElements.videoWrapper,
                        videoLabel: videoElements.videoLabel,
                        placeholder: videoElements.placeholder
                    });
                    updateVideoGrid();
                } else {
                    // Update peer ID and user name if available (preserve isAdmin if already set)
                    const peerData = remotePeers.get(data.socketId);
                    if (peerData) {
                        peerData.peerId = data.peerId;
                        // Preserve isAdmin if it was already set
                        if (peerData.isAdmin === undefined) {
                            peerData.isAdmin = false;
                        }
                        // Update label if we have user name
                        updateVideoLabel(peerData);
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
                // Update participants list
                updateParticipantsList();
            }
        });

        // Handle call ended (by another user)
        socket.on('call-ended', (data) => {
            console.log('📴 Call ended by user:', data.userId);
            if (remotePeers.has(data.userId)) {
                cleanupRemotePeer(data.userId);
                showStatus('User ended their call. You can stay and wait for others...', 'info');
                // Update participants list
                updateParticipantsList();
            }
        });

        // Handle chat messages
        socket.on('chat-message', (messageData) => {
            if (!messageData) return;
            
            // Check if this is our own message
            const isOwnMessage = messageData.socketId === socket.id;
            
            // Display the message
            displayChatMessage(messageData, isOwnMessage);
        });

        // Handle chat history (when joining a room with existing messages)
        socket.on('chat-history', (data) => {
            if (!data || !data.messages || !Array.isArray(data.messages)) return;
            
            const chatMessages = document.getElementById('chatMessages');
            if (!chatMessages) return;

            // Clear existing messages
            chatMessages.innerHTML = '';

            // Display all messages
            data.messages.forEach(messageData => {
                const isOwnMessage = messageData.socketId === socket.id;
                displayChatMessage(messageData, isOwnMessage);
            });

            // Update message count
            updateChatMessageCount();

            console.log(`💬 Loaded ${data.messages.length} chat message(s) from history`);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error('❌ Server error:', error);
            
            // Handle password errors
            if (error.code === 'WRONG_PASSWORD' || (error.message && error.message.includes('password'))) {
                showPasswordModal();
                const errorDiv = document.getElementById('passwordError');
                if (errorDiv) {
                    errorDiv.textContent = error.message || 'Incorrect password. Please try again.';
                    errorDiv.style.display = 'block';
                }
                return;
            }
            
            // Show error message but don't interrupt chat if it's a rate limit error
            if (error.message && error.message.includes('Rate limit')) {
                // Show temporary error in chat input area
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    const originalPlaceholder = chatInput.placeholder;
                    chatInput.placeholder = error.message;
                    setTimeout(() => {
                        chatInput.placeholder = originalPlaceholder;
                    }, 3000);
                }
                return;
            }
            
            showStatus(error.message || 'An error occurred', 'error');
        });
        
        // Handle password set success
        socket.on('password-set-success', (data) => {
            roomHasPassword = true;
            updateParticipantsList();
            showStatus('Password set successfully', 'success');
        });
        
        // Handle password reset success
        socket.on('password-reset-success', (data) => {
            roomHasPassword = false;
            updateParticipantsList();
            showStatus('Password removed successfully', 'success');
        });
        
        // Handle room password updated (broadcast to all users)
        socket.on('room-password-updated', (data) => {
            roomHasPassword = data.hasPassword || false;
            updateParticipantsList();
            if (data.hasPassword) {
                showStatus('Room password has been set', 'info');
            } else {
                showStatus('Room password has been removed', 'info');
            }
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
                peerData.videoElement.style.display = 'block';
                // Hide placeholder
                if (peerData.placeholder) {
                    peerData.placeholder.style.display = 'none';
                }
                // Update label with user name if available
                updateVideoLabel(peerData);
                console.log('✅ Stream assigned to socket:', targetSocketId);
            } else {
                // Try to find by peer ID
                for (const [socketId, peerData] of remotePeers.entries()) {
                    if (peerData.peerId === call.peer) {
                        peerData.call = call;
                        peerData.stream = stream;
                        peerData.videoElement.srcObject = stream;
                        peerData.videoElement.style.display = 'block';
                        // Hide placeholder
                        if (peerData.placeholder) {
                            peerData.placeholder.style.display = 'none';
                        }
                        // Update label with user name if available
                        updateVideoLabel(peerData);
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
            
            // Update participants list
            updateParticipantsList();
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
/**
 * Password Modal Functions
 */
function showPasswordModal() {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    if (modal && input) {
        modal.style.display = 'flex';
        input.value = '';
        input.focus();
        if (error) error.style.display = 'none';
    }
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function togglePasswordVisibility() {
    const input = document.getElementById('passwordInput');
    const showIcon = document.getElementById('passwordShowIcon');
    const hideIcon = document.getElementById('passwordHideIcon');
    if (input && showIcon && hideIcon) {
        if (input.type === 'password') {
            input.type = 'text';
            showIcon.style.display = 'block';
            hideIcon.style.display = 'none';
        } else {
            input.type = 'password';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'block';
        }
    }
}

function submitPassword() {
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    if (!input) return;
    
    const password = input.value.trim();
    if (!password) {
        if (error) {
            error.textContent = 'Please enter a password';
            error.style.display = 'block';
        }
        return;
    }
    
    pendingPassword = password;
    closePasswordModal();
    
    // Retry joining with password
    const urlParams = new URLSearchParams(window.location.search);
    const video = urlParams.get('video') === 'true';
    startCall(video);
}

/**
 * Admin Password Modal Functions
 */
function openSetPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const title = document.getElementById('adminPasswordModalTitle');
    const description = document.getElementById('adminPasswordModalDescription');
    const input = document.getElementById('adminPasswordInput');
    const submitBtn = document.getElementById('adminPasswordSubmitBtn');
    const error = document.getElementById('adminPasswordError');
    
    if (modal && title && description && input && submitBtn) {
        title.textContent = 'Set Room Password';
        description.textContent = 'Set a password to protect this room. Users will need to enter this password to join.';
        submitBtn.textContent = 'Set Password';
        submitBtn.onclick = submitAdminPassword;
        input.value = '';
        input.focus();
        if (error) error.style.display = 'none';
        modal.style.display = 'flex';
    }
}

function openResetPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const title = document.getElementById('adminPasswordModalTitle');
    const description = document.getElementById('adminPasswordModalDescription');
    const input = document.getElementById('adminPasswordInput');
    const submitBtn = document.getElementById('adminPasswordSubmitBtn');
    const error = document.getElementById('adminPasswordError');
    
    if (modal && title && description && input && submitBtn) {
        title.textContent = 'Remove Room Password';
        description.textContent = 'Are you sure you want to remove the password? The room will become open to anyone with the meeting ID.';
        submitBtn.textContent = 'Remove Password';
        submitBtn.onclick = resetAdminPassword;
        input.value = '';
        input.style.display = 'none';
        if (error) error.style.display = 'none';
        modal.style.display = 'flex';
    }
}

function closeAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const input = document.getElementById('adminPasswordInput');
    if (modal) {
        modal.style.display = 'none';
        if (input) {
            input.style.display = 'block';
            input.type = 'password';
        }
    }
}

function toggleAdminPasswordVisibility() {
    const input = document.getElementById('adminPasswordInput');
    const showIcon = document.getElementById('adminPasswordShowIcon');
    const hideIcon = document.getElementById('adminPasswordHideIcon');
    if (input && showIcon && hideIcon) {
        if (input.type === 'password') {
            input.type = 'text';
            showIcon.style.display = 'block';
            hideIcon.style.display = 'none';
        } else {
            input.type = 'password';
            showIcon.style.display = 'none';
            hideIcon.style.display = 'block';
        }
    }
}

function submitAdminPassword() {
    const input = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminPasswordError');
    
    if (!input || !currentRoomId || !socket) return;
    
    const password = input.value.trim();
    if (!password) {
        if (error) {
            error.textContent = 'Please enter a password';
            error.style.display = 'block';
        }
        return;
    }
    
    // Send password to server
    socket.emit('set-room-password', {
        roomId: currentRoomId,
        password: password
    });
    
    closeAdminPasswordModal();
}

function resetAdminPassword() {
    if (!currentRoomId || !socket) return;
    
    // Send reset password to server
    socket.emit('reset-room-password', {
        roomId: currentRoomId
    });
    
    closeAdminPasswordModal();
}

async function startCall(withVideo) {
    try {
        // Get user name and room ID from inputs or URL parameters
        if (nameInput) {
        userName = nameInput.value.trim();
        } else {
            // Try to get from URL params (for meeting.html)
            const urlParams = new URLSearchParams(window.location.search);
            userName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')) : null;
        }
        
        let roomId;
        if (roomIdInput) {
            roomId = roomIdInput.value.trim();
        } else {
            // Try to get from URL params (for meeting.html)
            const urlParams = new URLSearchParams(window.location.search);
            roomId = urlParams.get('room') || '';
        }

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
            localVideoWrapper.className = 'video-wrapper active';
            localVideoWrapper.id = 'local-video-wrapper';
            
            // Create placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'video-placeholder';
            placeholder.id = 'local-placeholder';
            const avatar = document.createElement('div');
            avatar.className = 'video-placeholder-avatar';
            avatar.textContent = (userName || 'You').charAt(0).toUpperCase();
            placeholder.appendChild(avatar);
            localVideoWrapper.appendChild(placeholder);
            
            localVideoLabel = document.createElement('div');
            localVideoLabel.className = 'video-label';
            localVideoLabel.innerHTML = `
                <span>${userName || 'You'}</span>
                <svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            `;
            localVideoWrapper.appendChild(localVideoLabel);
            
            localVideo = document.createElement('video');
            localVideo.autoplay = true;
            localVideo.playsInline = true;
            localVideo.muted = true; // Always mute local video
            localVideo.id = 'localVideo';
            localVideo.style.display = 'none'; // Hidden until stream arrives
            localVideoWrapper.appendChild(localVideo);
            
            // Insert at the beginning of video container
            videoContainer.insertBefore(localVideoWrapper, videoContainer.firstChild);
        }
        
        // Update local video label
        if (localVideoLabel) {
            localVideoLabel.innerHTML = `
                <span>${userName || 'You'}</span>
                ${isMuted ? 
                    '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
                    '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
                }
            `;
        }

        // Try to get user media (but continue even if it fails)
        try {
            localStream = await getUserMedia(withVideo, true);
            if (localStream && localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                // Hide placeholder
                const placeholder = document.getElementById('local-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
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
            userName: userName,
            password: pendingPassword || undefined
        });
        
        // Clear pending password after use
        pendingPassword = null;

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
        if (muteBtn) {
        if (!localStream || localStream.getAudioTracks().length === 0) {
            muteBtn.disabled = true;
                const label = muteBtn.querySelector('.control-label');
                if (label) label.textContent = 'No Mic';
        }
        }
        if (cameraBtn) {
        if (!localStream || localStream.getVideoTracks().length === 0) {
            cameraBtn.disabled = true;
                const label = cameraBtn.querySelector('.control-label');
                if (label) label.textContent = 'No Camera';
            }
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
                peerData.videoElement.style.display = 'block';
                // Hide placeholder
                if (peerData.placeholder) {
                    peerData.placeholder.style.display = 'none';
                }
                updateVideoLabel(peerData);
                console.log('✅ Stream assigned to socket:', socketId);
            } else {
                // Try to find by peer ID
                for (const [sid, peerData] of remotePeers.entries()) {
                    if (peerData.peerId === peerId) {
                        peerData.stream = stream;
                        peerData.call = call;
                        peerData.videoElement.srcObject = stream;
                        peerData.videoElement.style.display = 'block';
                        // Hide placeholder
                        if (peerData.placeholder) {
                            peerData.placeholder.style.display = 'none';
                        }
                        updateVideoLabel(peerData);
                        console.log('✅ Stream assigned (found by peer ID):', sid);
                        break;
                    }
                }
            }
            
            // Update UI if needed
            if (remotePeers.size > 0) {
            updateUI(true);
            }
            
            // Update participants list
            updateParticipantsList();
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

        if (muteBtn) {
            muteBtn.classList.toggle('active', isMuted);
            const label = muteBtn.querySelector('.control-label');
            if (label) {
                label.textContent = isMuted ? 'Unmute' : 'Mute';
            }
        }

        // Update local video label
        if (localVideoLabel) {
            localVideoLabel.innerHTML = `
                <span>${userName || 'You'}</span>
                ${isMuted ? 
                    '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
                    '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
                }
            `;
        }

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

        if (cameraBtn) {
            cameraBtn.classList.toggle('active', isCameraOff);
            const label = cameraBtn.querySelector('.control-label');
            if (label) {
                label.textContent = isCameraOff ? 'Start Video' : 'Stop Video';
            }
        }

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
            if (screenShareBtn) {
                const label = screenShareBtn.querySelector('.control-label');
                if (label) label.textContent = 'Share Screen';
            }
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
                    if (screenShareBtn) {
                        const label = screenShareBtn.querySelector('.control-label');
                        if (label) label.textContent = 'Stop Sharing';
                        screenShareBtn.classList.add('active');
                    }
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

        // Navigate back to home page after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);

    } catch (error) {
        console.error('❌ Error ending call:', error);
        cleanup(); // Clean up anyway
        // Navigate back to home page
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }
}

// ============================================
// Initialize on Page Load
// ============================================

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Page loaded, initializing...');
    
    // Initialize video container reference
    videoContainer = document.querySelector('.video-container') || document.querySelector('.video-grid') || document.getElementById('videoContainer');
    if (!videoContainer) {
        console.error('❌ Video container not found!');
        return;
    }
    
    // Initialize DOM elements (may not exist on meeting page)
    nameInput = document.getElementById('nameInput');
    roomIdInput = document.getElementById('roomIdInput');
    startVideoBtn = document.getElementById('startVideoBtn');
    startVoiceBtn = document.getElementById('startVideoBtn'); // Fallback
    muteBtn = document.getElementById('muteBtn');
    cameraBtn = document.getElementById('cameraBtn');
    screenShareBtn = document.getElementById('screenShareBtn');
    endCallBtn = document.getElementById('endCallBtn');
    statusDiv = document.getElementById('status');
    chatBtn = document.getElementById('chatBtn');
    participantsBtn = document.getElementById('participantsBtn');
    
    // Display meeting ID from URL params if available (fallback)
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    if (roomIdFromUrl) {
        displayMeetingId(roomIdFromUrl);
    }
    
    // Clear any existing video elements (they will be created dynamically)
    const existingVideos = videoContainer.querySelectorAll('.video-wrapper');
    existingVideos.forEach(video => video.remove());
    
    // Initialize socket connection
    initializeSocket();
    
    // Initialize PeerJS
    initializePeer();
    
    if (statusDiv) {
    showStatus('Ready to start a call', 'info');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    cleanup();
});

