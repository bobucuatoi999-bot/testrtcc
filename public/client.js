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
// Format: { socketId: { peerId, userName, call, stream, videoElement, videoWrapper, videoLabel, isSharingScreen } }
let remotePeers = new Map();

// Zoom view state
let zoomedVideoElement = null;
let zoomedVideoWrapper = null;

// Maximum users per room
const MAX_USERS = 7;

// Connection timeout constants (in milliseconds)
const CONNECTION_TIMEOUTS = {
    PEER_INIT: 10000,        // 10 seconds for PeerJS initialization
    STREAM_LOAD: 15000,      // 15 seconds for stream to load
    CALL_CONNECT: 20000,     // 20 seconds for call to connect
    RETRY_DELAY: 2000,       // Initial retry delay
    MAX_RETRIES: 5           // Maximum retry attempts
};

// ============================================
// Server Configuration
// ============================================
// Get server URL from config.js (set for Railway deployment)
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// WebRTC Configuration with FREE STUN and TURN servers
// Multiple STUN servers + Multiple TURN servers for reliability
const rtcConfig = {
    iceServers: [
        // Free Google STUN servers (multiple for redundancy)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional STUN servers
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com' },
        { urls: 'stun:stun.voipbuster.com' },
        // Free TURN servers (multiple for redundancy)
        { 
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // Additional free TURN server
        {
            urls: [
                'turn:relay.metered.ca:80',
                'turn:relay.metered.ca:443',
                'turn:relay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' // Use both relay and direct connections
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
    
    // Create placeholder for video with loading indicator
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    const avatar = document.createElement('div');
    avatar.className = 'video-placeholder-avatar';
    avatar.textContent = (userName || 'User').charAt(0).toUpperCase();
    
    // Add loading spinner
    const loadingSpinner = document.createElement('div');
    loadingSpinner.className = 'loading-spinner';
    loadingSpinner.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
    `;
    loadingSpinner.style.display = 'none';
    loadingSpinner.style.position = 'absolute';
    loadingSpinner.style.bottom = '1rem';
    loadingSpinner.style.color = 'hsl(var(--muted-foreground))';
    
    placeholder.appendChild(avatar);
    placeholder.appendChild(loadingSpinner);
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
    
    return { videoElement: video, videoWrapper: wrapper, videoLabel: label, placeholder: placeholder, loadingSpinner: loadingSpinner };
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
 * Update local video label with user name and status
 */
function updateLocalVideoLabel() {
    if (!localVideoLabel) return;
    
    const muted = isMuted || false;
    const isSharing = isSharingScreen || false;
    
    // Add screen sharing indicator
    const screenShareIndicator = isSharing ? `
        <span class="screen-share-indicator">
            <span class="screen-share-dot"></span>
            <span class="screen-share-text">now live</span>
        </span>
    ` : '';
    
    localVideoLabel.innerHTML = `
        <span>${userName || 'You'}</span>
        ${screenShareIndicator}
        ${muted ? 
            '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
            '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
        }
    `;
    
    // Make local video wrapper clickable if sharing
    if (localVideoWrapper) {
        if (isSharing) {
            localVideoWrapper.classList.add('sharing-screen');
            localVideoWrapper.style.cursor = 'pointer';
            localVideoWrapper.onclick = () => zoomToLocalVideo();
        } else {
            localVideoWrapper.classList.remove('sharing-screen');
            localVideoWrapper.style.cursor = '';
            localVideoWrapper.onclick = null;
        }
    }
}

/**
 * Update video label with mute status and screen sharing
 */
function updateVideoLabel(peerData) {
    if (!peerData || !peerData.videoLabel) return;
    
    const userName = peerData.userName || 'User';
    const isMuted = peerData.stream && peerData.stream.getAudioTracks().length > 0 && 
                   !peerData.stream.getAudioTracks()[0].enabled;
    const isSharing = peerData.isSharingScreen || false;
    
    // Add screen sharing indicator
    const screenShareIndicator = isSharing ? `
        <span class="screen-share-indicator">
            <span class="screen-share-dot"></span>
            <span class="screen-share-text">now live</span>
        </span>
    ` : '';
    
    peerData.videoLabel.innerHTML = `
        <span>${userName}</span>
        ${screenShareIndicator}
        ${isMuted ? 
            '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
            '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
        }
    `;
    
    // Make video wrapper clickable if sharing screen OR if they have a video stream
    if (peerData.videoWrapper) {
        const hasVideoStream = peerData.videoElement && peerData.videoElement.srcObject && 
                              peerData.videoElement.srcObject.getVideoTracks().length > 0;
        
        if (isSharing || hasVideoStream) {
            // Add sharing-screen class only if actually sharing
            if (isSharing) {
                peerData.videoWrapper.classList.add('sharing-screen');
            } else {
                peerData.videoWrapper.classList.remove('sharing-screen');
            }
            // Make clickable to zoom in
            peerData.videoWrapper.style.cursor = 'pointer';
            peerData.videoWrapper.onclick = () => zoomToVideo(peerData);
            peerData.videoWrapper.title = isSharing ? 'Click to view full screen (live)' : 'Click to view full screen';
        } else {
            peerData.videoWrapper.classList.remove('sharing-screen');
            peerData.videoWrapper.style.cursor = '';
            peerData.videoWrapper.onclick = null;
            peerData.videoWrapper.title = '';
        }
    }
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
    
    // Update password button visibility (only for admin)
    if (isRoomAdmin) {
        const setPasswordBtn = document.getElementById('setPasswordBtn');
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');
        if (setPasswordBtn && resetPasswordBtn) {
            setPasswordBtn.style.display = roomHasPassword ? 'none' : 'flex';
            resetPasswordBtn.style.display = roomHasPassword ? 'flex' : 'none';
        }
        
        // Show config password button in control bar
        const configPasswordBtn = document.getElementById('configPasswordBtn');
        if (configPasswordBtn) {
            configPasswordBtn.style.display = 'flex';
        }
    } else {
        // Hide config password button for non-admin
        const configPasswordBtn = document.getElementById('configPasswordBtn');
        if (configPasswordBtn) {
            configPasswordBtn.style.display = 'none';
        }
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
 * Display room password status
 */
function displayRoomPassword(hasPassword) {
    const passwordDisplay = document.getElementById('roomPasswordDisplay');
    if (passwordDisplay) {
        passwordDisplay.style.display = hasPassword ? 'flex' : 'none';
    }
}

/**
 * Toggle password config modal (admin only)
 */
function togglePasswordConfig() {
    if (!isRoomAdmin) return;
    
    if (roomHasPassword) {
        openResetPasswordModal();
    } else {
        openSetPasswordModal();
    }
}

/**
 * Initialize draggable meeting ID display
 */
function initializeDraggableMeetingId() {
    const meetingIdDisplay = document.getElementById('meetingIdDisplay');
    if (!meetingIdDisplay) return;
    
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    
    // Get saved position from localStorage
    const savedPosition = localStorage.getItem('meetingIdPosition');
    if (savedPosition) {
        try {
            const { x, y } = JSON.parse(savedPosition);
            meetingIdDisplay.style.left = x + 'px';
            meetingIdDisplay.style.top = y + 'px';
        } catch (e) {
            console.warn('Failed to load saved position:', e);
        }
    }
    
    // Mouse down - start dragging
    meetingIdDisplay.addEventListener('mousedown', (e) => {
        // Don't drag if clicking on buttons or interactive elements
        if (e.target.closest('button') || e.target.closest('svg')) {
            return;
        }
        
        isDragging = true;
        meetingIdDisplay.classList.add('dragging');
        
        initialX = e.clientX - meetingIdDisplay.offsetLeft;
        initialY = e.clientY - meetingIdDisplay.offsetTop;
        
        e.preventDefault();
    });
    
    // Mouse move - update position
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        
        // Constrain to viewport
        const maxX = window.innerWidth - meetingIdDisplay.offsetWidth;
        const maxY = window.innerHeight - meetingIdDisplay.offsetHeight - 100; // Leave space for control bar
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        meetingIdDisplay.style.left = currentX + 'px';
        meetingIdDisplay.style.top = currentY + 'px';
    });
    
    // Mouse up - stop dragging
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            meetingIdDisplay.classList.remove('dragging');
            
            // Save position to localStorage
            const position = {
                x: currentX || meetingIdDisplay.offsetLeft,
                y: currentY || meetingIdDisplay.offsetTop
            };
            localStorage.setItem('meetingIdPosition', JSON.stringify(position));
        }
    });
    
    // Touch support for mobile
    let touchStartX = 0;
    let touchStartY = 0;
    
    meetingIdDisplay.addEventListener('touchstart', (e) => {
        if (e.target.closest('button') || e.target.closest('svg')) {
            return;
        }
        
        isDragging = true;
        meetingIdDisplay.classList.add('dragging');
        
        const touch = e.touches[0];
        touchStartX = touch.clientX - meetingIdDisplay.offsetLeft;
        touchStartY = touch.clientY - meetingIdDisplay.offsetTop;
        
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        currentX = touch.clientX - touchStartX;
        currentY = touch.clientY - touchStartY;
        
        // Constrain to viewport
        const maxX = window.innerWidth - meetingIdDisplay.offsetWidth;
        const maxY = window.innerHeight - meetingIdDisplay.offsetHeight - 100;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        
        meetingIdDisplay.style.left = currentX + 'px';
        meetingIdDisplay.style.top = currentY + 'px';
    });
    
    document.addEventListener('touchend', () => {
        if (isDragging) {
            isDragging = false;
            meetingIdDisplay.classList.remove('dragging');
            
            const position = {
                x: currentX || meetingIdDisplay.offsetLeft,
                y: currentY || meetingIdDisplay.offsetTop
            };
            localStorage.setItem('meetingIdPosition', JSON.stringify(position));
        }
    });
}

/**
 * Zoom to a remote video (when user is sharing screen)
 * @param {Object} peerData - Peer data object
 */
function zoomToVideo(peerData) {
    if (!peerData || !peerData.videoElement) {
        console.warn('⚠️ Cannot zoom: invalid peer data or video element');
        return;
    }
    
    // Check if user is sharing screen (preferred) or if they have any video stream
    const hasStream = peerData.videoElement && peerData.videoElement.srcObject;
    if (!hasStream) {
        console.warn('⚠️ Cannot zoom: no video stream available');
        return;
    }
    
    // Close existing zoom if any
    closeZoomView();
    
    // Create zoom overlay (full screen)
    const zoomOverlay = document.createElement('div');
    zoomOverlay.className = 'zoom-overlay';
    zoomOverlay.id = 'zoomOverlay';
    
    const zoomContent = document.createElement('div');
    zoomContent.className = 'zoom-content';
    
    const zoomVideo = document.createElement('video');
    zoomVideo.autoplay = true;
    zoomVideo.playsInline = true;
    zoomVideo.srcObject = peerData.videoElement.srcObject;
    zoomVideo.className = 'zoom-video';
    zoomVideo.controls = false; // No controls for cleaner view
    
    // Show label only if sharing screen
    if (peerData.isSharingScreen) {
        const zoomLabel = document.createElement('div');
        zoomLabel.className = 'zoom-label';
        zoomLabel.innerHTML = `
            <span>${peerData.userName || 'User'}</span>
            <span class="screen-share-indicator">
                <span class="screen-share-dot"></span>
                <span class="screen-share-text">now live</span>
            </span>
        `;
        zoomContent.appendChild(zoomLabel);
    }
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zoom-close-btn';
    closeBtn.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    `;
    closeBtn.onclick = closeZoomView;
    closeBtn.title = 'Close (Esc)';
    
    zoomContent.appendChild(zoomVideo);
    zoomContent.appendChild(closeBtn);
    zoomOverlay.appendChild(zoomContent);
    
    document.body.appendChild(zoomOverlay);
    
    // Store references
    zoomedVideoElement = zoomVideo;
    zoomedVideoWrapper = zoomOverlay;
    
    // Prevent body scroll when zoomed
    document.body.style.overflow = 'hidden';
    
    // Close on overlay click (but not on content click)
    zoomOverlay.onclick = (e) => {
        if (e.target === zoomOverlay) {
            closeZoomView();
        }
    };
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeZoomView();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    console.log('✅ Opened full-screen view for', peerData.userName || 'User');
}

/**
 * Zoom to local video (when sharing screen)
 */
function zoomToLocalVideo() {
    if (!localVideo || !isSharingScreen) return;
    
    // Close existing zoom if any
    closeZoomView();
    
    // Create zoom overlay
    const zoomOverlay = document.createElement('div');
    zoomOverlay.className = 'zoom-overlay';
    zoomOverlay.id = 'zoomOverlay';
    
    const zoomContent = document.createElement('div');
    zoomContent.className = 'zoom-content';
    
    const zoomVideo = document.createElement('video');
    zoomVideo.autoplay = true;
    zoomVideo.playsInline = true;
    zoomVideo.srcObject = localVideo.srcObject;
    zoomVideo.className = 'zoom-video';
    zoomVideo.muted = true; // Always mute local video
    
    const zoomLabel = document.createElement('div');
    zoomLabel.className = 'zoom-label';
    zoomLabel.innerHTML = `
        <span>${userName || 'You'}</span>
        <span class="screen-share-indicator">
            <span class="screen-share-dot"></span>
            <span class="screen-share-text">now live</span>
        </span>
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'zoom-close-btn';
    closeBtn.innerHTML = `
        <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    `;
    closeBtn.onclick = closeZoomView;
    
    zoomContent.appendChild(zoomVideo);
    zoomContent.appendChild(zoomLabel);
    zoomContent.appendChild(closeBtn);
    zoomOverlay.appendChild(zoomContent);
    
    document.body.appendChild(zoomOverlay);
    
    // Store references
    zoomedVideoElement = zoomVideo;
    zoomedVideoWrapper = zoomOverlay;
    
    // Close on overlay click (but not on content click)
    zoomOverlay.onclick = (e) => {
        if (e.target === zoomOverlay) {
            closeZoomView();
        }
    };
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeZoomView();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

/**
 * Close zoom view
 */
function closeZoomView() {
    // Restore body scroll
    document.body.style.overflow = '';
    
    if (zoomedVideoWrapper) {
        zoomedVideoWrapper.remove();
        zoomedVideoWrapper = null;
    }
    if (zoomedVideoElement) {
        zoomedVideoElement.srcObject = null;
        zoomedVideoElement = null;
    }
    
    console.log('✅ Closed full-screen view');
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
    
    // Clear any pending timeouts
    if (peerData.streamTimeout) {
        clearTimeout(peerData.streamTimeout);
        peerData.streamTimeout = null;
    }
    
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
            transports: ['websocket', 'polling'], // Try both transports
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 10, // Increased for slow connections
            timeout: 20000, // 20 second connection timeout
            forceNew: false
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
            
            // Display password status
            displayRoomPassword(roomHasPassword);
            
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
                            isSharingScreen: false,
                            call: null,
                            stream: null,
                            videoElement: videoElements.videoElement,
                            videoWrapper: videoElements.videoWrapper,
                            videoLabel: videoElements.videoLabel,
                            placeholder: videoElements.placeholder,
                            loadingSpinner: videoElements.loadingSpinner,
                            connectionAttempts: 0,
                            streamTimeout: null
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
                if (peerData.videoLabel) {
                    updateVideoLabel(peerData);
                }
                // Update placeholder avatar if visible
                if (peerData.placeholder) {
                    const avatar = peerData.placeholder.querySelector('.video-placeholder-avatar');
                    if (avatar) {
                        avatar.textContent = remoteUserName.charAt(0).toUpperCase();
                    }
                }
                updateParticipantsList();
            } else {
                // Create video element immediately for new user (even without peer-id yet)
                const videoElements = createRemoteVideoElement(data.userId, remoteUserName);
                remotePeers.set(data.userId, {
                    userName: remoteUserName,
                    isAdmin: data.isAdmin || false,
                    isSharingScreen: false,
                    peerId: null, // Will be set when peer-id arrives
                    call: null,
                    stream: null,
                    videoElement: videoElements.videoElement,
                    videoWrapper: videoElements.videoWrapper,
                    videoLabel: videoElements.videoLabel,
                    placeholder: videoElements.placeholder,
                    loadingSpinner: videoElements.loadingSpinner,
                    connectionAttempts: 0,
                    streamTimeout: null
                });
                updateVideoGrid();
                updateParticipantsList();
                console.log('✅ Created video element for new user:', data.userId);
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
                        isAdmin: false, // Will be updated when we get user info
                        isSharingScreen: false,
                        call: null,
                        stream: null,
                        videoElement: videoElements.videoElement,
                        videoWrapper: videoElements.videoWrapper,
                        videoLabel: videoElements.videoLabel,
                        placeholder: videoElements.placeholder,
                        loadingSpinner: videoElements.loadingSpinner,
                        connectionAttempts: 0,
                        streamTimeout: null
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
            displayRoomPassword(true);
            updateParticipantsList();
            showStatus('Password set successfully', 'success');
        });
        
        // Handle password reset success
        socket.on('password-reset-success', (data) => {
            roomHasPassword = false;
            displayRoomPassword(false);
            updateParticipantsList();
            showStatus('Password removed successfully', 'success');
        });
        
        // Handle room password updated (broadcast to all users)
        socket.on('room-password-updated', (data) => {
            roomHasPassword = data.hasPassword || false;
            displayRoomPassword(roomHasPassword);
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
        // Use PeerJS cloud service (no key specified) for better connectivity
        peer = new Peer({
            config: rtcConfig,
            debug: 1 // Reduced debug logging for production
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
            
            // Answer the call with local stream (or empty stream if no media)
            let streamToSend;
            if (localStream) {
                streamToSend = localStream;
            } else {
                streamToSend = new MediaStream();
                console.log('📡 Answering call with empty stream (no local media)');
            }
            call.answer(streamToSend);

            // Handle remote stream
            call.on('stream', (stream) => {
            console.log('✅ Received remote stream from PeerJS ID:', call.peer);
            
            // Find or create peer entry
            if (targetSocketId && remotePeers.has(targetSocketId)) {
                const peerData = remotePeers.get(targetSocketId);
                peerData.call = call;
                peerData.stream = stream;
                // Ensure video element exists before setting srcObject
                if (peerData.videoElement) {
                    peerData.videoElement.srcObject = stream;
                    peerData.videoElement.style.display = 'block';
                } else {
                    console.warn('⚠️ Video element not found for socket:', targetSocketId);
                    // Create video element if missing
                    const videoElements = createRemoteVideoElement(targetSocketId, peerData.userName || 'User');
                    peerData.videoElement = videoElements.videoElement;
                    peerData.videoWrapper = videoElements.videoWrapper;
                    peerData.videoLabel = videoElements.videoLabel;
                    peerData.placeholder = videoElements.placeholder;
                    peerData.videoElement.srcObject = stream;
                    peerData.videoElement.style.display = 'block';
                    updateVideoGrid();
                }
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
                        // Ensure video element exists before setting srcObject
                        if (peerData.videoElement) {
                            peerData.videoElement.srcObject = stream;
                            peerData.videoElement.style.display = 'block';
                        } else {
                            console.warn('⚠️ Video element not found for peer:', call.peer);
                            // Create video element if missing
                            const videoElements = createRemoteVideoElement(socketId, peerData.userName || 'User');
                            peerData.videoElement = videoElements.videoElement;
                            peerData.videoWrapper = videoElements.videoWrapper;
                            peerData.videoLabel = videoElements.videoLabel;
                            peerData.placeholder = videoElements.placeholder;
                            peerData.videoElement.srcObject = stream;
                            peerData.videoElement.style.display = 'block';
                            updateVideoGrid();
                        }
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
    // Try with ideal constraints first
    let constraints = {
        video: withVideo ? {
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } : false,
        audio: withAudio ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } : false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('✅ Got media stream:', {
            video: stream.getVideoTracks().length > 0,
            audio: stream.getAudioTracks().length > 0
        });
        return stream;
    } catch (error) {
        console.warn('⚠️ Failed with ideal constraints, trying basic constraints...', error);
        
        // Fallback 1: Try without ideal constraints
        try {
            constraints = {
                video: withVideo ? true : false,
                audio: withAudio ? true : false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('✅ Got media stream with basic constraints');
            return stream;
        } catch (error2) {
            console.warn('⚠️ Failed with basic constraints, trying audio only...', error2);
            
            // Fallback 2: If video fails, try audio only
            if (withVideo && withAudio) {
                try {
                    constraints = {
                        video: false,
                        audio: withAudio ? true : false
                    };
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    console.log('✅ Got audio-only stream');
                    return stream;
                } catch (error3) {
                    console.warn('⚠️ All getUserMedia attempts failed');
                }
            }
        }
    }
    
    // If all attempts failed, log but don't throw - let caller handle gracefully
    console.warn('⚠️ Could not access media devices. User can still join and receive streams.');
    
    // Provide user-friendly error message (non-blocking)
    let errorMessage = 'Could not access ';
    if (withVideo && withAudio) {
        errorMessage += 'camera and microphone';
    } else if (withVideo) {
        errorMessage += 'camera';
    } else {
        errorMessage += 'microphone';
    }
    errorMessage += '. You can still join and receive audio/video from others.';
    
    showStatus(errorMessage, 'info'); // Use 'info' instead of 'error' to be less alarming
    
    // Return null instead of throwing - caller should handle this gracefully
    return null;
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
        const urlParams = new URLSearchParams(window.location.search);
        
        if (nameInput) {
        userName = nameInput.value.trim();
        } else {
            // Try to get from URL params (for meeting.html)
            userName = urlParams.get('name') ? decodeURIComponent(urlParams.get('name')) : null;
        }
        
        let roomId;
        if (roomIdInput) {
            roomId = roomIdInput.value.trim();
        } else {
            // Try to get from URL params (for meeting.html)
            roomId = urlParams.get('room') || '';
        }
        
        // Get password from URL params if provided (for new meetings)
        const urlPassword = urlParams.get('password');
        if (urlPassword && !pendingPassword) {
            pendingPassword = decodeURIComponent(urlPassword);
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
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.warn('⚠️ Socket connection timeout');
                        showStatus('Slow connection detected. Still connecting...', 'info');
                        resolve();
                    }
                }, CONNECTION_TIMEOUTS.PEER_INIT);
                
                if (socket) {
                    socket.once('connect', () => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                } else {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });
        }

        // Initialize PeerJS if not already initialized
        if (!peer || peer.destroyed) {
            initializePeer();
            // Wait for peer to be ready with timeout
            await new Promise((resolve) => {
                let resolved = false;
                const timeout = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        console.warn('⚠️ PeerJS initialization timeout');
                        showStatus('Slow connection detected. Still connecting...', 'info');
                        resolve();
                    }
                }, CONNECTION_TIMEOUTS.PEER_INIT);
                
                if (peer) {
                    peer.once('open', () => {
                        if (!resolved) {
                            resolved = true;
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                } else {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeout);
                        resolve();
                    }
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
            localVideoLabel.id = 'localVideoLabel';
            updateLocalVideoLabel();
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
        // getUserMedia now returns null instead of throwing, so we handle it gracefully
        localStream = await getUserMedia(withVideo, true);
        
        if (localStream) {
            // Successfully got media stream
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                // Hide placeholder
                const placeholder = document.getElementById('local-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            }
            console.log('✅ Local media stream set up successfully');
        } else {
            // No media available - create empty stream so user can still join
            // User can still receive audio/video from others
            try {
                localStream = new MediaStream();
                console.log('✅ Created empty media stream (no camera/mic) - user can still receive streams');
                if (localVideo) {
                    // Keep placeholder visible since no local video
                    const placeholder = document.getElementById('local-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'flex';
                    }
                }
            } catch (streamError) {
                console.error('❌ Failed to create empty stream:', streamError);
                // Still create a null stream so the flow continues
                localStream = null;
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
        // Always create a valid MediaStream, even if empty
        let streamToSend;
        if (localStream) {
            streamToSend = localStream;
        } else {
            // Create empty stream so peer connection can be established
            streamToSend = new MediaStream();
            console.log('📡 Using empty stream for peer connection (no local media)');
        }
        
        const call = peer.call(peerId, streamToSend);
        
        if (!call) {
            console.warn('⚠️ Could not create call, user may not be ready');
            if (socketId && remotePeers.has(socketId)) {
                setTimeout(() => connectToUser(peerId, socketId), 2000);
            }
            return;
        }

        // Store call reference and ensure video element exists
        if (socketId) {
            if (!remotePeers.has(socketId)) {
                // Create entry if it doesn't exist
                const videoElements = createRemoteVideoElement(socketId, 'User');
                remotePeers.set(socketId, {
                    peerId: peerId,
                    userName: 'User',
                    isAdmin: false,
                    isSharingScreen: false,
                    call: call,
                    stream: null,
                    videoElement: videoElements.videoElement,
                    videoWrapper: videoElements.videoWrapper,
                    videoLabel: videoElements.videoLabel,
                    placeholder: videoElements.placeholder,
                    loadingSpinner: videoElements.loadingSpinner,
                    connectionAttempts: 1,
                    streamTimeout: null
                });
                
                // Show loading spinner
                if (videoElements.loadingSpinner) {
                    videoElements.loadingSpinner.style.display = 'block';
                }
                updateVideoGrid();
            } else {
                const peerData = remotePeers.get(socketId);
                peerData.call = call;
                peerData.connectionAttempts = (peerData.connectionAttempts || 0) + 1;
                // Ensure video element exists
                if (!peerData.videoElement) {
                    console.warn('⚠️ Video element missing in connectToUser for socket:', socketId);
                    const videoElements = createRemoteVideoElement(socketId, peerData.userName || 'User');
                    peerData.videoElement = videoElements.videoElement;
                    peerData.videoWrapper = videoElements.videoWrapper;
                    peerData.videoLabel = videoElements.videoLabel;
                    peerData.placeholder = videoElements.placeholder;
                    peerData.loadingSpinner = videoElements.loadingSpinner;
                    updateVideoGrid();
                }
                
                // Show loading spinner
                if (peerData.loadingSpinner) {
                    peerData.loadingSpinner.style.display = 'block';
                }
            }
        }

        // Set timeout for stream to arrive
        const peerData = socketId ? remotePeers.get(socketId) : null;
        if (peerData) {
            // Clear any existing timeout
            if (peerData.streamTimeout) {
                clearTimeout(peerData.streamTimeout);
            }
            
            // Set new timeout
            peerData.streamTimeout = setTimeout(() => {
                if (peerData && !peerData.stream) {
                    console.warn('⚠️ Stream timeout for socket:', socketId, '- retrying...');
                    showStatus(`Slow connection detected. Retrying... (${peerData.connectionAttempts || 1}/${CONNECTION_TIMEOUTS.MAX_RETRIES})`, 'info');
                    
                    // Retry connection if under max retries
                    if ((peerData.connectionAttempts || 1) < CONNECTION_TIMEOUTS.MAX_RETRIES) {
                        setTimeout(() => {
                            if (peerData && peerData.peerId && currentRoomId) {
                                connectToUser(peerData.peerId, socketId);
                            }
                        }, CONNECTION_TIMEOUTS.RETRY_DELAY * (peerData.connectionAttempts || 1)); // Exponential backoff
                    } else {
                        showStatus('Connection timeout. Please check your internet connection.', 'error');
                        // Show slow connection indicator
                        if (peerData.placeholder) {
                            const placeholder = peerData.placeholder;
                            placeholder.innerHTML = `
                                <div class="video-placeholder-avatar" style="opacity: 0.5;">
                                    ${(peerData.userName || 'User').charAt(0).toUpperCase()}
                                </div>
                                <div style="position: absolute; bottom: 1rem; color: hsl(var(--muted-foreground)); font-size: 0.75rem; text-align: center;">
                                    Slow connection...
                                </div>
                            `;
                        }
                    }
                }
            }, CONNECTION_TIMEOUTS.STREAM_LOAD);
        }

        // Handle remote stream
        call.on('stream', (stream) => {
            console.log('✅ Received remote stream from PeerJS ID:', peerId);
            
            // Clear timeout since stream arrived
            if (peerData && peerData.streamTimeout) {
                clearTimeout(peerData.streamTimeout);
                peerData.streamTimeout = null;
            }
            
            if (socketId && remotePeers.has(socketId)) {
                const peerData = remotePeers.get(socketId);
                peerData.stream = stream;
                peerData.connectionAttempts = 0; // Reset on success
                
                // Ensure video element exists
                if (!peerData.videoElement) {
                    const videoElements = createRemoteVideoElement(socketId, peerData.userName || 'User');
                    peerData.videoElement = videoElements.videoElement;
                    peerData.videoWrapper = videoElements.videoWrapper;
                    peerData.videoLabel = videoElements.videoLabel;
                    peerData.placeholder = videoElements.placeholder;
                    peerData.loadingSpinner = videoElements.loadingSpinner;
                    updateVideoGrid();
                }
                
                peerData.videoElement.srcObject = stream;
                peerData.videoElement.style.display = 'block';
                
                // Hide placeholder and loading spinner
                if (peerData.placeholder) {
                    peerData.placeholder.style.display = 'none';
                }
                if (peerData.loadingSpinner) {
                    peerData.loadingSpinner.style.display = 'none';
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
            updateLocalVideoLabel();
            
            // Restore local video display
            if (localVideo && localStream) {
                localVideo.srcObject = localStream;
            }
            
            // Broadcast screen sharing stopped
            if (socket && currentRoomId) {
                socket.emit('screen-sharing-stopped', { roomId: currentRoomId });
            }
            
            if (screenShareBtn) {
                const label = screenShareBtn.querySelector('.control-label');
                if (label) label.textContent = 'Share Screen';
                screenShareBtn.classList.remove('active');
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

                    // Show screen share in local video (on their own tile)
                    if (localVideo) {
                        localVideo.srcObject = screenStream;
                    }

                    // Handle screen share ending
                    screenStream.getVideoTracks()[0].onended = () => {
                        toggleScreenShare();
                    };

                    isSharingScreen = true;
                    updateLocalVideoLabel();
                    
                    // Broadcast screen sharing started
                    if (socket && currentRoomId) {
                        socket.emit('screen-sharing-started', { roomId: currentRoomId });
                    }
                    
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
    
    // Initialize draggable meeting ID display
    initializeDraggableMeetingId();
    
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

