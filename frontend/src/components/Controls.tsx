interface ControlsProps {
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenSharing: boolean;
  hasVideoDevice?: boolean;
  hasAudioDevice?: boolean;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onLeaveRoom: () => void;
}

export default function Controls({
  videoEnabled,
  audioEnabled,
  screenSharing,
  hasVideoDevice = true,
  hasAudioDevice = true,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onLeaveRoom,
}: ControlsProps) {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-800 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border border-slate-700">
      <button
        onClick={onToggleAudio}
        disabled={!hasAudioDevice}
        className={`p-3 rounded-full transition-colors ${
          !hasAudioDevice
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : audioEnabled
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
        title={!hasAudioDevice ? 'No microphone available' : audioEnabled ? 'Mute' : 'Unmute'}
      >
        {audioEnabled ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </button>

      <button
        onClick={onToggleVideo}
        disabled={!hasVideoDevice}
        className={`p-3 rounded-full transition-colors ${
          !hasVideoDevice
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
            : videoEnabled
            ? 'bg-slate-700 hover:bg-slate-600 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
        title={!hasVideoDevice ? 'No camera available' : videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        {videoEnabled ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        )}
      </button>

      <button
        onClick={onToggleScreenShare}
        className={`p-3 rounded-full transition-colors ${
          screenSharing
            ? 'bg-primary-600 hover:bg-primary-700 text-white'
            : 'bg-slate-700 hover:bg-slate-600 text-white'
        }`}
        title={screenSharing ? 'Stop sharing' : 'Share screen'}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      <div className="w-px h-8 bg-slate-600 mx-1" />

      <button
        onClick={onLeaveRoom}
        className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
        title="Leave room"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

