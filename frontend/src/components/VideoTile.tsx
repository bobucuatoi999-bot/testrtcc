import { useRef, useEffect, useState } from 'react';
import type { User } from '../types';

interface VideoTileProps {
  user: User;
  stream: MediaStream | null;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  audioMuted?: boolean;
  videoMuted?: boolean;
}

export default function VideoTile({
  user,
  stream,
  isLocal = false,
  isActiveSpeaker = false,
  audioMuted = false,
  videoMuted = false,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [, setHasVideo] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log(`📹 VideoTile: Setting stream for ${user.displayName}`, {
        streamId: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        videoTrack: stream.getVideoTracks()[0]?.enabled,
      });
      
      videoRef.current.srcObject = stream;
      
      // Force play in case autoplay doesn't work
      videoRef.current.play().catch(err => {
        console.warn(`⚠️ VideoTile: Could not autoplay for ${user.displayName}:`, err);
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const isLive = videoTrack.readyState === 'live';
        setHasVideo(isLive);
        console.log(`📹 VideoTile: Video track for ${user.displayName} - live: ${isLive}`);

        const handleTrackEnded = () => {
          console.log(`📹 VideoTile: Track ended for ${user.displayName}`);
          setHasVideo(false);
        };
        const handleTrackState = () => {
          setHasVideo(videoTrack.readyState === 'live');
        };

        videoTrack.addEventListener('ended', handleTrackEnded);
        videoTrack.addEventListener('unmute', handleTrackState);
        videoTrack.addEventListener('mute', handleTrackState);

        return () => {
          videoTrack.removeEventListener('ended', handleTrackEnded);
          videoTrack.removeEventListener('unmute', handleTrackState);
          videoTrack.removeEventListener('mute', handleTrackState);
        };
      } else {
        console.log(`⚠️ VideoTile: No video track in stream for ${user.displayName}`);
        setHasVideo(false);
      }
    } else if (videoRef.current) {
      console.log(`📹 VideoTile: Removing stream for ${user.displayName}`);
      videoRef.current.srcObject = null;
      setHasVideo(false);
    }
  }, [stream, user.displayName]);

  return (
    <div
      className={`relative bg-slate-800 rounded-lg overflow-hidden aspect-video ${
        isActiveSpeaker ? 'ring-4 ring-primary-500' : ''
      }`}
    >
      {stream && stream.getVideoTracks().length > 0 && !videoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          onLoadedMetadata={() => {
            console.log(`✅ VideoTile: Video metadata loaded for ${user.displayName}`);
          }}
          onLoadedData={() => {
            console.log(`✅ VideoTile: Video data loaded for ${user.displayName}`);
          }}
          onCanPlay={() => {
            console.log(`✅ VideoTile: Video can play for ${user.displayName}`);
          }}
          onError={(e) => {
            console.error(`❌ VideoTile: Video error for ${user.displayName}:`, e);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-700">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-slate-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-slate-300 font-medium">{user.displayName}</p>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <div className="bg-black/70 px-2 py-1 rounded text-white text-sm font-medium flex items-center gap-2">
          <span>{user.displayName}</span>
          {user.isAdmin && (
            <span className="bg-primary-600 px-1.5 py-0.5 rounded text-xs">Admin</span>
          )}
        </div>
        <div className="flex gap-1">
          {audioMuted && (
            <div className="bg-red-600 p-1.5 rounded">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
          )}
          {videoMuted && (
            <div className="bg-red-600 p-1.5 rounded">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

