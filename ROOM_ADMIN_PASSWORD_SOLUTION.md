# Room Admin & Password System - Solution Proposal

## Overview
This document outlines the implementation plan for two new features:
1. **Room Admin System** - First user who creates the room becomes admin
2. **Room Password System** - Admin can set/reset password, joiners need password if set

## Feasibility Analysis

### ✅ **FEASIBLE** - Both features can be implemented reliably

**Why it's feasible:**
- Server already tracks rooms and users
- Socket.io events can handle password validation
- UI can be extended with modals and admin controls
- No breaking changes to existing functionality

## Implementation Plan

### 1. Room Admin System

#### Server-Side (server.js)
- **New Data Structure:**
  ```javascript
  // Track room admins: { roomId: socketId }
  const roomAdmins = new Map();
  ```

- **Logic:**
  - When a room is created (first user joins empty room), set them as admin
  - Include `isAdmin: true/false` in `room-joined` event
  - Include `isAdmin` status in `room-users` and `user-joined` events
  - When admin leaves, room becomes admin-less (or assign to next user)

#### Client-Side (client.js)
- **Track admin status:**
  ```javascript
  let isRoomAdmin = false;
  ```

- **Update participants list:**
  - Show admin badge (crown/shield icon) next to admin's name
  - Display "Admin" text next to admin in participants list

#### UI (meeting.html, meeting.css)
- Add admin badge styling
- Show admin controls only to admin user

### 2. Room Password System

#### Server-Side (server.js)
- **New Data Structures:**
  ```javascript
  // Track room passwords: { roomId: password }
  const roomPasswords = new Map();
  ```

- **Modified `join-room` handler:**
  - Check if room has password
  - If password exists, validate provided password
  - If wrong password, emit error and reject join
  - If no password or correct password, allow join

- **New Event Handlers:**
  - `set-room-password`: Admin sets password (requires admin check)
  - `reset-room-password`: Admin removes password (requires admin check)
  - `room-password-updated`: Broadcast to all users when password changes

#### Client-Side (client.js)
- **Password prompt:**
  - Before joining, check if room requires password
  - Show modal to enter password
  - Send password with `join-room` event

- **Admin controls:**
  - Show "Set Password" / "Reset Password" button for admin
  - Modal to set/reset password
  - Handle password update events

#### UI (meeting.html, meeting.css)
- **Password modal:**
  - Modal overlay for entering password
  - Input field with show/hide password toggle
  - Submit and cancel buttons

- **Admin controls:**
  - Button in participants panel or control bar
  - Modal for setting/resetting password
  - Visual indicator if room has password

## Data Flow

### Joining a Room (with password)
1. User enters room ID and name
2. Client sends `join-room` with `{ roomId, userName, password }`
3. Server checks:
   - Is room new? → Set first user as admin
   - Does room have password? → Validate password
   - Wrong password? → Emit error, reject join
   - Correct/no password? → Allow join, send `room-joined` with admin status
4. Client receives `room-joined` with `isAdmin: true/false`
5. If admin, show admin controls

### Setting Password (Admin only)
1. Admin clicks "Set Password"
2. Modal opens, admin enters password
3. Client sends `set-room-password` with `{ roomId, password }`
4. Server validates:
   - User is admin? → Set password
   - Not admin? → Emit error
5. Server broadcasts `room-password-updated` to all room users
6. All users see password status update

### Resetting Password (Admin only)
1. Admin clicks "Reset Password"
2. Confirmation dialog
3. Client sends `reset-room-password` with `{ roomId }`
4. Server validates admin, removes password
5. Server broadcasts `room-password-updated` to all room users

## Security Considerations

1. **Password Storage:**
   - Store passwords in memory (server-side only)
   - Passwords cleared when room is deleted
   - No password persistence (ephemeral)

2. **Password Validation:**
   - Server-side validation only
   - Wrong password = immediate rejection
   - No hints or retry limits (can be added later)

3. **Admin Verification:**
   - Server validates admin status on every admin action
   - Socket ID must match room admin
   - Prevents unauthorized password changes

## UI/UX Design

### Password Modal
- Dark theme matching app design
- Centered overlay
- Input field with placeholder
- "Join" and "Cancel" buttons
- Error message display

### Admin Badge
- Crown or shield icon next to admin name
- Blue/gold color to stand out
- Tooltip: "Room Admin"

### Admin Controls
- Button in participants panel (only visible to admin)
- "Set Password" / "Change Password" / "Remove Password"
- Modal for password input
- Visual indicator: "🔒 Protected" if password set

## Edge Cases

1. **Admin leaves room:**
   - Room becomes admin-less
   - Password remains (can't be changed until new admin)
   - Option: Assign admin to next user (future enhancement)

2. **Room becomes empty:**
   - Admin status cleared
   - Password cleared
   - Room deleted

3. **Multiple admins (shouldn't happen):**
   - Only first user is admin
   - Server enforces single admin per room

4. **Password on empty room:**
   - If admin sets password and leaves, password remains
   - New users need password to join
   - No one can change password (admin-less)

## Testing Checklist

- [ ] First user becomes admin
- [ ] Admin badge displays correctly
- [ ] Non-admin users don't see admin controls
- [ ] Setting password works (admin only)
- [ ] Resetting password works (admin only)
- [ ] Joining with correct password works
- [ ] Joining with wrong password fails
- [ ] Joining without password when room has password fails
- [ ] Joining without password when room has no password works
- [ ] Password cleared when room becomes empty
- [ ] Admin status persists when admin reconnects

## Implementation Order

1. Server-side: Admin tracking and password system
2. Client-side: Admin status tracking and password prompt
3. UI: Admin badge and password modal
4. UI: Admin controls for setting/resetting password
5. Testing and refinement

## Estimated Complexity

- **Difficulty:** Medium
- **Time:** 2-3 hours
- **Risk:** Low (additive features, no breaking changes)

