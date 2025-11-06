// ============================================
// Room Management Logic
// Handles room creation, joining, and URL management
// ============================================

/**
 * Generate a unique room name with "9w" prefix
 * Format: 9w + random alphanumeric string
 * @returns {string} Unique room ID
 */
function generateRoomName() {
    // Generate random part (7 characters)
    const randomPart = Math.random().toString(36).substring(2, 9);
    // Return with "9w" prefix
    return '9w' + randomPart;
}

/**
 * Generate a human-readable room name
 * Format: adjective-noun-number
 * Example: "happy-tiger-1234"
 * @returns {string} Human-readable room name
 */
function generateHumanReadableRoomName() {
    const adjectives = ['happy', 'bright', 'quick', 'calm', 'wise', 'bold', 'swift', 'clear', 'sharp', 'smart'];
    const nouns = ['tiger', 'eagle', 'river', 'mountain', 'star', 'ocean', 'forest', 'cloud', 'wave', 'light'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(1000 + Math.random() * 9000);
    
    return `${randomAdjective}-${randomNoun}-${number}`;
}

/**
 * Get room ID from URL parameters
 * @returns {string|null} Room ID or null
 */
function getRoomIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

/**
 * Get user name from URL parameters
 * @returns {string|null} User name or null
 */
function getUserNameFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('name');
}

/**
 * Get password from URL parameters
 * @returns {string|null} Password or null
 */
function getPasswordFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('password');
}

/**
 * Create a room URL with parameters
 * @param {string} roomId - Room ID
 * @param {string} userName - User name
 * @param {string} password - Optional password
 * @returns {string} Full URL
 */
function createRoomURL(roomId, userName, password = null) {
    const baseURL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    let url = `${baseURL}meeting.html?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(userName)}`;
    
    if (password) {
        url += `&password=${encodeURIComponent(password)}`;
    }
    
    return url;
}

/**
 * Copy room link to clipboard
 * @param {string} roomId - Room ID
 * @param {string} userName - User name
 * @param {string} password - Optional password
 * @returns {Promise<boolean>} Success status
 */
async function copyRoomLink(roomId, userName, password = null) {
    try {
        const url = createRoomURL(roomId, userName, password);
        
        // Use modern Clipboard API if available
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            } catch (err) {
                document.body.removeChild(textArea);
                return false;
            }
        }
    } catch (error) {
        console.error('Error copying room link:', error);
        return false;
    }
}

/**
 * Validate room ID format
 * @param {string} roomId - Room ID to validate
 * @returns {boolean} True if valid
 */
function isValidRoomId(roomId) {
    if (!roomId || typeof roomId !== 'string') {
        return false;
    }
    
    // Room ID should be at least 3 characters
    if (roomId.length < 3) {
        return false;
    }
    
    // Room ID should only contain alphanumeric characters, hyphens, and underscores
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    return validPattern.test(roomId);
}

/**
 * Sanitize room ID (remove invalid characters)
 * @param {string} roomId - Room ID to sanitize
 * @returns {string} Sanitized room ID
 */
function sanitizeRoomId(roomId) {
    if (!roomId) return '';
    
    // Remove invalid characters, keep only alphanumeric, hyphens, underscores
    return roomId.replace(/[^a-zA-Z0-9_-]/g, '');
}

// Export functions (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateRoomName,
        generateHumanReadableRoomName,
        getRoomIdFromURL,
        getUserNameFromURL,
        getPasswordFromURL,
        createRoomURL,
        copyRoomLink,
        isValidRoomId,
        sanitizeRoomId
    };
}

