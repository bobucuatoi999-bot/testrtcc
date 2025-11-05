// ============================================
// Server Configuration
// ============================================
// This file configures the signaling server URL
// For Railway deployment, this is automatically set

// Production URL - Railway deployment
// Update this with your Railway URL after deployment
window.SERVER_URL = window.SERVER_URL || 'https://testrtcc-production.up.railway.app';

// For local development, use:
// window.SERVER_URL = 'http://localhost:3000';

console.log('📡 Server URL configured:', window.SERVER_URL);
