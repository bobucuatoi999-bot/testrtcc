# Real-Time In-Call Chat Solution

## Overview
This document outlines the solution for implementing real-time chat during video calls.

## Requirements ✅
- ✅ Real-time chat during calls
- ✅ Messages auto-update for all users
- ✅ Messages disappear when user leaves (ephemeral)
- ✅ Only users currently in call can see messages
- ✅ Messages persist for remaining users when someone leaves
- ✅ Messages cleared when room becomes empty
- ✅ **Chat button toggles left sidebar panel** (UI requirement)
- ✅ **Auto-delete all chat when room becomes empty** (no users left)
- ✅ **High-scale reliability: Handle 10,000+ rooms × 7 users = 70,000+ concurrent users**

## Technical Approach

### Server-Side (server.js)

#### 1. Message Storage
```javascript
// Store messages per room
// Format: { roomId: [{ id, userName, message, timestamp, socketId }] }
const roomMessages = new Map();
```

#### 2. New Socket Events
- **`chat-message`** (client → server)
  - Receives: `{ roomId, message }`
  - Validates user is in room
  - Stores message in `roomMessages[roomId]`
  - Broadcasts to all users in room via `chat-message` event

- **`chat-history`** (server → client)
  - Sent when user joins room
  - Contains all existing messages for that room
  - Allows new users to see previous messages

#### 3. Message Lifecycle
- **Message Created**: When user sends message
- **Rate Limiting Check**: Verify user hasn't exceeded message limit
- **Message Stored**: Added to `roomMessages[roomId]` array
- **Message Limit Enforcement**: If room has 100+ messages, remove oldest (FIFO)
- **Message Broadcast**: Sent to all users in room via Socket.io
- **Message Retrieved**: New users get `chat-history` when joining
- **Message Cleanup**: 
  - **Immediate deletion** when room becomes empty (0 users)
  - **Automatic cleanup** on room deletion
  - **Memory cleanup** on disconnect

#### 4. Rate Limiting & Security
- **Per-user rate limit**: 10 messages/minute (tracked by socketId)
- **Message validation**: Max 500 characters, sanitize HTML
- **Room validation**: Verify user is in room before accepting message
- **Spam prevention**: Reject if user exceeds rate limit

### Client-Side (client.js)

#### 1. Sending Messages
- Modify `sendChatMessage()` to:
  - Get message from input
  - Emit `chat-message` event to server with `{ roomId, message }`
  - Clear input field
  - Show message locally immediately (optimistic update)

#### 2. Receiving Messages
- Listen for `chat-message` event from server
- Display message in chat panel
- Auto-scroll to bottom
- Distinguish own messages vs others (styling)

#### 3. Chat History
- Listen for `chat-history` event when joining room
- Display all existing messages in chat panel
- Only show if user is in active call

#### 4. Cleanup
- Clear chat messages when leaving room/ending call
- Don't persist messages across sessions
- **Left sidebar toggle**: Chat button toggles `chatPanel` (left sidebar)
- **Auto-clear on room empty**: When room has 0 users, all messages deleted server-side

## Implementation Steps

### Step 1: Server-Side Implementation
1. Add `roomMessages` Map to store messages per room
2. Add `userMessageCounts` Map for rate limiting (socketId → { count, resetTime })
3. Add `chat-message` event handler with:
   - Rate limiting check
   - Room validation
   - Message sanitization
   - Message limit enforcement (100 max per room)
4. Broadcast messages to room
5. Send chat history on room join
6. **Auto-delete all messages when room becomes empty (0 users)**
7. Clean up rate limit data on disconnect

### Step 2: Client-Side Implementation
1. Update `sendChatMessage()` to emit to server
2. Add listener for incoming `chat-message` events
3. Add listener for `chat-history` event
4. Create `displayChatMessage()` helper function
5. Clear chat on disconnect/leave

### Step 3: UI Enhancements (Optional)
1. Add "You" indicator for own messages
2. Different styling for own vs others' messages
3. Message timestamps
4. Smooth scrolling

## Data Flow

```
User A sends message
    ↓
Client emits 'chat-message' { roomId, message }
    ↓
Server receives message
    ↓
Server stores in roomMessages[roomId]
    ↓
Server broadcasts to all users in room
    ↓
All clients (including User A) receive 'chat-message'
    ↓
All clients display message in chat panel
```

## Message Format

```javascript
{
  id: 'unique-message-id',        // Generated server-side
  userName: 'John Doe',           // From userNames Map
  message: 'Hello everyone!',     // Message text
  timestamp: 1234567890,          // Unix timestamp
  socketId: 'socket-id-123'       // Sender's socket ID
}
```

## Edge Cases Handled

1. **User joins mid-call**: Receives chat history automatically
2. **User leaves**: Messages persist for others, cleared locally
3. **Room becomes empty**: All messages cleared from memory
4. **Rapid messages**: Queue handled by Socket.io
5. **Server restart**: Messages lost (ephemeral by design)

## Security & Reliability Considerations

1. ✅ **Validate user is in room** before accepting message
2. ✅ **Sanitize message content** (prevent XSS attacks)
3. ✅ **Limit message length**: 500 characters max
4. ✅ **Rate limiting**: 
   - 10 messages per minute per user
   - Prevents spam and abuse
   - Tracks by socketId + timestamp
5. ✅ **Room validation**: Double-check user belongs to room
6. ✅ **Message limit per room**: 100 messages max (FIFO cleanup)
7. ✅ **Input validation**: Reject empty/null messages
8. ✅ **Memory safety**: Prevent unbounded memory growth

## Performance Considerations for High-Scale Traffic

### Current Scale Target: 10,000 rooms × 7 users = 70,000 concurrent users

1. **Memory Management**:
   - Messages stored in-memory only (ephemeral)
   - One Map per room, cleared immediately when empty
   - **Message limit per room**: 100 messages max (prevents memory bloat)
   - **Auto-cleanup**: Old messages removed when limit reached (FIFO)

2. **Scalability Optimizations**:
   - Efficient Map usage (O(1) lookups)
   - Room cleanup on disconnect (no orphaned rooms)
   - Message array size limits (prevent unbounded growth)
   - No event listener leaks (proper cleanup)

3. **Rate Limiting** (Critical for 70k users):
   - **Per-user**: Max 10 messages per minute
   - **Per-room**: Max 100 messages total (prevents spam)
   - **Message length**: Max 500 characters
   - Automatic throttling to prevent abuse

4. **Network Efficiency**:
   - Real-time via Socket.io (efficient WebSocket)
   - Broadcast only to users in specific room
   - No unnecessary data transmission
   - Efficient message format (minimal JSON)

5. **Memory Leak Prevention**:
   - ✅ Immediate cleanup when room is empty
   - ✅ Remove all references on disconnect
   - ✅ Clear message arrays when room deleted
   - ✅ No dangling event listeners

6. **UI Optimization**:
   - Virtual scrolling for large message lists (future)
   - Efficient DOM updates (batch if needed)
   - Auto-scroll only when at bottom

## Testing Scenarios

1. ✅ Send message and verify all users receive it
2. ✅ Join room mid-call and verify chat history loads
3. ✅ Leave room and verify messages clear locally
4. ✅ Multiple users sending simultaneously
5. ✅ Room becomes empty and messages cleared

## Estimated Implementation Time
- **Server-side**: ~30 minutes
- **Client-side**: ~30 minutes
- **Testing**: ~20 minutes
- **Total**: ~1.5 hours

## Conclusion

This is a **straightforward implementation** that leverages existing Socket.io infrastructure. The solution is:
- ✅ Simple and maintainable
- ✅ Real-time and efficient
- ✅ Ephemeral (no persistence)
- ✅ Scalable for multiple rooms
- ✅ Secure (with validation)

Ready to implement! 🚀

