// ============================================
// Jitsi Meet Configuration
// ============================================

/**
 * Jitsi Meet configuration options
 * These settings control the behavior and appearance of the Jitsi meeting
 */
const jitsiConfig = {
    // Start settings
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    
    // UI settings
    prejoinPageEnabled: false, // We handle pre-join ourselves
    
    // Quality settings
    resolution: 720,
    constraints: {
        video: {
            height: { ideal: 720, max: 720, min: 360 }
        }
    },
    
    // Features
    enableWelcomePage: false,
    enableClosePage: false,
    disableDeepLinking: true,
    
    // Recording (disable if not needed)
    fileRecordingsEnabled: false,
    liveStreamingEnabled: false,
    
    // Performance
    disableAudioLevels: false,
    enableLayerSuspension: true,
    
    // P2P settings (disable for reliability with 7 users - force SFU mode)
    p2p: {
        enabled: false // Force SFU mode always for better reliability
    },
    
    // Room settings
    enableNoAudioDetection: true,
    enableNoisyMicDetection: true,
    
    // Mobile optimization
    disableThirdPartyRequests: false,
    
    // Background blur (optional)
    backgroundAlpha: 0.5
};

/**
 * Jitsi Meet interface configuration
 * Controls which UI elements are shown
 */
const interfaceConfig = {
    // Toolbar buttons to show
    TOOLBAR_BUTTONS: [
        'microphone',
        'camera', 
        'desktop',      // Screen sharing
        'chat',
        'participants-pane',
        'tileview',
        'videoquality',
        'fullscreen',
        'hangup'
    ],
    
    // Branding (customize as needed)
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    SHOW_BRAND_WATERMARK: false,
    BRAND_WATERMARK_LINK: '',
    
    // Settings
    SETTINGS_SECTIONS: ['devices', 'language', 'moderator'],
    
    // Disable features you don't need
    FILM_STRIP_MAX_HEIGHT: 120,
    DISABLE_VIDEO_BACKGROUND: false,
    
    // Video layout
    VERTICAL_FILMSTRIP: true,
    
    // Chat
    HIDE_INVITE_MORE_HEADER: false,
    
    // Participants
    DISABLE_FOCUS_INDICATOR: false,
    DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
    
    // Mobile
    MOBILE_APP_PROMO: false,
    
    // Default language
    DEFAULT_LANGUAGE: 'en'
};

// Export configuration (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { jitsiConfig, interfaceConfig };
}

