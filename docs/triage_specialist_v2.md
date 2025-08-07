file: docs/triage_specialist_v2.md

# V16 Unified Persona with Expertise Shift System

## Overview
The V16 unified persona system eliminates visible AI handoffs by presenting a single AI that accesses different specialized knowledge areas. This implementation uses OpenAI's `session.update` API to dynamically replace AI configuration while maintaining the active connection and a unified persona experience.

## Architecture

### Core Components

#### 1. **AI Configuration Defaults** (`/src/config/ai-defaults.ts`)
```typescript
// TODO: Move these to Supabase tables
export const AI_DEFAULTS = {
  voice: "alloy",                    // Uniform voice across all AIs
  inputAudioFormat: "pcm16",
  outputAudioFormat: "pcm16",
  modalities: ["text", "audio"],
  inputAudioTranscription: {
    model: "gpt-4o-transcribe",
    language: "en"
  },
  turnDetection: {
    type: "server_vad",
    silence_duration_ms: 1000
  },
  toolChoice: "auto"
};
```

#### 2. **Connection Manager Enhancement** (`/src/hooksV15/webrtc/connection-manager.ts`)
```typescript
/**
 * Replace AI configuration without disconnecting WebRTC
 */
public async replaceAIConfiguration(newConfig: {
  instructions: string;
  tools: unknown[];
}): Promise<boolean> {
  // Create session update with complete AI replacement
  const sessionUpdate = {
    type: "session.update",
    session: {
      modalities: AI_DEFAULTS.modalities,
      instructions: newConfig.instructions,
      voice: AI_DEFAULTS.voice,
      input_audio_format: AI_DEFAULTS.inputAudioFormat,
      output_audio_format: AI_DEFAULTS.outputAudioFormat,
      input_audio_transcription: AI_DEFAULTS.inputAudioTranscription,
      turn_detection: AI_DEFAULTS.turnDetection,
      tools: newConfig.tools,
      tool_choice: AI_DEFAULTS.toolChoice
    }
  };

  // Send session update and wait for confirmation
  this.dataChannel.send(JSON.stringify(sessionUpdate));
  return await this.waitForSessionUpdateConfirmation();
}
```

#### 3. **Configuration Loading API** (`/src/app/api/v16/replace-session-config/route.ts`)
- Loads specialist prompts and functions from Supabase `ai_prompts` table
- Functions are stored in the `functions` jsonb column of the same table
- Enhances prompts with triage context summaries
- Returns complete AI configuration for session updates

#### 4. **Enhanced Function Registry Manager** (`/src/stores/webrtc-store.ts`)
```typescript
/**
 * Clear all functions from registry
 */
clearAllFunctions() {
  this.registry = {};
  this.initialized = false;
  // Clear window registry as well for compatibility
}

/**
 * Load specialist functions from Supabase
 */
async loadSpecialistFunctions(specialistType: string, loader: Function) {
  this.clearAllFunctions();
  const functions = await loader(specialistType);
  return functions;
}
```

#### 5. **WebRTC Store Actions** (`/src/stores/webrtc-store.ts`)
```typescript
/**
 * Replace AI configuration without disconnecting WebRTC
 */
replaceAIConfiguration: async (newConfig: { instructions: string; tools: unknown[] }) => {
  const success = await currentState.connectionManager.replaceAIConfiguration(newConfig);
  
  if (success) {
    // Update store with new function definitions
    set({
      availableFunctions: {
        ...currentState.availableFunctions,
        supabase: newConfig.tools
      }
    });
  }
  
  return success;
}
```

## Unified Persona Expertise Shift Flow

### Step-by-Step Process

#### **Step 1: Expertise Shift Initiation**
- Triage AI calls `trigger_specialist_handoff` function
- System waits for `output_audio_buffer.stopped` event (audio completion)
- Expertise shift parameters stored in WebRTC store `pendingHandoff`

#### **Step 2: Configuration Loading**
```typescript
const configResponse = await fetch('/api/v16/replace-session-config', {
  method: 'POST',
  body: JSON.stringify({
    specialistType,
    conversationId,
    contextSummary
  })
});
```

#### **Step 3: Function Registry Update**
```typescript
const registryManager = FunctionRegistryManager.getInstance();
registryManager.clearAllFunctions();
await loadFunctionsForAI(specialistType);
```

#### **Step 4: AI Configuration Replacement**
```typescript
const replaceSuccess = await useWebRTCStore.getState().replaceAIConfiguration({
  instructions: configData.config.instructions,
  tools: configData.config.tools
});
```

#### **Step 5: Database Tracking**
```typescript
await fetch('/api/v16/end-session', {
  method: 'POST',
  body: JSON.stringify({
    conversationId,
    specialistType: 'triage',
    contextSummary,
    reason: 'unified_persona_expertise_shift'
  })
});
```

#### **Step 6: UI State Update**
```typescript
setTriageSession({
  sessionId: conversationId,
  currentSpecialist: specialistType,
  conversationId,
  contextSummary,
  isHandoffPending: false
});
```

#### **Step 7: Expertise Shift Message Injection**
- **File**: `/src/config/greetingInstructions.ts`
- **Function**: `getSpecialistGreeting(specialistType: string, contextSummary: string)`
- **Implementation Location**: `/src/app/chatbotV16/page.tsx` (lines 644-672)

```typescript
// Get specialist greeting from greetingInstructions.ts
const greetingMessage = getSpecialistGreeting(specialistType, contextSummary);

// Inject expertise shift message to trigger specialized response
const greetingInjection = {
  type: "conversation.item.create",
  item: {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: greetingMessage }]
  }
};
connectionManager.dataChannel.send(JSON.stringify(greetingInjection));

// Trigger AI response to the injected message
setTimeout(() => {
  const response = {
    type: "response.create",
    response: {
      modalities: ["text", "audio"],
      max_output_tokens: 2000
    }
  };
  connectionManager.dataChannel.send(JSON.stringify(response));
}, 1000);
```

## Technical Benefits

### **1. No Audio Interruption**
- WebRTC connection maintained throughout handoff
- User hears complete AI transition messages
- No connection dropout or silence gaps

### **2. Instant Configuration Updates**
- OpenAI Realtime API supports live `session.update` messages
- AI behavior changes immediately without reconnection
- Function definitions updated in real-time

### **3. Complete AI State Replacement**
- All previous instructions are completely replaced
- All previous functions are completely cleared and reloaded
- Clean specialist state with no legacy artifacts

### **4. Uniform Voice Experience**
- Same voice (`alloy`) used across all expertise areas
- No voice changes during expertise shifts
- Consistent user experience

### **5. Context Preservation**
- Triage context injected into specialist prompts
- Database tracking maintains expertise shift history
- Complete conversation continuity

### **6. Unified Persona Expertise Shift Messages**
- Code injects contextual expertise shift messages as "user input"
- Each message frames the transition as accessing specialized knowledge
- Messages reference context and prompt AI to respond with specialized expertise
- Two-step process: inject message + trigger response for immediate specialized engagement

## Database Schema

### **Data Storage**
- **Prompts**: Stored in `ai_prompts` table with `prompt_type` identifier
- **Functions**: Stored in `ai_prompts.functions` jsonb column
- **Context**: Enhanced into specialist prompts during handoff

### **Query Structure**
```typescript
// Single query loads both prompt and functions
const { data: promptData } = await supabase
  .from('ai_prompts')
  .select('prompt_content, voice_settings, functions')
  .eq('prompt_type', specialistType)
  .eq('is_active', true)
  .single();
```

## Error Handling Strategy

### **Breaking Errors (Early Beta)**
```typescript
// No fallbacks - errors should be visible
if (!replaceSuccess) {
  throw new Error('Failed to replace AI configuration');
}

// No silent failures
if (!configResponse.ok) {
  throw new Error(`Failed to load specialist configuration: ${configResponse.status}`);
}
```

### **Error Scenarios**
1. **Configuration Load Failure** → Breaking error with clear message
2. **Function Loading Failure** → Breaking error, specialist functions required
3. **Session Update Failure** → Breaking error, no fallback to disconnect/reconnect
4. **Database Update Failure** → Warning logged, handoff continues

## Data Flow

### **Context Enhancement**
```typescript
// Context injected into specialist prompts
if (contextSummary && !contextSummary.includes('Resuming conversation from')) {
  const contextInstruction = `\n\nIMPORTANT CONTEXT FROM TRIAGE AI:\n${contextSummary}\n\nBased on this context, provide focused and relevant support for the user's specific needs.`;
  enhancedPromptContent = promptData.prompt_content + contextInstruction;
}
```

### **Function Registry Flow**
```
Triage Functions → CLEAR ALL → Specialist Functions → Registry Update → WebRTC Store Update
```

### **Database Tracking**
```
conversations.current_specialist: 'triage' → 'anxiety'
conversations.specialist_history: [..., { handoff_record }]
messages: [{ routing_metadata: { context_summary } }]
```

## Testing and Verification

### **Success Indicators**
```bash
[triageAI][handoff-v2] ✅ Step 1: Handoff marked as pending
[triageAI][handoff-v2] ✅ Step 2: Configuration loaded
[triageAI][handoff-v2] ✅ Step 3: Specialist functions loaded successfully
[triageAI][handoff-v2] ✅ Step 4: AI configuration replaced successfully
[triageAI][handoff-v2] ✅ Step 5: Database updated with handoff record
[triageAI][handoff-v2] ✅ Step 6: UI state updated to anxiety specialist
[triageAI][handoff-v2] 🎉 SEAMLESS HANDOFF COMPLETED SUCCESSFULLY
```

### **Audio Verification**
- User hears complete triage AI transition message
- No audio interruption or silence gaps
- AI immediately responds with specialized expertise and contextual understanding
- AI asks relevant follow-up question based on their specialized knowledge
- WebRTC connection status remains "connected" throughout

### **Database Verification**
```sql
-- Check specialist tracking
SELECT current_specialist, specialist_history 
FROM conversations 
WHERE id = 'conversation_id';

-- Check context preservation
SELECT routing_metadata->>'context_summary'
FROM messages 
WHERE conversation_id = 'conversation_id'
AND routing_metadata->>'type' = 'session_end';
```

## Implementation Notes

### **Audio Completion Integration**
- Existing `output_audio_buffer.stopped` detection used
- Handoff only proceeds after AI finishes speaking
- No additional volume monitoring required

### **Function State Management**
- Complete function registry replacement
- No function state pollution between AIs
- Clean specialist function loading

### **Voice Consistency**
- All AIs use same voice settings from `AI_DEFAULTS`
- No voice change messaging in AI prompts
- Simplified audio configuration

### **Database Schema Fixes Applied**
- Fixed table references: `prompts` → `ai_prompts`
- Fixed column references: `prompt_category` → `prompt_type`
- Fixed function loading: separate `functions` table → `ai_prompts.functions` column

## Future Enhancements

1. Move `AI_DEFAULTS` to Supabase configuration tables
2. Add expertise-specific voice settings (if needed)
3. Implement expertise shift analytics and metrics
4. Add expertise shift speed optimization
5. Support for multi-step expertise chains

The unified persona expertise shift system provides a seamless single-AI experience for users while maintaining complete AI functionality and context preservation.