import { useState } from 'react';
import Landing from './components/Landing';
import Room from './components/Room';

function App() {
  const [roomData, setRoomData] = useState(null);

  const handleJoinRoom = (data) => {
    setRoomData(data);
  };

  const handleLeaveRoom = () => {
    setRoomData(null);
  };

  return (
    <div className="app">
      {!roomData ? (
        <Landing onJoinRoom={handleJoinRoom} />
      ) : (
        <Room roomData={roomData} onLeaveRoom={handleLeaveRoom} />
      )}
    </div>
  );
}

export default App;

