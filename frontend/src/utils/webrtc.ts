// Free STUN/TURN servers configuration
export const iceServers: RTCConfiguration = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Open Relay Project TURN (20GB/month free)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection(iceServers);
}

// Check if media devices are available
export async function checkMediaDevices(): Promise<{ hasVideo: boolean; hasAudio: boolean }> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { hasVideo: false, hasAudio: false };
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideo = devices.some(device => device.kind === 'videoinput');
    const hasAudio = devices.some(device => device.kind === 'audioinput');

    return { hasVideo, hasAudio };
  } catch (error) {
    console.warn('Error checking media devices:', error);
    return { hasVideo: false, hasAudio: false };
  }
}

// Get user media with graceful fallback for missing devices
export async function getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream | null> {
  try {
    // Check device availability first
    const deviceStatus = await checkMediaDevices();
    
    // Adjust constraints based on available devices
    const adjustedConstraints: MediaStreamConstraints = {
      video: constraints.video && deviceStatus.hasVideo ? constraints.video : false,
      audio: constraints.audio && deviceStatus.hasAudio ? constraints.audio : false,
    };

    // If no devices available, return null (user can still join room)
    if (!adjustedConstraints.video && !adjustedConstraints.audio) {
      console.warn('⚠️ No media devices available. User can still join room without media.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(adjustedConstraints);
      return stream;
    } catch (error: any) {
      // Handle specific error cases gracefully
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.warn('⚠️ Requested device not found. User can still join room without media.');
        return null;
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.warn('⚠️ Permission denied for media access. User can still join room.');
        return null;
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        console.warn('⚠️ Device is already in use. User can still join room.');
        return null;
      } else if (error.name === 'OverconstrainedError') {
        console.warn('⚠️ Constraints not supported. User can still join room.');
        return null;
      }
      // For other errors, log and return null instead of throwing
      console.warn('⚠️ Error getting user media:', error.message);
      return null;
    }
  } catch (error: any) {
    console.error('Error in getUserMedia:', error);
    // Return null instead of throwing - allow user to join without media
    return null;
  }
}

export async function getDisplayMedia(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch (error: any) {
    console.error('Error getting display media:', error);
    // Return null instead of throwing - allow graceful handling
    return null;
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
}

