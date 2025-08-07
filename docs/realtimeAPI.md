# OpenAI Realtime API Implementation in V16

## Overview

V16 uses the OpenAI Realtime API for real-time voice conversations. This document describes how our implementation handles conversation context and message management.

## Model Configuration

V16 uses the OpenAI Realtime API model: **`gpt-4o-realtime-preview-2025-06-03`**

This is configured in `/src/app/api/v15/session/route.ts:41` and used by V16 through the V15 session endpoint.

## Context Management

### During a Single Session

**The OpenAI Realtime API itself maintains conversation context automatically.**

- The API maintains a **128k token context window** throughout the WebSocket session
- All conversation within a single session is automatically remembered
- No manual context management is needed on our end
- The AI can reference any part of the conversation that happened earlier in the same session

### Message Sending Pattern

Our code sends **individual messages only**, not full conversation history:

```typescript
// Each message is sent individually using conversation.item.create
const formattedMessage = {
  type: "conversation.item.create",
  item: {
    type: "message",
    role: "user",
    content: [
      {
        type: "input_text",
        text: message, // Only the new message
      },
    ],
  },
};
```

### Session vs Cross-Session Context

**Within a Session:**
- OpenAI Realtime API remembers everything automatically
- No conversation history needs to be sent with each message
- Context is maintained at the WebSocket session level

**Between Sessions:**
- Our code handles context through enhanced prompts and summaries
- Previous conversation context is maintained through intelligent prompt engineering
- Message history is stored in database but not sent to OpenAI for new sessions

## Key Implementation Details

### Session Creation

When establishing a WebRTC connection, V16 calls `/api/v15/session` with:
- Voice settings
- Instructions (current prompt)
- Tools (function definitions)
- Tool choice
- Greeting instructions

**No conversation history is included in session payload.**

### Message Flow

1. **New Messages**: Each user message is sent via `sendMessage()` in connection-manager.ts
2. **Individual Processing**: Messages are processed individually by OpenAI
3. **Automatic Context**: OpenAI maintains full conversation context throughout the session

### Database vs OpenAI Context

- **Database**: V16 stores ALL conversation messages with no limits
- **OpenAI Session**: Only receives current session messages as they occur
- **Context Continuity**: Handled through enhanced system prompts, not message history

## Architecture Benefits

This stateful session approach provides:

1. **Efficient Token Usage**: No need to resend conversation history
2. **Reduced Payload Size**: Only new messages are transmitted
3. **Automatic Context Management**: OpenAI handles conversation memory
4. **Scalable Design**: No client-side conversation history management needed

## Comparison to Traditional Chat APIs

Unlike traditional chat APIs where you need to send full conversation history with each request, the Realtime API:
- Maintains stateful sessions
- Automatically manages conversation context
- Only requires sending new messages/items
- Provides persistent memory throughout the session

## Implementation Files

- `/src/app/api/v15/session/route.ts` - Session creation and model configuration
- `/src/hooksV15/webrtc/connection-manager.ts` - Message sending and WebRTC management
- `/src/app/v16/page.tsx` - V16 main implementation