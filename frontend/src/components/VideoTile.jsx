import { useEffect, useRef } from 'react';

function VideoTile({ stream, displayName, isLocal, isMuted, isVideoOff }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Force video element to play
      videoRef.current.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  // Handle track additions/removals in the stream
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const updateVideoSrc = () => {
      if (videoRef.current) {
        // Force update if video element already has the stream
        const currentSrc = videoRef.current.srcObject;
        if (currentSrc !== stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }
    };

    // Listen for track additions (important for screen sharing)
    stream.getTracks().forEach(track => {
      track.addEventListener('ended', updateVideoSrc);
    });

    // Update when tracks change
    const interval = setInterval(() => {
      if (videoRef.current && stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack.readyState === 'live' && videoRef.current.readyState < 2) {
          videoRef.current.play().catch(() => {});
        }
      }
    }, 1000);

    return () => {
      stream.getTracks().forEach(track => {
        track.removeEventListener('ended', updateVideoSrc);
      });
      clearInterval(interval);
    };
  }, [stream]);

  return (
    <div className={`video-tile ${isLocal ? 'local' : 'remote'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={isVideoOff ? 'video-hidden' : ''}
      />
      {isVideoOff && (
        <div className="video-placeholder">
          <div className="video-placeholder-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      )}
      <div className="video-tile-label">
        <span>{displayName}</span>
        {isMuted && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </div>
    </div>
  );
}

export default VideoTile;

