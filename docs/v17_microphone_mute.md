# V17 Microphone Mute Implementation

## Overview

V17 uses ElevenLabs WebRTC for voice conversations. Muting the microphone in this context required intercepting `navigator.mediaDevices.getUserMedia()` and controlling audio track states.

## The Problem

ElevenLabs manages its own audio streams through WebRTC. Standard mute approaches failed because:

1. **Stream Persistence**: ElevenLabs captures audio streams early and reuses them
2. **No Direct API**: ElevenLabs doesn't expose a native mute/unmute API
3. **Timing Issues**: Mute state changes need to affect both existing and future streams

## Failed Approaches

### 1. ElevenLabs micMuted Parameter
- **Tried**: Setting `micMuted` in conversation initialization
- **Failed**: Caused re-initialization loops and connection issues

### 2. Future-Only Stream Control
- **Tried**: Only intercepting `getUserMedia` for future streams
- **Failed**: ElevenLabs continued using existing streams, so mute had no effect

### 3. Conversation Object Manipulation
- **Tried**: Directly manipulating ElevenLabs conversation methods
- **Failed**: No reliable mute methods exposed in the conversation object

## Working Solution

### Implementation Strategy

The working approach controls **both existing and future streams**:

1. **Track Active Streams**: Store references to all audio streams created via `getUserMedia`
2. **Intercept getUserMedia**: Apply mute state immediately to new streams
3. **Control Existing Streams**: When mute state changes, disable/enable all tracked streams

### Code Location

File: `src/hooksV17/use-elevenlabs-conversation.ts`

### Key Components

#### Stream Tracking
```typescript
const activeStreamsRef = useRef<MediaStream[]>([]);
```

#### getUserMedia Interception
```typescript
navigator.mediaDevices.getUserMedia = async function(constraints: MediaStreamConstraints) {
  const stream = await originalGetUserMedia(constraints);
  
  if (constraints.audio) {
    // Track the stream
    activeStreamsRef.current.push(stream);
    
    // Apply current mute state
    stream.getAudioTracks().forEach(track => {
      track.enabled = !isMicrophoneMutedRef.current;
    });
    
    // Cleanup when stream ends
    stream.addEventListener('ended', () => {
      activeStreamsRef.current = activeStreamsRef.current.filter(s => s !== stream);
    });
  }
  
  return stream;
};
```

#### Global Control Function
```typescript
(window as any).controlMicrophone = (muted: boolean) => {
  isMicrophoneMutedRef.current = muted;
  
  // Control ALL existing streams immediately
  activeStreamsRef.current.forEach(stream => {
    stream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  });
};
```

### How It Works

1. **Stream Creation**: When ElevenLabs requests audio access, `getUserMedia` is intercepted
2. **Immediate Application**: New streams get the current mute state applied instantly
3. **Stream Tracking**: Each audio stream is stored in `activeStreamsRef`
4. **Mute State Changes**: `controlMicrophone` affects ALL tracked streams immediately
5. **Memory Management**: Ended streams are automatically removed from tracking

### Integration with Store

The mute state is managed by `useElevenLabsStore()`:

```typescript
// Update mute state when store changes
useEffect(() => {
  isMicrophoneMutedRef.current = store.isMuted;
  
  if (typeof (window as any).controlMicrophone === 'function') {
    (window as any).controlMicrophone(store.isMuted);
  }
}, [store.isMuted]);
```

## Why This Works

1. **Immediate Effect**: Existing streams are controlled instantly when mute state changes
2. **Future Coverage**: New streams automatically get the correct mute state
3. **Memory Safe**: Streams are cleaned up when they end
4. **WebRTC Compatible**: Works with ElevenLabs' WebRTC implementation

## Debugging

Enable V17 logs to see mute operations:

```bash
# .env.local
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

Look for these log patterns:
- `🎤 getUserMedia called` - Stream creation
- `🎤 Added stream to tracking` - Stream tracking
- `🎤 Setting microphone mute state` - Mute state changes
- `🎤 Stream X, track Y - enabled: false` - Individual track control

## Common Issues

### Mute Not Working
- Check if streams are being tracked: Look for "Added stream to tracking" logs
- Verify `controlMicrophone` is being called: Look for "Setting microphone mute state" logs
- Ensure track control is happening: Look for "enabled: false" logs

### Memory Leaks
- Streams should auto-cleanup when they end
- If streams accumulate, check the 'ended' event listener is working

## Technical Notes

- Uses `track.enabled = false` instead of `track.stop()` to preserve the stream for unmuting
- Intercepts at the `navigator.mediaDevices` level to catch all audio requests
- Maintains compatibility with ElevenLabs' internal stream management
- No modifications to ElevenLabs SDK required