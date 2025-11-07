# Frontend-Backend Compatibility

The frontend uses these Socket.io events that need to be supported:

## Frontend Events (from client-mediasoup.js)

### Client → Server:
- `join-room` → expects `room-joined` event
- `create-send-transport` → expects `send-transport-created` event  
- `create-recv-transport` → expects `recv-transport-created` event
- `connect-transport` → expects callback
- `create-producer` → expects `producer-created` event
- `consume` → expects `consumed` event
- `get-producers` → expects `existing-producers` event
- `consumer-resume` → expects callback

### Server → Client:
- `room-joined`
- `send-transport-created`
- `recv-transport-created`
- `new-producer`
- `existing-producers`
- `producer-closed`
- `consumed`

## Backend Events (new API)

### Client → Server:
- `joinRoom` → callback
- `createWebRtcTransport` → callback
- `connectWebRtcTransport` → callback
- `produce` → callback
- `consume` → callback
- `getProducers` → callback

We need to add compatibility handlers for the frontend events.

