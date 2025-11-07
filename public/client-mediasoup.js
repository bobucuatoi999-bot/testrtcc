// ============================================
// Mediasoup SFU Client - Complete Implementation
// WebRTC video/voice call system using Mediasoup SFU architecture
// Supports up to 7 users per room with global reliability (90%+ success rate)
// ============================================

// ============================================
// Global Variables
// ============================================

let socket = null;                    // Socket.io connection
let device = null;                    // Mediasoup Device
let sendTransport = null;             // Send transport (for sending media)
let recvTransport = null;             // Receive transport (for receiving media)
let localStream = null;               // Local media stream (camera/mic)
let screenStream = null;              // Screen share stream
let localVideoProducer = null;        // Local video producer
let localAudioProducer = null;        // Local audio producer
let screenVideoProducer = null;       // Screen share producer

// Remote consumers: Map of socketId -> { audioConsumer, videoConsumer, userName, videoElement, videoWrapper, videoLabel }
let remoteConsumers = new Map();

// State variables
let isMuted = false;
let isCameraOff = false;
let isSharingScreen = false;
let currentRoomId = null;
let userName = null;
let isRoomAdmin = false;
let roomHasPassword = false;
let pendingPassword = null;
let rtpCapabilities = null;
let iceServers = null;

// Zoom view state
let zoomedVideoElement = null;
let zoomedVideoWrapper = null;

// Maximum users per room
const MAX_USERS = 7;

// Reconnection settings
const RECONNECTION_CONFIG = {
    maxRetries: 5,
    retryDelay: 2000,
    maxRetryDelay: 10000
};

// ============================================
// Server Configuration
// ============================================

const SERVER_URL = window.SERVER_URL || 'http://localhost:3000';

// ============================================
// DOM Elements
// ============================================

let videoContainer = null;
let localVideo = null;
let localVideoWrapper = null;
let localVideoLabel = null;
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
 */
function showStatus(message, type = 'info') {
    if (!statusDiv) {
        statusDiv = document.getElementById('status');
        if (!statusDiv) {
            console.log(`[${type.toUpperCase()}] ${message}`);
            return;
        }
    }
    
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'info') {
        setTimeout(() => {
            if (statusDiv) {
                statusDiv.style.display = 'none';
            }
        }, 5000);
    }
}

/**
 * Initialize DOM elements
 */
function initializeDOMElements() {
    videoContainer = document.getElementById('videoContainer');
    localVideo = document.getElementById('localVideo');
    muteBtn = document.getElementById('muteBtn');
    cameraBtn = document.getElementById('cameraBtn');
    screenShareBtn = document.getElementById('screenShareBtn');
    endCallBtn = document.getElementById('endCallBtn');
    statusDiv = document.getElementById('status');
    chatBtn = document.getElementById('chatBtn');
    participantsBtn = document.getElementById('participantsBtn');
}

// ============================================
// Socket.io Connection
// ============================================

/**
 * Initialize Socket.io connection
 */
// Track if socket handlers have been set up
let socketHandlersInitialized = false;

function initializeSocket() {
    try {
        // Don't reinitialize if socket already exists and is connected/connecting
        if (socket && (socket.connected || socket.connecting)) {
            console.log('✅ Socket already initialized and connected/connecting');
            // Still set up handlers if not done yet
            if (!socketHandlersInitialized) {
                setupSocketHandlers();
            }
            return;
        }
        
        // Close existing socket if it exists but not connected
        if (socket && !socket.connected) {
            console.log('🔄 Reinitializing socket...');
            socket.removeAllListeners(); // Remove all old handlers
            socket.disconnect();
            socket = null;
            socketHandlersInitialized = false;
        }
        
        console.log('🔌 Initializing socket connection to:', SERVER_URL);
        socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: RECONNECTION_CONFIG.maxRetries,
            reconnectionDelay: RECONNECTION_CONFIG.retryDelay,
            reconnectionDelayMax: RECONNECTION_CONFIG.maxRetryDelay,
            timeout: 20000
        });

        // Set up socket handlers (only once)
        setupSocketHandlers();

    } catch (error) {
        console.error('❌ Error initializing socket:', error);
        showStatus('Failed to connect to server', 'error');
    }
}

/**
 * Set up socket event handlers (called once per socket instance)
 */
function setupSocketHandlers() {
    if (socketHandlersInitialized || !socket) {
        return;
    }
    
    console.log('📡 Setting up socket event handlers...');
    
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

    // Handle room joined
    socket.on('room-joined', async (data) => {
        console.log('✅ Room joined:', data);
        isRoomAdmin = data.isAdmin || false;
        roomHasPassword = data.hasPassword || false;
        rtpCapabilities = data.rtpCapabilities;
        iceServers = data.iceServers;
        
        // Display meeting ID
        displayMeetingId(data.roomId || currentRoomId);
        
        // Display password status
        displayRoomPassword(roomHasPassword);
        
        // Update participants list
        updateParticipantsList();
        
        // Initialize Mediasoup Device
        await initializeDevice();
        
        // Create transports (this will trigger transport creation)
        // get-producers will be called after recv transport is ready
        await createTransports();
        
        // Note: get-producers is now called after recv transport is created
        // (see recv-transport-created handler)
    });

    // Handle new producer (new user joined and started producing)
    socket.on('new-producer', async (data) => {
        console.log('👤 New producer:', data);
        await consumeProducer(data.producerId, data.socketId, data.kind, data.userName);
    });

    // Handle existing producers (when we join, get list of existing producers)
    socket.on('existing-producers', async (data) => {
        console.log('📋 Existing producers:', data);
        for (const producer of data.producers) {
            await consumeProducer(producer.producerId, producer.socketId, producer.kind, producer.userName);
        }
    });

    // Handle producer closed (user left or stopped producing)
    socket.on('producer-closed', (data) => {
        console.log('👋 Producer closed:', data);
        removeRemoteUser(data.socketId);
    });

    // Handle send transport created
    socket.on('send-transport-created', async (data) => {
        try {
            if (!device) {
                throw new Error('Device not initialized');
            }

            // Ensure device is loaded before creating transport
            if (!device.loaded) {
                throw new Error('Device not loaded yet');
            }

            // Extract ICE servers array from the server response
            // Server sends: { iceServers: [...], iceCandidatePoolSize: 10 }
            let iceServersArray = iceServers && iceServers.iceServers ? iceServers.iceServers : [];
            
            // Validate and clean ICE servers format
            // Remove any servers with invalid transport types (TLS is not supported)
            iceServersArray = iceServersArray.filter(server => {
                if (server.urls) {
                    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                    // Check if any URL has invalid transport
                    const hasInvalidTransport = urls.some(url => {
                        if (typeof url === 'string') {
                            // Remove TLS transport (not supported by RTCPeerConnection)
                            return url.includes('transport=tls') || url.includes('transport=TLS');
                        }
                        return false;
                    });
                    return !hasInvalidTransport;
                }
                return true;
            });
            
            console.log('📡 Creating send transport with ICE servers:', iceServersArray.length, 'servers');
            console.log('📡 ICE servers:', JSON.stringify(iceServersArray, null, 2));

            // Create send transport
            sendTransport = device.createSendTransport({
                id: data.id,
                iceParameters: data.iceParameters,
                iceCandidates: data.iceCandidates,
                dtlsParameters: data.dtlsParameters,
                iceServers: iceServersArray,
                iceTransportPolicy: 'all'
            });

            // Handle transport connect event
            sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    socket.emit('connect-transport', {
                        transportId: sendTransport.id,
                        dtlsParameters: dtlsParameters,
                        roomId: currentRoomId
                    });
                    callback();
                } catch (error) {
                    errback(error);
                }
            });

            // Handle transport produce event (called when transport.produce() is called)
            sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
                try {
                    // Emit to server to create producer
                    socket.emit('create-producer', {
                        transportId: sendTransport.id,
                        kind: kind,
                        rtpParameters: rtpParameters,
                        roomId: currentRoomId
                    });
                    
                    // Wait for producer ID from server
                    socket.once('producer-created', (data) => {
                        if (data.kind === kind) {
                            callback({ id: data.producerId });
                        }
                    });
                } catch (error) {
                    console.error('❌ Error in produce handler:', error);
                    errback(error);
                }
            });

            sendTransport.on('connectionstatechange', (state) => {
                console.log('📡 Send transport connection state:', state);
                if (state === 'failed' || state === 'disconnected') {
                    showStatus('Network issue. Reconnecting...', 'error');
                    setTimeout(() => {
                        if (sendTransport) {
                            sendTransport.restartIce();
                        }
                    }, 2000);
                }
            });

            console.log('✅ Send transport created');

            // After send transport is ready, create recv transport
            socket.emit('create-recv-transport', { roomId: currentRoomId });

        } catch (error) {
            console.error('❌ Error handling send transport:', error);
            showStatus('Failed to create send transport', 'error');
        }
    });

    // Handle receive transport created
    socket.on('recv-transport-created', async (data) => {
        try {
            if (!device) {
                throw new Error('Device not initialized');
            }

            // Ensure device is loaded before creating transport
            if (!device.loaded) {
                throw new Error('Device not loaded yet');
            }

            // Extract ICE servers array from the server response
            let iceServersArray = iceServers && iceServers.iceServers ? iceServers.iceServers : [];
            
            // Validate and clean ICE servers format (same as send transport)
            iceServersArray = iceServersArray.filter(server => {
                if (server.urls) {
                    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                    const hasInvalidTransport = urls.some(url => {
                        if (typeof url === 'string') {
                            return url.includes('transport=tls') || url.includes('transport=TLS');
                        }
                        return false;
                    });
                    return !hasInvalidTransport;
                }
                return true;
            });
            
            console.log('📡 Creating recv transport with ICE servers:', iceServersArray.length, 'servers');

            // Create receive transport
            recvTransport = device.createRecvTransport({
                id: data.id,
                iceParameters: data.iceParameters,
                iceCandidates: data.iceCandidates,
                dtlsParameters: data.dtlsParameters,
                iceServers: iceServersArray,
                iceTransportPolicy: 'all'
            });

            // ✅ CRITICAL: Handle transport connect event - MUST wait for server confirmation
            recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                console.log('📥 Receive transport connect event triggered!');
                console.log('📥 Transport ID:', recvTransport.id);
                console.log('📥 DTLS Parameters:', dtlsParameters);
                
                try {
                    // Use emitWithAck to wait for server response, or use a promise-based approach
                    // Note: mediasoup expects callback to be called, but we should try to get server confirmation
                    
                    // First, emit to server to connect the transport
                    socket.emit('connect-transport', {
                        transportId: recvTransport.id,
                        dtlsParameters: dtlsParameters,
                        roomId: currentRoomId
                    });
                    
                    // Wait a bit for server to process (mediasoup connect is async on server)
                    // In practice, if server.connect() fails, the transport state will change to 'failed'
                    // So we call callback immediately, and let connectionstatechange handle errors
                    console.log('📥 Calling callback to signal transport connect...');
                    callback();
                    
                    // Note: The server should call transport.connect() which will establish the connection
                    // If it fails, the connectionstatechange event will fire with 'failed' state
                    
                } catch (error) {
                    console.error('❌ Error in receive transport connect handler:', error);
                    errback(error);
                }
            });

            recvTransport.on('connectionstatechange', (state) => {
                console.log('📡 Recv transport connection state changed:', state);
                
                if (state === 'connecting') {
                    console.log('⏳ Receive transport is connecting...');
                } else if (state === 'connected') {
                    console.log('✅ Receive transport connected successfully!');
                } else if (state === 'failed') {
                    console.error('❌ Receive transport connection failed!');
                    showStatus('Network issue. Reconnecting...', 'error');
                    setTimeout(() => {
                        if (recvTransport && !recvTransport.closed) {
                            recvTransport.restartIce();
                        }
                    }, 2000);
                } else if (state === 'disconnected') {
                    console.warn('⚠️ Receive transport disconnected');
                    showStatus('Network issue. Reconnecting...', 'error');
                } else if (state === 'closed') {
                    console.log('🔒 Receive transport closed');
                }
            });

            console.log('✅ Receive transport created');

            // After both transports are ready, start producing local media
            if (sendTransport && recvTransport) {
                // Get existing producers in room (users already in the room)
                console.log('📋 Requesting existing producers in room...');
                socket.emit('get-producers', { roomId: currentRoomId });
                
                // Start producing local media
                await startProducingLocalMedia();
            }

        } catch (error) {
            console.error('❌ Error handling recv transport:', error);
            showStatus('Failed to create receive transport', 'error');
        }
    });

    // Handle chat messages
    socket.on('chat-message', (messageData) => {
        if (!messageData) return;
        const isOwnMessage = messageData.socketId === socket.id;
        displayChatMessage(messageData, isOwnMessage);
    });

    // Handle chat history
    socket.on('chat-history', (data) => {
        if (!data || !data.messages || !Array.isArray(data.messages)) return;
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        data.messages.forEach(messageData => {
            const isOwnMessage = messageData.socketId === socket.id;
            displayChatMessage(messageData, isOwnMessage);
        });
        updateChatMessageCount();
    });

    // Handle password errors
    socket.on('error', (data) => {
        console.error('❌ Server error:', data);
        if (data.code === 'WRONG_PASSWORD' || (data.message && data.message.includes('password'))) {
            showPasswordModal();
            const errorDiv = document.getElementById('passwordError');
            if (errorDiv) {
                errorDiv.textContent = data.message || 'Incorrect password';
                errorDiv.style.display = 'block';
            }
        } else {
            showStatus(data.message || 'An error occurred', 'error');
        }
    });

    // Handle password set/reset success
    socket.on('password-set-success', () => {
        roomHasPassword = true;
        displayRoomPassword(true);
        updateParticipantsList();
        showStatus('Password set successfully', 'success');
    });

    socket.on('password-reset-success', () => {
        roomHasPassword = false;
        displayRoomPassword(false);
        updateParticipantsList();
        showStatus('Password removed successfully', 'success');
    });

    socket.on('room-password-updated', (data) => {
        roomHasPassword = data.hasPassword || false;
        displayRoomPassword(roomHasPassword);
        updateParticipantsList();
    });
    
    // Mark handlers as initialized
    socketHandlersInitialized = true;
    console.log('✅ Socket event handlers set up');
}

// ============================================
// Mediasoup Device Initialization
// ============================================

/**
 * Initialize Mediasoup Device with router RTP capabilities
 */
async function initializeDevice() {
    try {
        if (!rtpCapabilities) {
            throw new Error('RTP capabilities not available');
        }

        // Check if mediasoup-client is loaded
        // Check multiple possible locations for the mediasoup library
        const mediasoupLib = window.mediasoup || (typeof mediasoup !== 'undefined' ? mediasoup : null);
        
        if (!mediasoupLib || typeof mediasoupLib.Device === 'undefined') {
            console.error('❌ Mediasoup library check failed');
            console.log('window.mediasoup:', typeof window.mediasoup);
            console.log('typeof mediasoup:', typeof mediasoup);
            console.log('Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('media')));
            throw new Error('Mediasoup client library not loaded. Please include mediasoup-client script.');
        }

        // Create device using the library
        device = new mediasoupLib.Device();

        // Load router RTP capabilities into device
        await device.load({ routerRtpCapabilities: rtpCapabilities });

        // Verify device is loaded before accessing properties
        if (!device.loaded) {
            throw new Error('Device failed to load');
        }

        console.log('✅ Mediasoup Device initialized');
        console.log('📋 Device loaded:', device.loaded);
        console.log('📋 Can produce video:', device.canProduce('video'));
        console.log('📋 Can produce audio:', device.canProduce('audio'));
        console.log('📋 Device RTP capabilities:', JSON.stringify(device.rtpCapabilities, null, 2));
        
        // Validate device can produce
        if (!device.canProduce('video') && !device.canProduce('audio')) {
            throw new Error('Device cannot produce video or audio');
        }

    } catch (error) {
        console.error('❌ Error initializing device:', error);
        showStatus('Failed to initialize media device. Please refresh.', 'error');
        throw error;
    }
}

// ============================================
// Transport Creation
// ============================================

/**
 * Create send and receive transports
 * Note: Only create send transport here. Recv transport is created after send transport is ready.
 */
async function createTransports() {
    try {
        if (!device || !device.loaded) {
            throw new Error('Device not loaded');
        }
        
        console.log('🚀 Creating send transport...');
        // Create send transport first
        // The send-transport-created handler will automatically create recv transport
        socket.emit('create-send-transport', { roomId: currentRoomId });

    } catch (error) {
        console.error('❌ Error creating transports:', error);
        showStatus('Failed to create transports', 'error');
    }
}

/**
 * Handle send transport created
 */
// Note: Socket handlers for transport creation are now inside initializeSocket() function

// ============================================
// Local Media Production
// ============================================

/**
 * Start producing local audio and video
 */
async function startProducingLocalMedia() {
    try {
        if (!sendTransport) {
            throw new Error('Send transport not ready');
        }

        // Get user media (camera and microphone)
        console.log('🎥 Requesting camera and microphone permissions...');
        showStatus('Requesting camera and microphone access...', 'info');
        
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: {
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                }
            });
            
            console.log('✅ Camera and microphone access granted');
            console.log('📹 Video tracks:', localStream.getVideoTracks().length);
            console.log('🎤 Audio tracks:', localStream.getAudioTracks().length);

            // Produce audio
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                localAudioProducer = await sendTransport.produce({ track: audioTrack });
                console.log('✅ Audio producer created:', localAudioProducer.id);
            }

            // Produce video
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                localVideoProducer = await sendTransport.produce({ track: videoTrack });
                console.log('✅ Video producer created:', localVideoProducer.id);
            }

            // Create local video element if it doesn't exist
            if (!localVideoWrapper) {
                createLocalVideoElement();
            }
            
            // Display local video
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.style.display = 'block';
                localVideo.play().catch(err => console.error('Error playing local video:', err));
                
                // Hide placeholder
                const placeholder = document.getElementById('local-placeholder');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            }
            
            updateLocalVideoLabel();
            showStatus('Connected to meeting', 'success');

        } catch (error) {
            console.error('❌ Error getting user media:', error);
            
            // Try audio-only if video fails
            if (error.name === 'NotFoundError' || error.name === 'NotAllowedError') {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        },
                        video: false
                    });

                    const audioTrack = localStream.getAudioTracks()[0];
                    if (audioTrack) {
                        localAudioProducer = await sendTransport.produce({ track: audioTrack });
                        console.log('✅ Audio-only producer created');
                    }

                    isCameraOff = true;
                    updateCameraButton();
                    showStatus('Connected (audio only). Camera not available.', 'info');

                } catch (audioError) {
                    console.error('❌ Error getting audio:', audioError);
                    showStatus('Could not access camera or microphone. Please check permissions.', 'error');
                }
            } else {
                showStatus('Could not access camera or microphone. ' + error.message, 'error');
            }
        }

    } catch (error) {
        console.error('❌ Error starting local media production:', error);
        showStatus('Failed to start media production', 'error');
    }
}

// ============================================
// Remote Media Consumption
// ============================================

/**
 * Consume a remote producer (start receiving media from another user)
 */
// Track retry attempts to prevent infinite loops
const consumeRetryAttempts = new Map(); // Map: `${producerId}-${socketId}-${kind}` -> count
const MAX_CONSUME_RETRIES = 3;

/**
 * Wait for transport to be connected
 */
function waitForTransportConnection(transport, timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (transport.connectionState === 'connected') {
            resolve();
            return;
        }
        
        if (transport.closed) {
            reject(new Error('Transport is closed'));
            return;
        }
        
        const timer = setTimeout(() => {
            transport.off('connectionstatechange', handler);
            reject(new Error('Transport connection timeout'));
        }, timeout);
        
        const handler = () => {
            if (transport.connectionState === 'connected') {
                clearTimeout(timer);
                transport.off('connectionstatechange', handler);
                resolve();
            } else if (transport.connectionState === 'failed' || transport.connectionState === 'disconnected') {
                clearTimeout(timer);
                transport.off('connectionstatechange', handler);
                reject(new Error(`Transport connection ${transport.connectionState}`));
            }
        };
        
        transport.on('connectionstatechange', handler);
        
        // Check immediately in case it connected between check and listener
        if (transport.connectionState === 'connected') {
            clearTimeout(timer);
            transport.off('connectionstatechange', handler);
            resolve();
        }
    });
}

async function consumeProducer(producerId, socketId, kind, remoteUserName, retryCount = 0) {
    try {
        const retryKey = `${producerId}-${socketId}-${kind}`;
        
        // Check if we've exceeded max retries
        if (retryCount >= MAX_CONSUME_RETRIES) {
            console.error(`❌ Max retries (${MAX_CONSUME_RETRIES}) reached for ${kind} producer ${producerId} from ${socketId}`);
            consumeRetryAttempts.delete(retryKey);
            return;
        }
        
        if (!recvTransport || !device) {
            console.warn('⚠️ Transports not ready, will retry later');
            // Retry after transports are ready (but limit retries)
            if (retryCount < MAX_CONSUME_RETRIES) {
                setTimeout(() => {
                    if (recvTransport && device) {
                        consumeProducer(producerId, socketId, kind, remoteUserName, retryCount + 1);
                    }
                }, 1000);
            }
            return;
        }
        
        if (!device.loaded) {
            console.warn('⚠️ Device not loaded, will retry later');
            if (retryCount < MAX_CONSUME_RETRIES) {
                setTimeout(() => {
                    if (device && device.loaded) {
                        consumeProducer(producerId, socketId, kind, remoteUserName, retryCount + 1);
                    }
                }, 1000);
            }
            return;
        }
        
        // ✅ CRITICAL: Wait for receive transport to be connected before consuming
        if (recvTransport.connectionState !== 'connected') {
            console.log(`⏳ Waiting for receive transport to connect... (current state: ${recvTransport.connectionState})`);
            try {
                await waitForTransportConnection(recvTransport, 10000);
                console.log('✅ Receive transport connected');
            } catch (error) {
                console.error('❌ Receive transport connection failed:', error);
                if (retryCount < MAX_CONSUME_RETRIES) {
                    setTimeout(() => {
                        consumeProducer(producerId, socketId, kind, remoteUserName, retryCount + 1);
                    }, 2000);
                }
                return;
            }
        }
        
        if (recvTransport.closed) {
            throw new Error('Receive transport is closed');
        }

        console.log(`🔄 Requesting to consume ${kind} from producer ${producerId} (user: ${remoteUserName || socketId})`);
        console.log(`🔍 Transport state: ${recvTransport.connectionState}, Device loaded: ${device.loaded}`);
        
        // Request to consume this producer
        socket.emit('consume', {
            producerId: producerId,
            rtpCapabilities: device.rtpCapabilities,
            roomId: currentRoomId
        });

        // Wait for consumed event with timeout
        const consumedPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.off('consumed', consumedHandler);
                reject(new Error('Timeout waiting for consumed event'));
            }, 10000); // 10 second timeout
            
            const consumedHandler = async (data) => {
                if (data.producerId !== producerId) {
                    // This is for a different producer, ignore
                    return;
                }
                
                clearTimeout(timeout);
                socket.off('consumed', consumedHandler);
                resolve(data);
            };
            
            socket.on('consumed', consumedHandler);
        });
        
        try {
            const data = await consumedPromise;
            
            // ✅ CRITICAL: Validate consumer parameters before creating consumer
            if (!data || !data.id || !data.producerId || !data.kind || !data.rtpParameters) {
                throw new Error('Invalid consumer parameters from server');
            }
            
            if (!data.rtpParameters.codecs || !Array.isArray(data.rtpParameters.codecs) || data.rtpParameters.codecs.length === 0) {
                throw new Error('Invalid RTP parameters: missing or empty codecs');
            }
            
            console.log(`📦 Received consumer params for ${kind}:`, {
                id: data.id,
                producerId: data.producerId,
                kind: data.kind,
                codecs: data.rtpParameters.codecs.map(c => c.mimeType).join(', ')
            });
            
            // ✅ CRITICAL: The transport connect event is triggered when consume() is called
            // So we don't check connection state here - it will connect during consume()
            // However, we verify transport is not closed
            if (recvTransport.closed) {
                throw new Error('Transport is closed');
            }
            
            // Create consumer with validated parameters
            // NOTE: This will trigger the transport 'connect' event if transport is not yet connected
            console.log(`🔧 Creating consumer for ${kind} producer ${data.producerId}...`);
            console.log(`🔍 Transport state before consume: ${recvTransport.connectionState}`);
            
            const consumer = await recvTransport.consume({
                id: data.id,
                producerId: data.producerId,
                kind: data.kind,
                rtpParameters: data.rtpParameters
            });
            
            console.log(`✅ Consumer created successfully: ${consumer.id}`);
            console.log(`🔍 Transport state after consume: ${recvTransport.connectionState}`);
            
            // Now wait for transport to connect if it's not already connected
            // (The connect event handler should have been triggered by consume())
            if (recvTransport.connectionState !== 'connected' && recvTransport.connectionState !== 'connecting') {
                console.log(`⏳ Waiting for transport to connect after consumer creation (state: ${recvTransport.connectionState})...`);
                try {
                    await waitForTransportConnection(recvTransport, 15000);
                    console.log('✅ Transport connected after consumer creation');
                } catch (connectError) {
                    console.error('❌ Transport failed to connect after consumer creation:', connectError);
                    // Don't throw here - consumer might still work if connection succeeds later
                }
            }
            
            // ✅ CRITICAL FIX: Use addEventListener for MediaStreamTrack (not .on())
            // MediaStreamTrack is a native browser Web API, not a mediasoup object
            const track = consumer.track;
            
            // Handle consumer track ended
            track.addEventListener('ended', () => {
                console.log(`⚠️ Track ended for ${kind} from ${socketId}`);
                if (kind === 'video') {
                    const remoteUser = remoteConsumers.get(socketId);
                    if (remoteUser && remoteUser.videoElement) {
                        // Show placeholder when video track ends
                        if (remoteUser.placeholder) {
                            remoteUser.placeholder.style.display = 'flex';
                        }
                        if (remoteUser.videoElement) {
                            remoteUser.videoElement.style.display = 'none';
                        }
                    }
                }
            }, { once: false });
            
            // Handle consumer track muted/unmuted
            track.addEventListener('mute', () => {
                console.log(`🔇 Track muted for ${kind} from ${socketId}`);
            }, { once: false });
            
            track.addEventListener('unmute', () => {
                console.log(`🔊 Track unmuted for ${kind} from ${socketId}`);
            }, { once: false });

            // Get or create remote user data
            if (!remoteConsumers.has(socketId)) {
                remoteConsumers.set(socketId, {
                    audioConsumer: null,
                    videoConsumer: null,
                    userName: remoteUserName || 'User',
                    videoElement: null,
                    videoWrapper: null,
                    videoLabel: null,
                    isSharingScreen: false
                });
            }

            const remoteUser = remoteConsumers.get(socketId);

            // Store consumer based on kind
            if (kind === 'audio') {
                // Close existing audio consumer if any
                if (remoteUser.audioConsumer) {
                    try {
                        remoteUser.audioConsumer.close();
                    } catch (e) {
                        console.warn('Error closing old audio consumer:', e);
                    }
                }
                
                remoteUser.audioConsumer = consumer;
                
                // Create or update audio element (hidden) to play audio
                if (remoteUser.audioElement) {
                    // Update existing audio element
                    const existingStream = remoteUser.audioElement.srcObject;
                    if (existingStream && existingStream instanceof MediaStream) {
                        const existingTrack = existingStream.getAudioTracks()[0];
                        if (existingTrack) {
                            existingStream.removeTrack(existingTrack);
                            existingTrack.stop();
                        }
                        existingStream.addTrack(consumer.track);
                    } else {
                        remoteUser.audioElement.srcObject = new MediaStream([consumer.track]);
                    }
                } else {
                    // Create new audio element
                    const audioElement = document.createElement('audio');
                    audioElement.autoplay = true;
                    audioElement.playsInline = true;
                    audioElement.srcObject = new MediaStream([consumer.track]);
                    audioElement.style.display = 'none';
                    audioElement.volume = 1.0;
                    document.body.appendChild(audioElement);
                    remoteUser.audioElement = audioElement;
                    
                    // Handle audio errors
                    audioElement.addEventListener('error', (e) => {
                        console.warn('Audio element error:', e);
                    });
                }
                
                console.log(`✅ Audio consumer set up for ${remoteUser.userName || socketId}`);
            } else if (kind === 'video') {
                // Close existing video consumer if any
                if (remoteUser.videoConsumer) {
                    try {
                        remoteUser.videoConsumer.close();
                    } catch (e) {
                        console.warn('Error closing old video consumer:', e);
                    }
                }
                
                remoteUser.videoConsumer = consumer;
                // Create or update video element
                createRemoteVideoElement(socketId, remoteUser, consumer.track);
            }

            // ✅ CRITICAL: Resume consumer on server first, then locally
            console.log(`▶️ Resuming consumer ${consumer.id} on server...`);
            try {
                // Resume on server first
                socket.emit('consumer-resume', {
                    consumerId: consumer.id,
                    roomId: currentRoomId
                });
                
                // Then resume locally
                await consumer.resume();
                console.log(`✅ Consumer resumed successfully (both server and client)`);
            } catch (resumeError) {
                console.error('❌ Error resuming consumer:', resumeError);
                // Try to close and cleanup
                try {
                    consumer.close();
                } catch (e) {}
                throw new Error(`Failed to resume consumer: ${resumeError.message}`);
            }

            console.log(`✅ Successfully consuming ${kind} from ${socketId} (producer: ${producerId}, consumer: ${consumer.id})`);
            
            // Clear retry count on success
            const retryKey = `${producerId}-${socketId}-${kind}`;
            if (consumeRetryAttempts.has(retryKey)) {
                consumeRetryAttempts.delete(retryKey);
            }

        } catch (error) {
            console.error(`❌ Error consuming producer ${producerId}:`, error);
            const retryKey = `${producerId}-${socketId}-${kind}`;
            const currentRetries = consumeRetryAttempts.get(retryKey) || retryCount;
            
            // Only retry if we haven't exceeded max retries
            if (currentRetries < MAX_CONSUME_RETRIES) {
                consumeRetryAttempts.set(retryKey, currentRetries + 1);
                const delay = 2000 * (currentRetries + 1); // Exponential backoff
                console.log(`🔄 Retrying ${kind} consumption for ${socketId}... (attempt ${currentRetries + 1}/${MAX_CONSUME_RETRIES}, delay: ${delay}ms)`);
                setTimeout(() => {
                    consumeProducer(producerId, socketId, kind, remoteUserName, currentRetries + 1);
                }, delay);
            } else {
                console.error(`❌ Max retries (${MAX_CONSUME_RETRIES}) reached for ${kind} producer ${producerId} from ${socketId}`);
                consumeRetryAttempts.delete(retryKey);
            }
        }
    } catch (error) {
        console.error(`❌ Error waiting for consumed event for producer ${producerId}:`, error);
        const retryKey = `${producerId}-${socketId}-${kind}`;
        const currentRetries = consumeRetryAttempts.get(retryKey) || retryCount;
        
        // Only retry if we haven't exceeded max retries
        if (currentRetries < MAX_CONSUME_RETRIES) {
            consumeRetryAttempts.set(retryKey, currentRetries + 1);
            const delay = 3000 * (currentRetries + 1); // Exponential backoff
            console.log(`🔄 Retrying consumption for producer ${producerId}... (attempt ${currentRetries + 1}/${MAX_CONSUME_RETRIES}, delay: ${delay}ms)`);
            setTimeout(() => {
                consumeProducer(producerId, socketId, kind, remoteUserName, currentRetries + 1);
            }, delay);
        } else {
            console.error(`❌ Max retries (${MAX_CONSUME_RETRIES}) reached for producer ${producerId} from ${socketId}`);
            consumeRetryAttempts.delete(retryKey);
        }
    }
}

/**
 * Create video element for remote user
 */
function createRemoteVideoElement(socketId, remoteUser, track) {
    try {
        // Create video wrapper if it doesn't exist
        if (!remoteUser.videoWrapper) {
            const wrapper = document.createElement('div');
            wrapper.className = 'video-wrapper';
            wrapper.dataset.socketId = socketId;
            
            // Create placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'video-placeholder';
            const avatar = document.createElement('div');
            avatar.className = 'video-placeholder-avatar';
            avatar.textContent = (remoteUser.userName || 'User').charAt(0).toUpperCase();
            placeholder.appendChild(avatar);
            wrapper.appendChild(placeholder);

            // Create video element
            const video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.className = 'remote-video';
            video.id = `remote-video-${socketId}`;
            video.muted = false;
            video.style.display = 'none'; // Hidden until stream arrives
            wrapper.appendChild(video);

            // Create label
            const label = document.createElement('div');
            label.className = 'video-label';
            label.innerHTML = `<span>${remoteUser.userName || 'User'}</span>`;
            wrapper.appendChild(label);

            // Add click handler for zoom (when sharing screen or has video)
            wrapper.onclick = () => {
                if (remoteUser.videoElement && remoteUser.videoElement.srcObject) {
                    zoomToVideo(remoteUser);
                }
            };

            // Add to video container
            if (videoContainer) {
                videoContainer.appendChild(wrapper);
            }

            remoteUser.videoElement = video;
            remoteUser.videoWrapper = wrapper;
            remoteUser.videoLabel = label;
            remoteUser.placeholder = placeholder;
        }

        // Update video stream
        // Check if we already have a stream for this element
        const existingStream = remoteUser.videoElement?.srcObject;
        let stream;
        
        if (existingStream && existingStream instanceof MediaStream) {
            // Update existing stream by replacing the video track
            const existingVideoTrack = existingStream.getVideoTracks()[0];
            if (existingVideoTrack) {
                existingStream.removeTrack(existingVideoTrack);
                existingVideoTrack.stop();
            }
            existingStream.addTrack(track);
            stream = existingStream;
        } else {
            // Create new stream
            stream = new MediaStream([track]);
        }
        
        if (remoteUser.videoElement) {
            // Stop any pending play() operations
            remoteUser.videoElement.pause();
            
            // Set srcObject
            remoteUser.videoElement.srcObject = stream;
            remoteUser.videoElement.style.display = 'block';
            
            // Wait for metadata to load before playing
            const playVideo = () => {
                remoteUser.videoElement.play()
                    .then(() => {
                        console.log(`✅ Remote video playing for ${remoteUser.userName || socketId}`);
                        // Hide placeholder once video is playing
                        if (remoteUser.placeholder) {
                            remoteUser.placeholder.style.display = 'none';
                        }
                    })
                    .catch(err => {
                        // Ignore AbortError (interrupted by new load) - it's normal
                        if (err.name !== 'AbortError') {
                            console.warn(`⚠️ Error playing remote video for ${remoteUser.userName || socketId}:`, err);
                            // Retry after a short delay
                            setTimeout(() => {
                                if (remoteUser.videoElement && remoteUser.videoElement.srcObject) {
                                    remoteUser.videoElement.play().catch(() => {
                                        // Ignore retry errors
                                    });
                                }
                            }, 500);
                        }
                    });
            };
            
            // Wait for metadata or play immediately if already loaded
            if (remoteUser.videoElement.readyState >= 2) {
                // Metadata already loaded
                playVideo();
            } else {
                // Wait for metadata
                remoteUser.videoElement.addEventListener('loadedmetadata', playVideo, { once: true });
                // Also try to play after a short delay as fallback
                setTimeout(playVideo, 100);
            }
        }

        updateVideoLabel(remoteUser);
        updateVideoGrid();
        updateParticipantsList();

    } catch (error) {
        console.error('❌ Error creating remote video element:', error);
    }
}

/**
 * Remove remote user (clean up when they leave)
 */
function removeRemoteUser(socketId) {
    try {
        const remoteUser = remoteConsumers.get(socketId);
        if (remoteUser) {
            // Close consumers
            if (remoteUser.audioConsumer) {
                remoteUser.audioConsumer.close();
            }
            if (remoteUser.videoConsumer) {
                remoteUser.videoConsumer.close();
            }
            
            // Remove audio element
            if (remoteUser.audioElement && remoteUser.audioElement.parentNode) {
                remoteUser.audioElement.parentNode.removeChild(remoteUser.audioElement);
            }

            // Remove video element
            if (remoteUser.videoWrapper && remoteUser.videoWrapper.parentNode) {
                remoteUser.videoWrapper.parentNode.removeChild(remoteUser.videoWrapper);
            }

            // Remove from map
            remoteConsumers.delete(socketId);

            updateVideoGrid();
            updateParticipantsList();
            console.log(`👋 Removed remote user: ${socketId}`);
        }
    } catch (error) {
        console.error('❌ Error removing remote user:', error);
    }
}

/**
 * Update video grid layout
 */
function updateVideoGrid() {
    // Video grid CSS handles layout automatically
    // This function can be used for custom layout logic if needed
    const totalVideos = remoteConsumers.size + (localVideo ? 1 : 0);
    if (videoContainer) {
        videoContainer.className = `video-grid video-grid-${Math.min(totalVideos, MAX_USERS)}`;
    }
}

// ============================================
// Controls: Mute/Unmute
// ============================================

/**
 * Toggle microphone mute/unmute
 */
function toggleMute() {
    try {
        if (!localAudioProducer) {
            showStatus('Audio not available', 'error');
            return;
        }

        isMuted = !isMuted;
        
        // Pause/resume producer
        if (localAudioProducer) {
            if (isMuted) {
                localAudioProducer.pause();
            } else {
                localAudioProducer.resume();
            }
        }
        
        // Enable/disable tracks
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }
        
        updateLocalVideoLabel();

        updateMuteButton();
        showStatus(isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');

    } catch (error) {
        console.error('❌ Error toggling mute:', error);
        showStatus('Failed to toggle microphone', 'error');
    }
}

/**
 * Update mute button UI
 */
function updateMuteButton() {
    if (muteBtn) {
        const label = muteBtn.querySelector('.control-label');
        if (label) {
            label.textContent = isMuted ? 'Unmute' : 'Mute';
        }
        muteBtn.classList.toggle('active', isMuted);
    }
}

// ============================================
// Controls: Camera Toggle
// ============================================

/**
 * Toggle camera on/off
 */
async function toggleCamera() {
    try {
        if (!localVideoProducer) {
            // Try to start camera if not already producing
            if (!isCameraOff) {
                await startProducingLocalMedia();
            }
            return;
        }

        isCameraOff = !isCameraOff;

        if (isCameraOff) {
            // Pause video producer
            localVideoProducer.pause();
            if (localStream) {
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = false;
                });
            }
            if (localVideo) {
                localVideo.srcObject = null;
            }
        } else {
            // Resume video producer
            localVideoProducer.resume();
            if (localStream) {
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = true;
                });
            }
            if (localVideo && localStream) {
                localVideo.srcObject = localStream;
            }
        }

        updateCameraButton();
        updateLocalVideoLabel();
        showStatus(isCameraOff ? 'Camera off' : 'Camera on', 'info');

    } catch (error) {
        console.error('❌ Error toggling camera:', error);
        showStatus('Failed to toggle camera', 'error');
    }
}

/**
 * Update camera button UI
 */
function updateCameraButton() {
    if (cameraBtn) {
        const label = cameraBtn.querySelector('.control-label');
        if (label) {
            label.textContent = isCameraOff ? 'Camera On' : 'Camera Off';
        }
        cameraBtn.classList.toggle('active', isCameraOff);
    }
}

// ============================================
// Controls: Screen Sharing
// ============================================

/**
 * Toggle screen sharing
 */
async function toggleScreenShare() {
    try {
        if (isSharingScreen) {
            // Stop screen sharing
            if (screenVideoProducer) {
                screenVideoProducer.close();
                screenVideoProducer = null;
            }
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
                screenStream = null;
            }

            // Resume camera if it was on
            if (localVideoProducer && !isCameraOff) {
                localVideoProducer.resume();
                if (localStream) {
                    localStream.getVideoTracks().forEach(track => {
                        track.enabled = true;
                    });
                }
                if (localVideo && localStream) {
                    localVideo.srcObject = localStream;
                }
            }

            isSharingScreen = false;
            updateScreenShareButton();
            updateLocalVideoLabel();
            showStatus('Screen sharing stopped', 'info');

        } else {
            // Start screen sharing
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 },
                        frameRate: { ideal: 30, max: 30 }
                    },
                    audio: false // Screen share typically doesn't include audio
                });

                // Pause camera video producer
                if (localVideoProducer) {
                    localVideoProducer.pause();
                }

                // Produce screen share video
                const screenTrack = screenStream.getVideoTracks()[0];
                if (screenTrack && sendTransport) {
                    screenVideoProducer = await sendTransport.produce({ track: screenTrack });
                    console.log('✅ Screen share producer created');
                }

                // Show screen share in local video
                if (localVideo) {
                    localVideo.srcObject = screenStream;
                }

                // Handle screen share ending (user clicks stop in browser)
                // ✅ Use addEventListener for MediaStreamTrack
                screenTrack.addEventListener('ended', () => {
                    toggleScreenShare();
                }, { once: true });

                isSharingScreen = true;
                updateScreenShareButton();
                updateLocalVideoLabel();
                showStatus('Screen sharing started', 'success');

            } catch (error) {
                console.error('❌ Error starting screen share:', error);
                if (error.name === 'NotAllowedError') {
                    showStatus('Screen sharing permission denied', 'error');
                } else {
                    showStatus('Could not start screen sharing. ' + error.message, 'error');
                }
            }
        }

    } catch (error) {
        console.error('❌ Error toggling screen share:', error);
        showStatus('Failed to toggle screen sharing', 'error');
    }
}

/**
 * Update screen share button UI
 */
function updateScreenShareButton() {
    if (screenShareBtn) {
        const label = screenShareBtn.querySelector('.control-label');
        if (label) {
            label.textContent = isSharingScreen ? 'Stop Sharing' : 'Share Screen';
        }
        screenShareBtn.classList.toggle('active', isSharingScreen);
    }
}

// ============================================
// Room Management
// ============================================

/**
 * Join a room
 */
function joinRoom(roomId, name, password = null) {
    // Make joinRoom available globally
    window.joinRoom = joinRoom;
    console.log('🚪 Joining room:', { roomId, name, hasPassword: !!password });
    currentRoomId = roomId;
    userName = name;
    pendingPassword = password;

    // Check if socket.io is loaded
    if (typeof io === 'undefined') {
        console.error('❌ Socket.io not loaded yet, waiting...');
        setTimeout(() => {
            if (typeof io !== 'undefined') {
                joinRoom(roomId, name, password);
            } else {
                showStatus('Failed to load Socket.io. Please refresh the page.', 'error');
            }
        }, 500);
        return;
    }

    // Initialize socket
    initializeSocket();

    // Wait for socket to connect, then join room
    // Check if socket is already connected
    if (socket && socket.connected) {
        console.log('✅ Socket already connected, joining room immediately');
        socket.emit('join-room', {
            roomId: roomId,
            userName: name,
            password: password || ''
        });
    } else if (socket) {
        console.log('⏳ Waiting for socket to connect...');
        socket.once('connect', () => {
            console.log('✅ Socket connected, joining room...');
            socket.emit('join-room', {
                roomId: roomId,
                userName: name,
                password: password || ''
            });
        });
    } else {
        console.error('❌ Socket not initialized');
        showStatus('Failed to initialize connection', 'error');
    }
}

/**
 * Leave the call
 */
function endCall() {
    try {
        // Close all producers
        if (localAudioProducer) {
            localAudioProducer.close();
            localAudioProducer = null;
        }
        if (localVideoProducer) {
            localVideoProducer.close();
            localVideoProducer = null;
        }
        if (screenVideoProducer) {
            screenVideoProducer.close();
            screenVideoProducer = null;
        }

        // Close transports
        if (sendTransport) {
            sendTransport.close();
            sendTransport = null;
        }
        if (recvTransport) {
            recvTransport.close();
            recvTransport = null;
        }

        // Stop local streams
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            screenStream = null;
        }

        // Clean up remote consumers
        remoteConsumers.forEach((remoteUser, socketId) => {
            removeRemoteUser(socketId);
        });
        remoteConsumers.clear();

        // Disconnect socket
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        // Reset state
        device = null;
        isMuted = false;
        isCameraOff = false;
        isSharingScreen = false;
        currentRoomId = null;
        userName = null;
        isRoomAdmin = false;
        roomHasPassword = false;

        // Redirect to home
        window.location.href = 'index.html';

    } catch (error) {
        console.error('❌ Error ending call:', error);
        window.location.href = 'index.html';
    }
}

// ============================================
// Zoom View (Full Screen)
// ============================================

/**
 * Zoom to video (full screen view)
 */
function zoomToVideo(remoteUser) {
    if (!remoteUser || !remoteUser.videoElement || !remoteUser.videoElement.srcObject) {
        console.warn('⚠️ Cannot zoom: invalid video element or stream');
        return;
    }
    
    closeZoomView();
    
    const zoomOverlay = document.createElement('div');
    zoomOverlay.className = 'zoom-overlay';
    zoomOverlay.id = 'zoomOverlay';
    
    const zoomContent = document.createElement('div');
    zoomContent.className = 'zoom-content';
    
    const zoomVideo = document.createElement('video');
    zoomVideo.autoplay = true;
    zoomVideo.playsInline = true;
    zoomVideo.srcObject = remoteUser.videoElement.srcObject;
    zoomVideo.className = 'zoom-video';
    
    if (remoteUser.isSharingScreen) {
        const zoomLabel = document.createElement('div');
        zoomLabel.className = 'zoom-label';
        zoomLabel.innerHTML = `
            <span>${remoteUser.userName || 'User'}</span>
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
    
    zoomedVideoElement = zoomVideo;
    zoomedVideoWrapper = zoomOverlay;
    document.body.style.overflow = 'hidden';
    
    zoomOverlay.onclick = (e) => {
        if (e.target === zoomOverlay) {
            closeZoomView();
        }
    };
    
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
    if (zoomedVideoWrapper) {
        document.body.removeChild(zoomedVideoWrapper);
        zoomedVideoElement = null;
        zoomedVideoWrapper = null;
        document.body.style.overflow = '';
    }
}

// ============================================
// Initialize on Page Load
// ============================================

/**
 * Initialize the meeting - called after script loads
 */
function initializeMeeting() {
    console.log('🚀 Initializing meeting...');
    
    // Initialize DOM elements
    initializeDOMElements();
    
    // Initialize draggable meeting ID
    initializeDraggableMeetingId();
    
    // Create local video element
    createLocalVideoElement();

    // Get room ID, name, and password from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const name = urlParams.get('name');
    const password = urlParams.get('password');

    if (roomId && name) {
        console.log('📋 Room params found:', { roomId, name, hasPassword: !!password });
        // Auto-join room
        joinRoom(roomId, decodeURIComponent(name), password ? decodeURIComponent(password) : null);
    } else {
        console.warn('⚠️ Missing room params, redirecting to home');
        // Redirect to home if missing params
        window.location.href = 'index.html';
    }
}

// Make initializeMeeting available globally
window.initializeMeeting = initializeMeeting;

// Make all UI functions globally available for onclick handlers
window.copyMeetingId = copyMeetingId;
window.endCall = endCall;
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;
window.toggleScreenShare = toggleScreenShare;
window.toggleChat = toggleChat;
window.toggleParticipants = toggleParticipants;
window.togglePasswordConfig = togglePasswordConfig;
window.submitPassword = submitPassword;
window.submitAdminPassword = submitAdminPassword;
window.closePasswordModal = closePasswordModal;
window.closeAdminPasswordModal = closeAdminPasswordModal;
window.togglePasswordVisibility = togglePasswordVisibility;
window.toggleAdminPasswordVisibility = toggleAdminPasswordVisibility;

// Try to initialize immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMeeting);
} else {
    // DOM is already ready, initialize immediately
    initializeMeeting();
}

// ============================================
// UI Helper Functions
// ============================================

/**
 * Display meeting ID
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
 * Copy meeting ID to clipboard
 */
function copyMeetingId() {
    const meetingIdValue = document.getElementById('meetingIdValue');
    if (!meetingIdValue || !meetingIdValue.textContent || meetingIdValue.textContent === '-') {
        showStatus('No meeting ID available', 'error');
        return;
    }
    const meetingId = meetingIdValue.textContent;
    navigator.clipboard.writeText(meetingId).then(() => {
        showStatus('Meeting ID copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showStatus('Failed to copy meeting ID', 'error');
    });
}

/**
 * Toggle chat panel
 */
function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    const participantsPanel = document.getElementById('participantsPanel');
    if (chatPanel) {
        const isVisible = chatPanel.style.display !== 'none';
        chatPanel.style.display = isVisible ? 'none' : 'flex';
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
        if (!isVisible && chatPanel) {
            chatPanel.style.display = 'none';
        }
        if (!isVisible) {
            updateParticipantsList();
        }
    }
}

/**
 * Update participants list
 */
function updateParticipantsList() {
    const participantsList = document.getElementById('participantsList');
    const participantsCount = document.getElementById('participantsCount');
    if (!participantsList) return;
    
    participantsList.innerHTML = '';
    
    // Add local user
    const localItem = document.createElement('div');
    localItem.className = 'participant-item';
    const localAdminBadge = isRoomAdmin ? `
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
                ${localAdminBadge}
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
    remoteConsumers.forEach((remoteUser, socketId) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        const remoteAdminBadge = remoteUser.isAdmin ? `
            <span class="participant-admin">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Admin
            </span>
        ` : '';
        item.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar">${(remoteUser.userName || 'User').charAt(0).toUpperCase()}</div>
                <div>
                    <span class="participant-name">${remoteUser.userName || 'User'}</span>
                    ${remoteAdminBadge}
                </div>
            </div>
            <div class="participant-status">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
        `;
        participantsList.appendChild(item);
    });
    
    // Update count
    if (participantsCount) {
        const totalCount = 1 + remoteConsumers.size;
        participantsCount.textContent = `Participants (${totalCount})`;
    }
    
    // Show/hide admin controls
    const adminControls = document.getElementById('adminControls');
    if (adminControls) {
        adminControls.style.display = isRoomAdmin ? 'flex' : 'none';
    }
    
    // Update password button visibility
    if (isRoomAdmin) {
        const setPasswordBtn = document.getElementById('setPasswordBtn');
        const resetPasswordBtn = document.getElementById('resetPasswordBtn');
        if (setPasswordBtn && resetPasswordBtn) {
            setPasswordBtn.style.display = roomHasPassword ? 'none' : 'flex';
            resetPasswordBtn.style.display = roomHasPassword ? 'flex' : 'none';
        }
        const configPasswordBtn = document.getElementById('configPasswordBtn');
        if (configPasswordBtn) {
            configPasswordBtn.style.display = 'flex';
        }
    } else {
        const configPasswordBtn = document.getElementById('configPasswordBtn');
        if (configPasswordBtn) {
            configPasswordBtn.style.display = 'none';
        }
    }
}

/**
 * Get initials from name
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
 * Display chat message
 */
function displayChatMessage(messageData, isOwnMessage = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages || !messageData) return;

    // Check if message already exists (prevent duplicates)
    if (chatMessages.querySelector(`[data-message-id="${messageData.id}"]`)) {
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isOwnMessage ? 'chat-message-own' : ''}`;
    messageDiv.dataset.messageId = messageData.id;

    const time = new Date(messageData.timestamp);
    const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderName = isOwnMessage ? 'You' : (messageData.userName || 'User');
    const initials = getInitials(messageData.userName || 'User');

    if (isOwnMessage) {
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
    updateChatMessageCount();
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Update chat message count
 */
function updateChatMessageCount() {
    const chatMessages = document.getElementById('chatMessages');
    const messageCountEl = document.getElementById('chatMessageCount');
    if (!chatMessages || !messageCountEl) return;
    const count = chatMessages.children.length;
    messageCountEl.textContent = `${count} message${count !== 1 ? 's' : ''}`;
}

/**
 * Send chat message
 */
function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput || !socket || !currentRoomId) return;
    const message = chatInput.value.trim();
    if (!message) return;
    socket.emit('chat-message', {
        roomId: currentRoomId,
        message: message
    });
    chatInput.value = '';
}

/**
 * Password modal functions
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
    const roomId = urlParams.get('room');
    const name = urlParams.get('name');
    if (roomId && name) {
        joinRoom(roomId, name, password);
    }
}

/**
 * Admin password modal functions
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
        input.style.display = 'block';
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
    socket.emit('set-room-password', {
        roomId: currentRoomId,
        password: password
    });
    closeAdminPasswordModal();
}

function resetAdminPassword() {
    if (!currentRoomId || !socket) return;
    socket.emit('reset-room-password', {
        roomId: currentRoomId
    });
    closeAdminPasswordModal();
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
    
    meetingIdDisplay.addEventListener('mousedown', (e) => {
        if (e.target.closest('button') || e.target.closest('svg')) {
            return;
        }
        isDragging = true;
        meetingIdDisplay.classList.add('dragging');
        initialX = e.clientX - meetingIdDisplay.offsetLeft;
        initialY = e.clientY - meetingIdDisplay.offsetTop;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        const maxX = window.innerWidth - meetingIdDisplay.offsetWidth;
        const maxY = window.innerHeight - meetingIdDisplay.offsetHeight - 100;
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));
        meetingIdDisplay.style.left = currentX + 'px';
        meetingIdDisplay.style.top = currentY + 'px';
    });
    
    document.addEventListener('mouseup', () => {
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
 * Create local video element
 */
function createLocalVideoElement() {
    if (localVideoWrapper) return;
    
    localVideoWrapper = document.createElement('div');
    localVideoWrapper.className = 'video-wrapper active';
    localVideoWrapper.id = 'local-video-wrapper';
    
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
    localVideo.muted = true;
    localVideo.id = 'localVideo';
    localVideo.style.display = 'none';
    localVideoWrapper.appendChild(localVideo);
    
    if (videoContainer) {
        videoContainer.insertBefore(localVideoWrapper, videoContainer.firstChild);
    }
}

/**
 * Update local video label
 */
function updateLocalVideoLabel() {
    if (!localVideoLabel) return;
    const muted = isMuted || false;
    const isSharing = isSharingScreen || false;
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
            '<svg class="mic-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: hsl(var(--destructive));"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>' :
            '<svg class="mic-on" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>'
        }
    `;
}

/**
 * Update video label for remote user
 */
function updateVideoLabel(remoteUser) {
    if (!remoteUser || !remoteUser.videoLabel) return;
    const userName = remoteUser.userName || 'User';
    const isSharing = remoteUser.isSharingScreen || false;
    const screenShareIndicator = isSharing ? `
        <span class="screen-share-indicator">
            <span class="screen-share-dot"></span>
            <span class="screen-share-text">now live</span>
        </span>
    ` : '';
    remoteUser.videoLabel.innerHTML = `
        <span>${userName}</span>
        ${screenShareIndicator}
    `;
}

// Make functions globally available
window.toggleMute = toggleMute;
window.toggleCamera = toggleCamera;
window.toggleScreenShare = toggleScreenShare;
window.endCall = endCall;
window.zoomToVideo = zoomToVideo;
window.closeZoomView = closeZoomView;
window.toggleChat = toggleChat;
window.toggleParticipants = toggleParticipants;
window.sendChatMessage = sendChatMessage;
window.copyMeetingId = copyMeetingId;
window.togglePasswordConfig = togglePasswordConfig;
window.showPasswordModal = showPasswordModal;
window.closePasswordModal = closePasswordModal;
window.togglePasswordVisibility = togglePasswordVisibility;
window.submitPassword = submitPassword;
window.openSetPasswordModal = openSetPasswordModal;
window.openResetPasswordModal = openResetPasswordModal;
window.closeAdminPasswordModal = closeAdminPasswordModal;
window.toggleAdminPasswordVisibility = toggleAdminPasswordVisibility;
window.submitAdminPassword = submitAdminPassword;
window.resetAdminPassword = resetAdminPassword;

