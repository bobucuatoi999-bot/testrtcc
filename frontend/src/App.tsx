import { useState, useEffect } from 'react';
import Landing from './components/Landing';
import Room from './components/Room';
import type { RoomData } from './types';
import { cleanupSocket } from './hooks/useSocket';

function App() {
  const [roomData, setRoomData] = useState<RoomData | null>(null);

  const handleJoinRoom = (data: RoomData) => {
    setRoomData(data);
  };

  const handleLeaveRoom = () => {
    setRoomData(null);
  };

  // Cleanup socket only when entire app unmounts
  useEffect(() => {
    return () => {
      cleanupSocket();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900">
      {!roomData ? (
        <Landing onJoinRoom={handleJoinRoom} />
      ) : (
        <Room roomData={roomData} onLeaveRoom={handleLeaveRoom} />
      )}
    </div>
  );
}

export default App;

