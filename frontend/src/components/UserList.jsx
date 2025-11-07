import { useState } from 'react';

function UserList({ participants }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`user-list ${isOpen ? 'open' : ''}`}>
      <button
        className="user-list-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle participants list"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span>Participants ({participants.length + 1})</span>
      </button>

      {isOpen && (
        <div className="user-list-content">
          <div className="user-list-header">
            <h3>Participants</h3>
            <button onClick={() => setIsOpen(false)} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="user-list-items">
            {participants.map(participant => (
              <div key={participant.id} className="user-list-item">
                <div className="user-avatar">
                  {participant.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="user-name">{participant.displayName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserList;

