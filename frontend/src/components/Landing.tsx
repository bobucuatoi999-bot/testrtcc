import { useState } from 'react';
import type { RoomData } from '../types';
import { useSocket } from '../hooks/useSocket';

interface LandingProps {
  onJoinRoom: (data: RoomData) => void;
}

export default function Landing({ onJoinRoom }: LandingProps) {
  const [displayName, setDisplayName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const { socket, connected } = useSocket();

  const handleCreateRoom = () => {
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    if (!socket) {
      setError('Not connected to server. Please wait...');
      return;
    }

    if (!connected) {
      setError('Connecting to server... Please wait.');
      return;
    }

    setIsCreating(true);
    setError('');

           // Set up event listeners BEFORE emitting
           const handleRoomCreated = (data: { roomId: string; userId: string; isAdmin: boolean }) => {
             console.log('✅ Received room-created event', data);
             setIsCreating(false);
             socket.off('room-created', handleRoomCreated);
             socket.off('error', handleError);
             onJoinRoom({
               roomId: data.roomId,
               userId: data.userId,
               displayName: displayName.trim(),
               isAdmin: data.isAdmin,
             });
           };

    const handleError = (err: { message: string }) => {
      setIsCreating(false);
      socket.off('room-created', handleRoomCreated);
      socket.off('error', handleError);
      setError(err.message);
    };

    // Timeout fallback - check after 10 seconds
    const timeoutId = setTimeout(() => {
      socket.off('room-created', handleRoomCreated);
      socket.off('error', handleError);
      setIsCreating(false);
      setError('Request timed out. Please check your connection and try again.');
    }, 10000); // 10 second timeout

    // Wrap handlers to clear timeout
    const wrappedHandleRoomCreated = (data: { roomId: string; userId: string; isAdmin: boolean }) => {
      clearTimeout(timeoutId);
      handleRoomCreated(data);
    };

    const wrappedHandleError = (err: { message: string }) => {
      clearTimeout(timeoutId);
      handleError(err);
    };

    socket.once('room-created', wrappedHandleRoomCreated);
    socket.once('error', wrappedHandleError);

    // Emit the create-room event
    console.log('📤 Emitting create-room event', {
      displayName: displayName.trim(),
      hasPassword: !!roomPassword.trim(),
      socketId: socket.id,
      socketConnected: socket.connected
    });
    
    socket.emit('create-room', {
      displayName: displayName.trim(),
      password: roomPassword.trim() || undefined,
    });
  };

  const handleJoinRoom = () => {
    if (!displayName.trim()) {
      setError('Please enter your display name');
      return;
    }

    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    if (!socket) {
      setError('Not connected to server. Please wait...');
      return;
    }

    if (!connected) {
      setError('Connecting to server... Please wait.');
      return;
    }

    setIsJoining(true);
    setError('');

    // Set up event listeners BEFORE emitting
    const handleRoomJoined = (data: { roomId: string; userId: string; existingUsers: any[] }) => {
      setIsJoining(false);
      socket.off('room-joined', handleRoomJoined);
      socket.off('error', handleError);
      onJoinRoom({
        roomId: data.roomId,
        userId: data.userId,
        displayName: displayName.trim(),
        isAdmin: false,
      });
    };

    const handleError = (err: { message: string }) => {
      setIsJoining(false);
      socket.off('room-joined', handleRoomJoined);
      socket.off('error', handleError);
      setError(err.message);
    };

    // Timeout fallback
    const timeoutId = setTimeout(() => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('error', handleError);
      setIsJoining(false);
      setError('Request timed out. Please check the room ID and try again.');
    }, 10000); // 10 second timeout

    // Wrap handlers to clear timeout
    const wrappedHandleRoomJoined = (data: { roomId: string; userId: string; existingUsers: any[] }) => {
      clearTimeout(timeoutId);
      handleRoomJoined(data);
    };

    const wrappedHandleError = (err: { message: string }) => {
      clearTimeout(timeoutId);
      handleError(err);
    };

    socket.once('room-joined', wrappedHandleRoomJoined);
    socket.once('error', wrappedHandleError);

    // Emit the join-room event
    socket.emit('join-room', {
      roomId: roomId.trim().toLowerCase(), // Normalize room ID
      displayName: displayName.trim(),
      password: password.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">
          WebRTC Video Conferencing
        </h1>

        {!connected && (
          <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded text-yellow-200 text-sm">
            Connecting to server...
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
              Your Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              maxLength={50}
            />
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h2 className="text-lg font-semibold mb-4 text-white">Create Room</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="roomPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Room Password (optional)
                </label>
                <input
                  id="roomPassword"
                  type="password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Set room password (optional)"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !connected}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create New Room'}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h2 className="text-lg font-semibold mb-4 text-white">Join Room</h2>
            <div className="space-y-3">
              <div>
                <label htmlFor="roomId" className="block text-sm font-medium text-slate-300 mb-2">
                  Room ID
                </label>
                <input
                  id="roomId"
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter room ID"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  maxLength={20}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password (optional)
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter room password"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !connected}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded transition-colors"
              >
                {isJoining ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-400">
          <p>Up to 4 users per room</p>
          <p className="mt-1">Peer-to-peer mesh architecture</p>
        </div>
      </div>
    </div>
  );
}

