file: docs/smart_send_debugging.md

# Smart Send Debugging Guide

## Overview

Comprehensive logging has been added to debug why Smart Send messages are not reaching the AI. The logging follows the established LivingBooks logging standards.

## Environment Variable Setup

Add this to your `.env.local` file:

```bash
# Smart Send debugging logs
NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS=true
```

## Restart Development Server

After adding the environment variable, restart the dev server:

```bash
npm run dev
```

## Log Categories

All Smart Send logs use the `[smart_send]` prefix and include emojis for easy identification:

### 🎯 **Input Detection Logs**
- `⌨️ Input change detected` - Every keystroke/input change
- `🔄 Smart Send enabled - restarting timer on input change`
- `⚠️ Smart Send disabled - no timer action on input change`

### 📨 **Send Message Logs**
- `📨 handleSendMessage called` - When Enter/Send button pressed
- `❌ Send aborted - missing message or not connected`
- `🧠 Smart Send ENABLED - accumulating message`
- `⚡ Smart Send DISABLED - immediate send mode`

### ⏰ **Timer Management Logs**
- `🔄 Timer start/restart requested`
- `⏹️ Cleared existing timer`
- `⏳ Starting timer` - Shows delay and buffer content
- `⏰ Timer completed - evaluating send conditions`
- `🛑 Canceling Smart Send timer`

### ✅ **Message Processing Logs**
- `✅ Send conditions met - creating and sending message`
- `📝 Adding message to conversation`
- `📤 Attempting to send message via WebRTC`
- `✅ Message sent successfully - setting thinking state`
- `🧹 Buffer cleared after successful send`

### ❌ **Error/Failure Logs**
- `❌ Send conditions NOT met - skipping send`
- `❌ Message send FAILED - keeping buffer`
- `❌ Immediate send FAILED`

### 🏪 **Zustand Store Logs**
- `🏪 ZUSTAND: setSmartSendEnabled called`
- `🏪 ZUSTAND: appendToMessageBuffer called`
- `🏪 ZUSTAND: clearMessageBuffer called`

### 💾 **Dialog Logs**
- `💾 Dialog: Save button clicked`
- `✅ Dialog: Settings saved successfully`
- `❌ Dialog: Cancel button clicked - reverting changes`

## Testing Procedure

1. **Enable logging** in `.env.local`
2. **Restart dev server**
3. **Open browser console** (F12 → Console tab)
4. **Filter logs**: Search for `[smart_send]` in console
5. **Test Smart Send**:
   - Type fragment 1 → Press Enter
   - Type fragment 2 → Press Enter
   - Wait for timer to complete
   - Check if message is sent

## Expected Log Flow

For a successful Smart Send operation, you should see:

```
[smart_send] ⌨️ Input change detected
[smart_send] 📨 handleSendMessage called
[smart_send] 🧠 Smart Send ENABLED - accumulating message
[smart_send] 🏪 ZUSTAND: appendToMessageBuffer called
[smart_send] 📝 Message appended to buffer
[smart_send] 🧹 Input field cleared
[smart_send] 🔄 Timer start/restart requested
[smart_send] ⏳ Starting timer
[smart_send] ⏰ Smart Send timer started/restarted

// After delay (e.g., 2 seconds of inactivity)
[smart_send] ⏰ Timer completed - evaluating send conditions
[smart_send] ✅ Send conditions met - creating and sending message
[smart_send] 📝 Adding message to conversation
[smart_send] 📤 Attempting to send message via WebRTC
[smart_send] ✅ Message sent successfully - setting thinking state
[smart_send] 🧹 Buffer cleared after successful send
[smart_send] 🏁 Timer reference cleared
```

## Common Issues to Look For

### 🚨 Issue 1: Timer Gets Canceled Immediately (CRITICAL - FIXED)
**Symptoms**: 
```
[smart_send] ⏳ Starting timer
[smart_send] 🛑 Canceling Smart Send timer  ← IMMEDIATELY!
```
**Root Cause**: useEffect cleanup function with `messageBuffer` in dependency array
**Status**: ✅ FIXED - Split useEffect into separate effects with proper dependencies

### Issue 2: Timer Never Completes
**Symptoms**: Logs show timer starting but never completing
**Look for**: Missing `⏰ Timer completed` log
**Possible causes**: Continuous typing, timer being canceled

### Issue 3: Send Conditions Not Met
**Symptoms**: Timer completes but message not sent
**Look for**: `❌ Send conditions NOT met - skipping send`
**Check**: `isConnected` status, buffer content

### Issue 4: WebRTC Send Failure
**Symptoms**: Message created but WebRTC send fails
**Look for**: `❌ Message send FAILED`
**Check**: Connection state, WebRTC status

### Issue 5: Buffer Not Accumulating
**Symptoms**: Messages not combining
**Look for**: `🏪 ZUSTAND: appendToMessageBuffer called` logs
**Check**: Store actions being called correctly

### Issue 6: State Synchronization Problems
**Symptoms**: Different values for `currentBuffer` vs `messageBuffer`
**Look for**: Mismatched buffer values in timer logs
**Check**: Zustand store state consistency

## Log Analysis Tips

1. **Filter by timestamp**: Look at the timing between log entries
2. **Check buffer content**: Verify messages are being accumulated correctly
3. **Verify connection state**: Ensure `isConnected: true` in logs
4. **Track timer lifecycle**: Start → Complete → Send sequence
5. **Monitor store updates**: Zustand actions should be called

## Disable Logging

When debugging is complete, disable logs:

```bash
# .env.local
NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS=false
```

Or remove the line entirely and restart the dev server.

## Files Modified for Logging

1. **`/src/app/chatbotV16/page.tsx`**:
   - Input change detection
   - Send message handling
   - Timer management
   - Edge case handling

2. **`/src/stores/webrtc-store.ts`**:
   - Zustand store actions
   - State changes

3. **`/src/components/SmartSendDialog.tsx`**:
   - Dialog interactions
   - Settings save/cancel

All logging follows the established `[smart_send]` prefix convention and includes structured data for easy analysis.