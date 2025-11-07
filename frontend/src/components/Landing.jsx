import { useState } from 'react';

// Use environment variable for API URL, fallback to localhost for development
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

function Landing({ onJoinRoom }) {
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreateRoom = async () => {
    if (!roomName.trim() || !displayName.trim()) {
      setError('Room name and display name are required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Create room
      const createRes = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          password: isPrivate ? password : null
        })
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || 'Failed to create room');
      }

      const { roomId } = await createRes.json();

      // Join room
      await handleJoin(roomId);
    } catch (err) {
      setError(err.message);
      setIsCreating(false);
    }
  };

  const handleJoin = async (roomId) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          displayName: displayName.trim(),
          password: isPrivate ? password : null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join room');
      }

      const data = await res.json();
      onJoinRoom({
        ...data,
        displayName: displayName.trim(),
        roomName: roomName.trim()
      });
    } catch (err) {
      setError(err.message);
      setIsCreating(false);
    }
  };

  const handleJoinExisting = async () => {
    if (!roomName.trim() || !displayName.trim()) {
      setError('Room ID and display name are required');
      return;
    }

    setIsCreating(true);
    setError('');
    await handleJoin(roomName.trim());
  };

  return (
    <div className="landing">
      <div className="landing-container">
        <h1>WebRTC Mesh Video Call</h1>
        <p className="subtitle">Connect with up to 4 participants</p>

        <div className="landing-form">
          <div className="form-group">
            <label htmlFor="displayName">Your Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="roomName">
              {isPrivate ? 'Room ID' : 'Room Name'}
            </label>
            <input
              id="roomName"
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder={isPrivate ? 'Enter room ID' : 'Enter room name'}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private room (password protected)
            </label>
          </div>

          {isPrivate && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter room password"
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button
              onClick={handleCreateRoom}
              disabled={isCreating}
              className="btn btn-primary"
            >
              {isCreating ? 'Creating...' : 'Create Room'}
            </button>
            <button
              onClick={handleJoinExisting}
              disabled={isCreating}
              className="btn btn-secondary"
            >
              {isCreating ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Landing;

