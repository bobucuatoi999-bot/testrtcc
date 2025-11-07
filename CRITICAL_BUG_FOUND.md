# 🐛 CRITICAL BUG FOUND!

## The Bug

**Line 902-903 in `peerjs-backend/public/index.html`:**

```javascript
// For each user in room (except self), ensure we have a connection
users.forEach((user, uid) => {
  if (uid !== userId && user.peerId !== peerId) {  // ❌ BUG HERE!
```

## The Problem

**`uid !== userId`** - This compares the **LOOP VARIABLE** `uid` with the **GLOBAL VARIABLE** `userId`.

But `uid` is the KEY from the Map, and `userId` is our own userId!

### What's happening:

```javascript
users.forEach((user, uid) => {
  // uid = "user123" (the other user's ID)
  // userId = "user456" (OUR user ID)
  
  if (uid !== userId && user.peerId !== peerId) {
    // This should check if uid is not our own userId
    // BUT IT'S ALWAYS TRUE because uid is never equal to userId
    // Actually this is correct...
  }
});
```

Wait, let me re-read this...

Actually, the logic seems correct. The issue is elsewhere.

Let me check the `ensureAllConnections()` function more carefully:

```javascript
function ensureAllConnections() {
  console.log('🔍 Checking connections...');
  console.log('📊 Current users:', Array.from(users.values()).map(u => ({
    displayName: u.displayName,
    peerId: u.peerId,
    userId: u.userId,
  })));
  console.log('📊 Active calls:', Array.from(calls.keys()));
  console.log('📊 Remote streams:', Array.from(remoteStreams.keys()));
  
  // For each user in room (except self), ensure we have a connection
  users.forEach((user, uid) => {
    if (uid !== userId && user.peerId !== peerId) {
      if (!calls.has(user.peerId)) {
        console.log(`⚠️ Missing connection to ${user.displayName} (${user.peerId}), creating...`);
        callUser(user.peerId, user.userId);  // ❌ BUG: user.userId is the userId!
      } else if (!remoteStreams.has(user.peerId)) {
        console.log(`⚠️ Have call but no stream from ${user.displayName} (${user.peerId}), checking...`);
        const call = calls.get(user.peerId);
        if (!call || !call.open) {
          calls.delete(user.peerId);
          callUser(user.peerId, user.userId);  // ❌ BUG: user.userId is the userId!
        }
      }
    }
  });
}
```

Wait, I see it now! The bug is:

```javascript
callUser(user.peerId, user.userId);
```

But `user` is the user object which has `{ userId, peerId, displayName }`.

So this should be correct. Let me check the user object structure...

Actually, I need to look at how users are stored:

```javascript
users.set(userId, {
  userId,
  peerId,
  displayName,
});
```

So the key is `userId` and the value has `{ userId, peerId, displayName }`.

In the forEach:
```javascript
users.forEach((user, uid) => {
  // uid = the key (userId)
  // user = { userId, peerId, displayName }
```

So when we do `callUser(user.peerId, user.userId)`, we're passing:
- `targetPeerId` = user.peerId ✅
- `targetUserId` = user.userId ✅

This looks correct...

## Let me check the actual issue

Looking at the symptoms again:
- User A sees A and B (A → B works)
- User B sees only C (B → C works, B → A doesn't)
- User C sees nobody

This suggests:
1. When B joins, B calls A (works)
2. When B joins, A should call B (doesn't work?)
3. When C joins, C calls A and B (doesn't work?)
4. When C joins, A and B should call C (doesn't work?)

The issue might be in the timing or the incoming call handler.

Let me check the incoming call handler in PeerJS:

```javascript
peer.on('call', (call) => {
  console.log(`📞 Received incoming call from ${call.peer}`);
  
  // Answer with local stream
  if (localStream) {
    console.log(`✅ Answering call from ${call.peer} with local stream`);
    call.answer(localStream);
  }
  
  // Handle remote stream
  call.on('stream', (remoteStream) => {
    console.log(`📥 Received remote stream from ${call.peer}`);
    remoteStreams.set(call.peer, remoteStream);
    updateVideoGrid();
  });
  
  call.on('close', () => {
    console.log(`📴 Incoming call closed with ${call.peer}`);
    calls.delete(call.peer);
    remoteStreams.delete(call.peer);
    updateVideoGrid();
  });
  
  call.on('error', (error) => {
    console.error(`❌ Incoming call error from ${call.peer}:`, error);
  });
  
  calls.set(call.peer, call);
});
```

This looks correct. When we receive a call, we answer it and set up the stream handler.

## The Real Issue

I think the issue might be that PeerJS can have duplicate connections if both sides try to call each other at the same time!

When A and B both try to call each other:
1. A calls B
2. B calls A
3. Now there are TWO separate calls!
4. PeerJS might only keep one of them

The fix is to use a deterministic rule: only the new joiner should call existing users, and existing users should NOT call the new joiner.

This way:
- A creates room (no calls)
- B joins room → B calls A (one call)
- C joins room → C calls A and C calls B (two more calls)

Total: 3 calls for 3 users (correct for mesh).

But our current code has:
- New joiner calls existing users ✅
- Existing users ALSO call new joiner ❌ (duplicate!)

This creates race conditions and duplicate calls.

