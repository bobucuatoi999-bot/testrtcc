// ============================================
// Jitsi Meet Application Logic
// Integrates Jitsi Meet with room management, password, admin, and chat
// ============================================

// Global variables
let jitsiAPI = null;
let currentRoomId = null;
let userName = null;
let roomPassword = null;
let isRoomAdmin = false;
let roomHasPassword = false;
let socket = null;
let participantCount = 0;

// Server URL (from config.js or default)
const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// ============================================
// Socket.io Connection for Room Management
// ============================================

/**
 * Initialize Socket.io connection for room management, password, admin, and chat
 */
function initializeSocket() {
    try {
        socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        socket.on('connect', () => {
            console.log('✅ Connected to signaling server');
            showStatus('Connected', 'info');
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from signaling server');
            showStatus('Connection lost. Reconnecting...', 'error');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
            showStatus('Connection error. Please check your internet.', 'error');
        });

        // Handle room joined event
        socket.on('room-joined', (data) => {
            console.log('✅ Room joined:', data);
            isRoomAdmin = data.isAdmin || false;
            roomHasPassword = data.hasPassword || false;
            participantCount = data.userCount || 1;
            
            updateMeetingIdDisplay();
            updateParticipantsCount();
            updateAdminControls();
            
            // Initialize Jitsi after room is joined
            if (currentRoomId && userName) {
                // Small delay to ensure UI is ready
                setTimeout(() => {
                    initializeJitsi().catch(error => {
                        console.error('❌ Error initializing Jitsi:', error);
                        showLoading(false);
                        showStatus('Failed to start meeting. Please refresh and try again.', 'error');
                    });
                }, 500);
            }
        });

        // Handle room users list
        socket.on('room-users', (data) => {
            if (data && data.users) {
                participantCount = data.users.length;
                updateParticipantsCount();
            }
        });

        // Handle password required
        socket.on('error', (data) => {
            if (data.code === 'WRONG_PASSWORD') {
                showPasswordModal();
            } else {
                showStatus(data.message || 'An error occurred', 'error');
                // If it's a password error, show modal
                if (data.message && data.message.includes('password')) {
                    showPasswordModal();
                }
            }
        });

        // Handle participant joined
        socket.on('user-joined', (data) => {
            console.log('👤 User joined:', data);
            participantCount = data.userCount || participantCount;
            updateParticipantsCount();
        });

        // Handle participant left
        socket.on('user-left', (data) => {
            console.log('👤 User left:', data);
            participantCount = data.userCount || participantCount;
            updateParticipantsCount();
        });

        // Handle room updated
        socket.on('room-updated', (data) => {
            participantCount = data.userCount || participantCount;
            updateParticipantsCount();
        });

        // Handle chat messages
        socket.on('chat-message', (data) => {
            // Check if this is our own message (to avoid duplicates from optimistic update)
            const isOwn = (data.userName === userName) || (data.socketId === socket.id);
            
            // Only add if not our own message (we already added it optimistically)
            if (!isOwn) {
                addChatMessage(data.userName, data.message, data.timestamp, false);
            }
        });

        // Handle chat history
        socket.on('chat-history', (data) => {
            if (data.messages && Array.isArray(data.messages)) {
                data.messages.forEach(msg => {
                    addChatMessage(msg.userName, msg.message, msg.timestamp, false, true);
                });
            }
        });

        // Handle password set/reset
        socket.on('password-set-success', () => {
            roomHasPassword = true;
            updateMeetingIdDisplay();
            updateAdminControls();
            showStatus('Password set successfully', 'success');
        });

        socket.on('password-reset-success', () => {
            roomHasPassword = false;
            updateMeetingIdDisplay();
            updateAdminControls();
            showStatus('Password removed successfully', 'success');
        });

        socket.on('room-password-updated', (data) => {
            roomHasPassword = data.hasPassword || false;
            updateMeetingIdDisplay();
        });

    } catch (error) {
        console.error('❌ Error initializing socket:', error);
        showStatus('Failed to connect to server', 'error');
    }
}

// ============================================
// Jitsi Meet Initialization
// ============================================

/**
 * Check and request device permissions before initializing Jitsi
 * @returns {Promise<boolean>} True if permissions granted or devices available
 */
async function checkDevicePermissions() {
    try {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ MediaDevices API not available');
            // Still allow joining - Jitsi will handle device errors
            return true;
        }

        // Try to enumerate devices first (doesn't require permission)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideoDevice = devices.some(device => device.kind === 'videoinput');
        const hasAudioDevice = devices.some(device => device.kind === 'audioinput');

        if (!hasVideoDevice && !hasAudioDevice) {
            console.warn('⚠️ No camera or microphone devices found');
            // Still allow joining - user can join without devices
            return true;
        }

        // Try to get permissions (this will prompt user)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: hasAudioDevice,
                video: hasVideoDevice
            });
            
            // Stop tracks immediately - we just needed permission
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ Device permissions granted');
            return true;
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                console.warn('⚠️ Device permissions denied - user can still join');
                // Allow joining without devices
                return true;
            } else if (error.name === 'NotFoundError') {
                console.warn('⚠️ No devices found - user can still join');
                // Allow joining without devices
                return true;
            } else {
                console.warn('⚠️ Device access error:', error.name);
                // Still allow joining
                return true;
            }
        }
    } catch (error) {
        console.error('❌ Error checking device permissions:', error);
        // Allow joining anyway - Jitsi will handle it
        return true;
    }
}

/**
 * Initialize Jitsi Meet meeting
 */
async function initializeJitsi() {
    if (!currentRoomId || !userName) {
        console.error('❌ Cannot initialize Jitsi: missing room ID or user name');
        return;
    }

    // Check if Jitsi API is loaded
    if (typeof JitsiMeetExternalAPI === 'undefined') {
        console.error('❌ Jitsi Meet External API not loaded');
        showStatus('Failed to load video meeting. Please refresh the page.', 'error');
        showLoading(false);
        return;
    }

    // Dispose existing API if any
    if (jitsiAPI) {
        jitsiAPI.dispose();
        jitsiAPI = null;
    }

    // Show loading with device check message
    showLoading(true);
    const loadingMessage = document.querySelector('#loading p');
    if (loadingMessage) {
        loadingMessage.textContent = 'Checking devices...';
    }

    // Check device permissions (non-blocking)
    await checkDevicePermissions();

    // Update loading message
    if (loadingMessage) {
        loadingMessage.textContent = 'Connecting to meeting...';
    }

    try {
        // Create Jitsi room name (sanitize for Jitsi)
        // Jitsi room names should be lowercase and URL-safe
        const jitsiRoomName = currentRoomId.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        // Initialize Jitsi Meet External API
        // Note: Jitsi has its own password system separate from our room password
        // For now, we'll use our room password as the Jitsi room password
        const jitsiOptions = {
            roomName: jitsiRoomName,
            parentNode: document.getElementById('jitsi-container'),
            config: {
                ...jitsiConfig,
                // Add Jitsi room password if we have one
                ...(roomPassword ? { roomPassword: roomPassword } : {})
            },
            interfaceConfig: interfaceConfig,
            userInfo: {
                displayName: userName
            }
        };

        jitsiAPI = new JitsiMeetExternalAPI('meet.jit.si', jitsiOptions);

        // Event listeners
        setupJitsiEventListeners();

        // Show Jitsi container after initialization
        const jitsiContainer = document.getElementById('jitsi-container');
        if (jitsiContainer) {
            jitsiContainer.classList.add('initialized');
        }

        console.log('✅ Jitsi Meet initialized for room:', jitsiRoomName);

        // Set a timeout to update loading message if meeting takes too long
        setTimeout(() => {
            const loading = document.getElementById('loading');
            if (loading && loading.style.display !== 'none') {
                console.warn('⚠️ Meeting taking longer than expected to load');
                updateLoadingMessage('Meeting is loading... If this persists, please refresh.');
            }
        }, 30000);

    } catch (error) {
        console.error('❌ Error initializing Jitsi:', error);
        showStatus('Failed to start video meeting. Please try again.', 'error');
        showLoading(false);
    }
}

/**
 * Setup Jitsi Meet event listeners
 */
function setupJitsiEventListeners() {
    if (!jitsiAPI) return;

    // User successfully joined the conference
    jitsiAPI.addEventListener('videoConferenceJoined', (event) => {
        console.log('✅ Joined Jitsi conference:', event);
        showLoading(false);
        showStatus('Connected to meeting', 'success');
        
        // Get participant count from Jitsi
        try {
            const participants = jitsiAPI.getParticipantsInfo();
            participantCount = participants.length + 1; // +1 for local user
            updateParticipantsCount();
        } catch (error) {
            console.warn('⚠️ Could not get participants info:', error);
        }
        
        // Request room users from server to sync
        if (socket && socket.connected && currentRoomId) {
            socket.emit('get-room-users', { roomId: currentRoomId });
        }
    });

    // Participant joined
    jitsiAPI.addEventListener('participantJoined', (participant) => {
        console.log('👤 Participant joined:', participant);
        // Update count from Jitsi
        const participants = jitsiAPI.getParticipantsInfo();
        participantCount = participants.length + 1; // +1 for local user
        updateParticipantsCount();
        
        // Sync with server
        if (socket && socket.connected && currentRoomId) {
            socket.emit('get-room-users', { roomId: currentRoomId });
        }
    });

    // Participant left
    jitsiAPI.addEventListener('participantLeft', (participant) => {
        console.log('👤 Participant left:', participant);
        // Update count from Jitsi
        const participants = jitsiAPI.getParticipantsInfo();
        participantCount = participants.length + 1; // +1 for local user
        updateParticipantsCount();
        
        // Sync with server
        if (socket && socket.connected && currentRoomId) {
            socket.emit('get-room-users', { roomId: currentRoomId });
        }
    });

    // User left the conference
    jitsiAPI.addEventListener('videoConferenceLeft', () => {
        console.log('📴 Left Jitsi conference');
        // Clean up and redirect
        cleanup();
        window.location.href = 'index.html';
    });

    // Conference is ready to be closed
    jitsiAPI.addEventListener('readyToClose', () => {
        console.log('✅ Ready to close');
        cleanup();
    });

    // Screen sharing status changed
    jitsiAPI.addEventListener('screenSharingStatusChanged', (event) => {
        console.log('📺 Screen sharing status:', event);
        // Jitsi handles screen sharing UI automatically
    });

    // Tile view changed
    jitsiAPI.addEventListener('tileViewChanged', (event) => {
        console.log('📐 Tile view changed:', event);
    });

    // Error occurred
    jitsiAPI.addEventListener('errorOccurred', (error) => {
        console.error('❌ Jitsi error:', error);
        
        // Don't block meeting if it's just device errors - user can still join
        if (error.error === 'camera-permission-denied' || error.error === 'gum.not_found') {
            console.warn('⚠️ Device access issue - user can still join without camera/mic');
            showStatus('You can still join the meeting. Camera/microphone may not be available.', 'info');
            // Don't hide loading - let meeting continue
        } else if (error.error === 'mic-permission-denied') {
            console.warn('⚠️ Microphone permission denied - user can still join');
            showStatus('You can still join the meeting. Microphone may not be available.', 'info');
        } else {
            showStatus('An error occurred in the meeting. ' + (error.error || ''), 'error');
        }
    });

    // Connection failed
    jitsiAPI.addEventListener('connectionFailed', () => {
        console.error('❌ Jitsi connection failed');
        showStatus('Connection lost. Trying to reconnect...', 'error');
    });

    // Connection established
    jitsiAPI.addEventListener('connectionEstablished', () => {
        console.log('✅ Jitsi connection established');
        showStatus('Connected', 'success');
    });

    // Audio/video mute status
    jitsiAPI.addEventListener('audioMuteStatusChanged', (event) => {
        console.log('🔇 Audio mute status:', event);
    });

    jitsiAPI.addEventListener('videoMuteStatusChanged', (event) => {
        console.log('📹 Video mute status:', event);
    });
}

// ============================================
// Room Management
// ============================================

/**
 * Join a room with password check
 */
function joinRoom(roomId, name, password = null) {
    currentRoomId = roomId;
    userName = name;
    roomPassword = password;

    // Initialize socket connection
    initializeSocket();

    // Wait for socket to connect, then join room
    if (socket) {
        socket.once('connect', () => {
            socket.emit('join-room', {
                roomId: roomId,
                userName: name,
                password: password || ''
            });
        });
    } else {
        // If socket not initialized, try to join directly
        // This will trigger password modal if needed
        console.warn('⚠️ Socket not initialized, attempting direct join');
    }
}

/**
 * Leave the meeting
 */
function leaveMeeting() {
    if (jitsiAPI) {
        jitsiAPI.executeCommand('hangup');
    } else {
        cleanup();
        window.location.href = 'index.html';
    }
}

/**
 * Cleanup resources
 */
function cleanup() {
    // Dispose Jitsi API
    if (jitsiAPI) {
        try {
            jitsiAPI.dispose();
        } catch (error) {
            console.error('Error disposing Jitsi API:', error);
        }
        jitsiAPI = null;
    }

    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Clear variables
    currentRoomId = null;
    userName = null;
    roomPassword = null;
    isRoomAdmin = false;
    roomHasPassword = false;
    participantCount = 0;
}

// ============================================
// UI Updates
// ============================================

/**
 * Update meeting ID display
 */
function updateMeetingIdDisplay() {
    const meetingIdValue = document.getElementById('meetingIdValue');
    const roomPasswordDisplay = document.getElementById('roomPasswordDisplay');
    
    if (meetingIdValue && currentRoomId) {
        meetingIdValue.textContent = currentRoomId;
    }
    
    if (roomPasswordDisplay) {
        roomPasswordDisplay.style.display = roomHasPassword ? 'flex' : 'none';
    }
}

/**
 * Update participants count
 */
function updateParticipantsCount() {
    const participantsCount = document.getElementById('participantsCount');
    if (participantsCount) {
        participantsCount.textContent = `Participants (${participantCount})`;
    }
}

/**
 * Update admin controls visibility
 */
function updateAdminControls() {
    const configPasswordBtn = document.getElementById('configPasswordBtn');
    const adminControls = document.getElementById('adminControls');
    
    if (configPasswordBtn) {
        configPasswordBtn.style.display = isRoomAdmin ? 'flex' : 'none';
    }
    
    if (adminControls) {
        adminControls.style.display = isRoomAdmin ? 'flex' : 'none';
    }
}

// ============================================
// Chat Functions
// ============================================

/**
 * Send chat message
 */
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !socket || !currentRoomId) return;

    const message = chatInput.value.trim();
    if (!message) return;

    // Send message to server
    socket.emit('chat-message', {
        roomId: currentRoomId,
        message: message
    });

    // Add message to UI immediately (optimistic update)
    addChatMessage(userName || 'You', message, Date.now(), true);

    chatInput.value = '';
}

/**
 * Add chat message to UI
 */
function addChatMessage(userName, message, timestamp, isOwn = false, isHistory = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwn ? 'own' : ''}`;
    
    // Use message ID to prevent duplicates
    if (timestamp) {
        messageDiv.dataset.messageId = `${userName}-${timestamp}`;
    }
    
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-name">${escapeHtml(userName)}</span>
            <span class="chat-message-time">${time}</span>
        </div>
        <div class="chat-message-text">${escapeHtml(message)}</div>
    `;

    // Check for duplicates before adding
    const messageId = messageDiv.dataset.messageId;
    if (messageId) {
        const existing = chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (existing) {
            return; // Duplicate, don't add
        }
    }

    if (isHistory) {
        chatMessages.insertBefore(messageDiv, chatMessages.firstChild);
    } else {
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Update message count
    const messageCount = chatMessages.querySelectorAll('.chat-message').length;
    const chatMessageCount = document.getElementById('chatMessageCount');
    if (chatMessageCount) {
        chatMessageCount.textContent = `${messageCount} message${messageCount !== 1 ? 's' : ''}`;
    }
}

/**
 * Toggle chat panel
 */
function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    if (chatPanel) {
        const isVisible = chatPanel.style.display !== 'none';
        chatPanel.style.display = isVisible ? 'none' : 'flex';
    }
}

/**
 * Toggle participants panel
 */
function toggleParticipants() {
    const participantsPanel = document.getElementById('participantsPanel');
    if (participantsPanel) {
        const isVisible = participantsPanel.style.display !== 'none';
        participantsPanel.style.display = isVisible ? 'none' : 'flex';
    }
}

// ============================================
// Password Management (Admin)
// ============================================

/**
 * Toggle password config modal
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
 * Open set password modal
 */
function openSetPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const title = document.getElementById('adminPasswordModalTitle');
    const description = document.getElementById('adminPasswordModalDescription');
    const submitBtn = document.getElementById('adminPasswordSubmitBtn');
    
    if (modal) {
        if (title) title.textContent = 'Set Room Password';
        if (description) description.textContent = 'Set a password to protect this room. Users will need to enter this password to join.';
        if (submitBtn) submitBtn.textContent = 'Set Password';
        modal.style.display = 'flex';
    }
}

/**
 * Open reset password modal
 */
function openResetPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const title = document.getElementById('adminPasswordModalTitle');
    const description = document.getElementById('adminPasswordModalDescription');
    const submitBtn = document.getElementById('adminPasswordSubmitBtn');
    
    if (modal) {
        if (title) title.textContent = 'Remove Room Password';
        if (description) description.textContent = 'Remove the password protection from this room. Anyone with the room ID will be able to join.';
        if (submitBtn) submitBtn.textContent = 'Remove Password';
        modal.style.display = 'flex';
    }
}

/**
 * Close admin password modal
 */
function closeAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    const input = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminPasswordError');
    
    if (modal) modal.style.display = 'none';
    if (input) input.value = '';
    if (error) {
        error.style.display = 'none';
        error.textContent = '';
    }
}

/**
 * Submit admin password (set or reset)
 */
function submitAdminPassword() {
    if (!socket || !currentRoomId || !isRoomAdmin) return;

    const input = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminPasswordError');
    
    if (!input) return;

    const password = input.value.trim();

    if (roomHasPassword) {
        // Reset password (remove)
        socket.emit('reset-room-password', { roomId: currentRoomId });
    } else {
        // Set password
        if (!password) {
            if (error) {
                error.textContent = 'Password cannot be empty';
                error.style.display = 'block';
            }
            return;
        }
        socket.emit('set-room-password', { 
            roomId: currentRoomId,
            password: password
        });
    }

    closeAdminPasswordModal();
}

// ============================================
// Password Modal (for joining)
// ============================================

let pendingJoinData = null;

/**
 * Show password modal
 */
function showPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Close password modal
 */
function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    
    if (modal) modal.style.display = 'none';
    if (input) input.value = '';
    if (error) {
        error.style.display = 'none';
        error.textContent = '';
    }
}

/**
 * Submit password for joining
 */
function submitPassword() {
    const input = document.getElementById('passwordInput');
    const error = document.getElementById('passwordError');
    
    if (!input) return;

    const password = input.value.trim();
    
    if (!password) {
        if (error) {
            error.textContent = 'Please enter the password';
            error.style.display = 'block';
        }
        return;
    }

    // Retry joining with password
    if (pendingJoinData) {
        closePasswordModal();
        joinRoom(pendingJoinData.roomId, pendingJoinData.userName, password);
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Update loading message
 */
function updateLoadingMessage(message) {
    const loadingMessage = document.querySelector('#loading p');
    if (loadingMessage) {
        loadingMessage.textContent = message;
    }
}

/**
 * Copy meeting ID
 */
function copyMeetingId() {
    if (!currentRoomId) return;
    
    const url = createRoomURL(currentRoomId, userName, roomPassword);
    copyRoomLink(currentRoomId, userName, roomPassword).then(success => {
        if (success) {
            showStatus('Room link copied to clipboard!', 'success');
        } else {
            showStatus('Failed to copy link. Please copy manually.', 'error');
        }
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Toggle password visibility
 */
function togglePasswordVisibility() {
    const input = document.getElementById('passwordInput');
    const showIcon = document.getElementById('passwordShowIcon');
    const hideIcon = document.getElementById('passwordHideIcon');
    
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            if (showIcon) showIcon.style.display = 'block';
            if (hideIcon) hideIcon.style.display = 'none';
        } else {
            input.type = 'password';
            if (showIcon) showIcon.style.display = 'none';
            if (hideIcon) hideIcon.style.display = 'block';
        }
    }
}

/**
 * Toggle admin password visibility
 */
function toggleAdminPasswordVisibility() {
    const input = document.getElementById('adminPasswordInput');
    const showIcon = document.getElementById('adminPasswordShowIcon');
    const hideIcon = document.getElementById('adminPasswordHideIcon');
    
    if (input) {
        if (input.type === 'password') {
            input.type = 'text';
            if (showIcon) showIcon.style.display = 'block';
            if (hideIcon) hideIcon.style.display = 'none';
        } else {
            input.type = 'password';
            if (showIcon) showIcon.style.display = 'none';
            if (hideIcon) hideIcon.style.display = 'block';
        }
    }
}

// ============================================
// Initialize on page load
// ============================================

window.addEventListener('DOMContentLoaded', () => {
    // Get room ID, name, and password from URL
    const roomId = getRoomIdFromURL();
    const name = getUserNameFromURL();
    const password = getPasswordFromURL();

    if (!roomId || !name) {
        // Missing required parameters, redirect to home
        window.location.href = 'index.html';
        return;
    }

    // Store pending join data in case password is needed
    pendingJoinData = { roomId, userName: name, password };

    // Join the room
    joinRoom(roomId, name, password);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanup();
});

// Make functions globally available
window.leaveMeeting = leaveMeeting;
window.toggleChat = toggleChat;
window.toggleParticipants = toggleParticipants;
window.copyMeetingId = copyMeetingId;
window.togglePasswordConfig = togglePasswordConfig;
window.openSetPasswordModal = openSetPasswordModal;
window.openResetPasswordModal = openResetPasswordModal;
window.closeAdminPasswordModal = closeAdminPasswordModal;
window.submitAdminPassword = submitAdminPassword;
window.closePasswordModal = closePasswordModal;
window.submitPassword = submitPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleAdminPasswordVisibility = toggleAdminPasswordVisibility;
window.sendChatMessage = sendChatMessage;

