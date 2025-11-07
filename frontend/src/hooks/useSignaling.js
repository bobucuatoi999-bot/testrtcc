import { useState, useEffect, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
// Convert HTTP/HTTPS to WS/WSS for WebSocket connections
const WS_URL = API_URL.replace(/^https?:\/\//, (match) => {
  return match === 'https://' ? 'wss://' : 'ws://';
});

export function useSignaling(token, roomId) {
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const messageHandlersRef = useRef([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const isUnmountingRef = useRef(false);

  const connect = useCallback(() => {
    // Don't connect if unmounting
    if (isUnmountingRef.current) return;

    // Close existing connection if any
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Reconnecting');
        }
        wsRef.current = null;
      } catch (e) {
        // Ignore errors when closing
      }
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        
        // Clear reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
          // Notify all message handlers
          messageHandlersRef.current.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected', { code: event.code, reason: event.reason });
        setConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Only reconnect if it wasn't a manual close (code 1000) or normal closure
        // Don't reconnect if code is 1000 (normal closure) or if we're cleaning up
        if (event.code !== 1000 && reconnectTimeoutRef.current === null && wsRef.current === ws) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            if (wsRef.current === ws) { // Only reconnect if this is still the current connection
              connect();
            }
          }, 3000);
        }
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setConnected(false);
    }
  }, [token]);

  const handleMessage = (message) => {
    switch (message.type) {
      case 'joined':
        console.log('Joined room:', message);
        break;

      case 'participants':
        setParticipants(message.participants || []);
        break;

      case 'participant-joined':
        setParticipants(prev => {
          const exists = prev.find(p => p.id === message.participantId);
          if (!exists) {
            return [...prev, { id: message.participantId, displayName: message.displayName }];
          }
          return prev;
        });
        break;

      case 'participant-left':
        setParticipants(prev => prev.filter(p => p.id !== message.participantId));
        break;

      case 'full':
        console.warn('Room is full');
        break;

      case 'pong':
        // Keep-alive response
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  useEffect(() => {
    isUnmountingRef.current = false;
    
    // Only connect if we don't have an active connection with the same token
    const currentWs = wsRef.current;
    const shouldConnect = !currentWs || 
                          currentWs.readyState === WebSocket.CLOSED || 
                          currentWs.readyState === WebSocket.CLOSING;
    
    if (shouldConnect && !isUnmountingRef.current) {
      connect();
    }

    return () => {
      isUnmountingRef.current = true;
      
      // Prevent reconnection on cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (wsRef.current) {
        // Set flag to prevent reconnect
        const ws = wsRef.current;
        wsRef.current = null;
        if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Component unmounting'); // Normal closure
        }
      }
    };
  }, [token, connect]); // Include connect to ensure we use the latest version

  const onMessage = useCallback((handler) => {
    messageHandlersRef.current.push(handler);
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter(h => h !== handler);
    };
  }, []);

  return {
    connected,
    participants,
    sendMessage,
    onMessage
  };
}

