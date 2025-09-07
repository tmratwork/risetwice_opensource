# ElevenLabs Agent Configuration Guide

## Overview

This document explains how to properly configure ElevenLabs Conversational AI agents, particularly voice settings, based on lessons learned during V17 implementation.

## Key Learnings

### 1. Voice Configuration Location

**❌ Wrong Approach - Runtime Overrides:**
```typescript
// Don't do this - unnecessary complexity
const conversation = useConversation({
  overrides: {
    tts: {
      voiceId: "EmtkmiOFoQVpKRVpXH2B",
      model: "eleven_turbo_v2_5",
      // ... other settings
    }
  }
});
```

**✅ Correct Approach - Agent Configuration:**
Configure the voice directly in the agent itself via the ElevenLabs API during agent creation/update.

### 2. Model Compatibility Requirements

**Critical Discovery:** ElevenLabs has strict model requirements for different agent types.

**Error encountered:**
```
"Value error, English Agents must use turbo or flash v2."
```

**Model Requirements:**
- **English agents:** Must use `eleven_turbo_v2` or `eleven_flash_v2`
- **DO NOT use:** `eleven_turbo_v2_5` (causes 400 error)

**Working Voice Configuration:**
```typescript
const voiceConfig = {
  voice_id: "EmtkmiOFoQVpKRVpXH2B",  // Your target voice ID
  model_id: "eleven_turbo_v2",        // ✅ Compatible model for English agents
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true
};
```

### 3. Agent Update Process

**API Endpoint Pattern:**
```typescript
// Update existing agent
const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
  method: 'PATCH',
  headers: {
    'xi-api-key': process.env.ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversation_config: {
      agent: {
        prompt: {
          prompt: "Your agent instructions...",
          first_message: "Your greeting..."
        }
      },
      tts: voiceConfig  // ✅ Include voice configuration here
    },
    name: "Agent Name",
    tags: ["tag1", "tag2"]
  })
});
```

### 4. Debugging Strategy

**Essential Logging for Voice Configuration:**
```typescript
// 1. Log the configuration being sent
console.log('Voice config being sent:', voiceConfig);

// 2. Log API response status
if (!response.ok) {
  const errorText = await response.text();
  console.log('PATCH failed:', response.status, errorText);
}

// 3. Verify what was actually set
const updatedAgent = await response.json();
console.log('Response voice_id:', updatedAgent.conversation_config?.tts?.voice_id);
```

**Verification Query:**
```typescript
// Always verify the agent configuration after updates
const verifyResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
  method: 'GET',
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
});

const agentData = await verifyResponse.json();
console.log('Current voice_id:', agentData.conversation_config?.tts?.voice_id);
```

### 5. Common Pitfalls

**Pitfall 1: Using Incompatible Models**
- `eleven_turbo_v2_5` fails with English agents
- Always use `eleven_turbo_v2` for English agents

**Pitfall 2: Runtime Overrides**
- Adding overrides to `useConversation` hook is unnecessary
- Configure voice in the agent itself for persistence

**Pitfall 3: Silent Failures**
- Voice configuration may fail while instructions succeed
- Always check both instruction AND voice verification logs

**Pitfall 4: Assuming API Success**
- ElevenLabs may return 200 but not apply voice changes
- Always verify the actual configuration after updates

### 6. Working Implementation

**File:** `src/app/api/v17/agents/create/route.ts`

```typescript
// 1. Set voice configuration
const voiceConfig = {
  voice_id: voiceId,
  model_id: "eleven_turbo_v2",  // Compatible model
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true
};

// 2. Update agent with both instructions AND voice
const updateResponse = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
  method: 'PATCH',
  headers: {
    'xi-api-key': ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversation_config: {
      agent: {
        prompt: {
          prompt: aiPrompt.prompt_content,
          first_message: "Hello! I'm here to provide mental health support..."
        }
      },
      tts: voiceConfig  // ✅ Include voice configuration
    }
  })
});

// 3. Always verify the result
if (!updateResponse.ok) {
  const errorText = await updateResponse.text();
  console.error('Voice configuration failed:', errorText);
}
```

## Best Practices

1. **Single Source of Truth:** Configure voice in the agent, not in runtime overrides
2. **Use Compatible Models:** `eleven_turbo_v2` for English agents
3. **Always Verify:** Check actual agent configuration after updates
4. **Log Everything:** Debug voice issues with comprehensive logging
5. **Handle Errors:** Voice configuration can fail independently of instruction updates

## Troubleshooting

**Problem:** Voice doesn't change after configuration
1. Check server logs for PATCH success/failure
2. Verify the voice_id is supported with your model
3. Confirm the agent is using the updated configuration
4. Check ElevenLabs dashboard to see current agent settings

**Problem:** 400 Error "English Agents must use turbo or flash v2"
1. Change model from `eleven_turbo_v2_5` to `eleven_turbo_v2`
2. Ensure you're not using unsupported model versions

**Problem:** Configuration appears successful but voice unchanged
1. Voice ID may be invalid or incompatible
2. Agent may be cached - try different agent ID
3. Check ElevenLabs account permissions for the voice