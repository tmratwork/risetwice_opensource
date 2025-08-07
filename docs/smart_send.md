// file: docs/smart_send.md

# Smart Send Feature Documentation

## Overview

Smart Send is a user-configurable feature that improves conversation flow by allowing users to compose multi-part thoughts before sending them to the AI. Instead of sending each line immediately when Enter is pressed, Smart Send accumulates user input and waits for a pause in typing before sending the complete message.

## User Problem Solved

**Current Behavior (Immediate Send)**:
- User types "I am" → presses Enter → sends to AI immediately
- User types "thinking of a color" → presses Enter → sends to AI immediately  
- User types "and it is blue" → presses Enter → sends to AI immediately
- Result: 3 fragmented messages, potentially confusing AI responses

**With Smart Send Enabled**:
- User types "I am" → presses Enter → message stored locally
- User types "thinking of a color" → presses Enter → appended to stored message
- User types "and it is blue" → presses Enter → appended to stored message
- After 2 seconds of inactivity → sends complete message: "I am thinking of a color and it is blue"

## Technical Behavior

### Trigger Conditions
- **Accumulation**: Enter key and Send button append current input to a message buffer instead of sending immediately
- **Send Trigger**: Message is sent only after X seconds (default: 2 seconds) of complete inactivity AND text input box is empty
- **Inactivity Definition**: No typing, no Enter presses, no Send button clicks
- **Empty Input Check**: Smart Send only activates when text input field contains no text

### Timer Logic
- Timer starts/restarts on every user interaction (typing, Enter, Send button)
- Only when timer completes without interruption does the accumulated message get sent
- If user continues typing/interacting, timer resets and waits again

### User Configuration
- **Default State**: Disabled
- **Toggle Location**: Header menu → "Smart Sending" (above Sign Out)
- **Setting Name**: "Smart Sending"
- **Configuration**: Dialog with enable/disable toggle and delay slider (1-10 seconds)

## Implementation Status ✅ COMPLETED

### **Final Implementation Architecture**

**Header Menu Integration** (`/src/components/header.tsx`):
- ✅ Added "Smart Sending" menu item to AuthButtons dropdown (above Sign Out)
- ✅ Settings icon for clear visual identity
- ✅ Dialog state management in header component
- ✅ Proper click handlers and dropdown closure

**Smart Send Dialog Component** (`/src/components/SmartSendDialog.tsx`):
- ✅ Comprehensive modal with backdrop and escape key support
- ✅ Clear explanation of Smart Sending with examples
- ✅ Enable/disable toggle with visual feedback
- ✅ Configurable delay slider (1-10 seconds)
- ✅ Real-time delay display and current status
- ✅ localStorage integration for persistence
- ✅ Proper form validation and user feedback

**Core Logic** (`/src/app/chatbotV16/page.tsx`):
- ✅ Smart Send timer with configurable delay from localStorage
- ✅ Buffer accumulation and message combination
- ✅ Typing detection with timer restart
- ✅ Edge case handling (page unload, connection loss)
- ✅ Fallback to immediate send when disabled

### **State Management Implementation**

**Zustand Store** (`/src/stores/webrtc-store.ts`):
- ✅ `smartSendEnabled: boolean` (default: true)
- ✅ `messageBuffer: string` for accumulating input
- ✅ `setSmartSendEnabled()` action
- ✅ `appendToMessageBuffer()` action
- ✅ `clearMessageBuffer()` action

**React State/Refs** (component level):
- ✅ `smartSendTimerRef` for timer management
- ✅ Dialog state in header component
- ✅ Local form state in dialog component

**Configuration Storage**:
- ✅ Smart Send enabled/disabled: Zustand store
- ✅ Delay setting: localStorage ('smartSendDelay')
- ✅ Automatic loading of saved settings

### **User Experience Implementation**

**Access Flow**:
1. User clicks profile avatar in header
2. Clicks "Smart Sending" in dropdown menu
3. Dialog opens with full explanation and settings
4. User configures preferences and saves

**Configuration Options**:
- ✅ Enable/disable toggle with clear labeling
- ✅ Delay slider with real-time feedback (1-10 seconds)
- ✅ Current status display
- ✅ Comprehensive help text with examples

**Behavior**:
- ✅ When enabled: Accumulates messages, waits for pause
- ✅ When disabled: Immediate send (original behavior)
- ✅ Configurable delay with slider control
- ✅ Visual feedback throughout interaction

### **Technical Implementation Details**

**Timer Logic**:
- ✅ Reads delay from localStorage dynamically
- ✅ Restarts on every user interaction (typing, Enter, Send)
- ✅ Combines multiple inputs with spaces
- ✅ Sends complete message after inactivity period

**Edge Case Handling**:
- ✅ Page unload: Sends buffered message before leaving
- ✅ Connection loss: Clears buffer and cancels timer
- ✅ Component unmount: Proper timer cleanup
- ✅ Empty buffer validation: Prevents empty sends

**UI Cleanup**:
- ✅ Removed inline checkbox from input area
- ✅ Removed unused CSS styles
- ✅ Cleaned up unused imports and variables

### **Code Quality**
- ✅ TypeScript compliant (no compilation errors)
- ✅ ESLint clean (no linting errors)
- ✅ Proper component structure and separation of concerns
- ✅ Comprehensive error handling and validation

### **Files Modified**
1. `/src/components/SmartSendDialog.tsx` - New dialog component
2. `/src/components/header.tsx` - Added menu item and dialog integration
3. `/src/stores/webrtc-store.ts` - Added Smart Send state and actions
4. `/src/app/chatbotV16/page.tsx` - Core Smart Send logic and timer
5. `/src/app/chatbotV16/chatbotV15.css` - Removed unused styles
6. `/docs/smart_send.md` - Updated documentation

### **Testing Status**
- ✅ TypeScript compilation: Clean
- ✅ ESLint validation: Clean
- ✅ Component integration: Complete
- ✅ State management: Functional
- ✅ Configuration persistence: Working

## Feature Usage

**To Use Smart Sending**:
1. Click profile avatar in header
2. Select "Smart Sending" from menu
3. Configure enable/disable and delay settings
4. Click "Save Settings"

**Behavior**:
- Type message fragments, press Enter between them
- App waits for configured delay period of inactivity
- Sends combined message: "fragment 1 fragment 2 fragment 3"

**Configuration**:
- Toggle: Enable/disable Smart Sending
- Delay: 1-10 seconds (slider control)
- Status: Real-time display of current settings

## Debugging Smart Send Issues

### Enable Debug Logging

Add to `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS=true
```

Then restart the dev server: `npm run dev`

### Debug Process
1. Open browser console (F12)
2. Filter logs by `[smart_send]`
3. Test Smart Send functionality
4. Follow the log flow to identify issues

### Expected Log Sequence
```
[smart_send] ⌨️ Input change detected
[smart_send] 📨 handleSendMessage called
[smart_send] 🧠 Smart Send ENABLED - accumulating message
[smart_send] 🏪 ZUSTAND: appendToMessageBuffer called
[smart_send] ⏳ Starting timer
[smart_send] ⏰ Timer completed - evaluating send conditions
[smart_send] ✅ Send conditions met - creating and sending message
[smart_send] 📤 Attempting to send message via WebRTC
[smart_send] ✅ Message sent successfully
```

### Common Issues
- **Timer never completes**: Check for continuous typing interrupting timer
- **Send conditions not met**: Verify connection status and buffer content
- **WebRTC send failure**: Check connection state and WebRTC logs
- **Buffer not accumulating**: Verify Zustand store actions

See `docs/smart_send_debugging.md` for comprehensive debugging guide.