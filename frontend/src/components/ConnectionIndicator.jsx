function ConnectionIndicator({ status }) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#10b981'; // green
      case 'connecting':
        return '#f59e0b'; // yellow
      case 'disconnected':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="connection-indicator">
      <div
        className="connection-dot"
        style={{ backgroundColor: getStatusColor() }}
      />
      <span>{getStatusText()}</span>
    </div>
  );
}

export default ConnectionIndicator;

