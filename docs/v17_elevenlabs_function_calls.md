# V17 ElevenLabs Function Calls/Tool Calls Implementation

## Overview

V17 implements function/tool calls for ElevenLabs AI agents using a hybrid approach combining database-driven function definitions with webhook-based execution.

## Architecture

### 1. Function Definition Loading

**Source:** `src/hooksV17/use-supabase-functions.ts`
- Functions are loaded from Supabase `ai_prompts` table
- Each specialist type (triage, anxiety, depression) has specific functions
- Universal functions can be merged with specialist-specific functions
- Uses RLS-compliant RPC function `get_ai_prompt_by_type`

**Key Features:**
- AI-specific functions: Loaded per specialist type
- Universal functions: Shared across all specialists (when merge enabled)
- Database-driven: No hardcoded function definitions
- Type safety: Full TypeScript interface definitions

### 2. Function Registration Hook

**Source:** `src/hooksV17/use-function-registration.ts`
- Manages function loading and registration lifecycle
- Auto-loads functions when AI specialist changes
- Provides both function definitions (for AI) and implementations (for execution)
- Integration with V16 mental health functions for compatibility

**Return Interface:**
```typescript
{
  registeredFunctions: unknown[];
  functionDefinitions: SupabaseFunctionDefinition[];
  functionRegistry: SupabaseFunctionRegistry;
  loadFunctionsForAI: (aiType: string) => Promise<SupabaseFunctionDefinition[]>;
  isLoading: boolean;
  error: string | null;
}
```

### 3. Webhook-Based Function Execution

**Source:** `src/app/api/v17/tools/webhook/route.ts`
- Handles function calls from ElevenLabs agents via POST webhooks
- Routes function calls to appropriate handlers
- Returns structured JSON responses for the AI agent

**Supported Functions:**
- `search_knowledge_base` - Pinecone knowledge base search
- `search_resources_unified` / `resource_search_function` - Resource database search
- `trigger_specialist_handoff` - Specialist handoff management
- `crisis_response_function` - Crisis intervention resources
- `get_user_location` - Client-side location requests

**Request Format:**
```json
{
  "function_name": "search_knowledge_base",
  "parameters": {
    "query": "anxiety coping strategies"
  }
}
```

**Response Format:**
```json
{
  "success": true,
  "results": [...],
  "summary": "Found 5 relevant documents for: anxiety coping strategies"
}
```

## Agent Configuration

### Agent Creation/Update

**Source:** `src/app/api/v17/agents/create/route.ts`
- Updates existing ElevenLabs agent with Supabase instructions
- Configures voice settings and AI prompts
- Verifies agent configuration post-update

**Configuration Process:**
1. Load AI instructions from Supabase `ai_prompts` table
2. Configure voice settings (model, stability, etc.)
3. Update ElevenLabs agent via PATCH API
4. Verify configuration matches expected values

### Session Management

**Source:** `src/app/api/v17/start-session/route.ts`
- Loads specialist-specific prompts
- Enhances prompts with context and user memory
- Updates conversation tracking in database
- Returns session configuration for ElevenLabs

**Enhanced Prompt Features:**
- Context summary integration from triage handoffs
- User memory enhancement from profile data
- Session reset instructions for specialist transitions
- V17-specific metadata tracking

## ElevenLabs Integration

### Conversation Hook

**Source:** `src/hooksV17/use-elevenlabs-conversation.ts`
- Manages ElevenLabs conversation lifecycle
- Handles microphone control and audio settings
- Integrates with function registration system

**Current Limitations:**
- Client-side tool registration disabled (SDK limitation)
- Functions executed via webhooks instead of direct SDK calls
- Comment: "registerTool is not available in current SDK"

### Function Flow

1. **Load Functions:** `useFunctionRegistration` loads from Supabase
2. **Configure Agent:** Functions included in agent prompt context
3. **Execute Calls:** ElevenLabs calls webhook endpoint with function data
4. **Process Response:** Webhook returns structured data to agent
5. **Continue Conversation:** Agent uses response in ongoing dialogue

## Database Schema Dependencies

### Required Tables:
- `ai_prompts` - Function definitions and AI instructions
- `specialist_handoffs` - Handoff tracking
- `conversations` - Session and specialist tracking
- `user_profiles` - User memory/context data
- `crisis_resources` - Crisis intervention data

### Required RPC Functions:
- `get_ai_prompt_by_type` - Load prompts with RLS compliance
- `get_latest_context_summary_for_conversation` - Context retrieval

## Configuration Requirements

### Environment Variables:
```bash
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_api_key
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pinecone Configuration (for knowledge base)
PINECONE_API_KEY=your_pinecone_key

# Logging
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

### Voice Configuration:
```typescript
{
  voice_id: "EmtkmiOFoQVpKRVpXH2B", // Default V17 voice
  model_id: "eleven_turbo_v2",
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true
}
```

## Implementation Status

### ✅ Implemented:
- Database-driven function loading
- Webhook-based function execution  
- Agent configuration and updates
- Session management with context enhancement
- Specialist handoff support
- Crisis response functions
- Knowledge base search integration

### ❌ Not Implemented/Disabled:
- Client-side SDK tool registration
- Direct function calls via ElevenLabs SDK
- Embedding generation (placeholder in webhook)

### ⚠️ Limitations:
- Functions must be executed via webhooks (slower than direct calls)
- No real-time function call feedback during conversation
- Embedding generation requires V16 integration
- Client-side location functions need separate registration

## Future Enhancements

### Potential Improvements:
1. **SDK Tool Registration:** When ElevenLabs SDK supports `registerTool`
2. **Real-time Functions:** Direct function calls during conversation
3. **Embedding Integration:** Complete knowledge base search implementation
4. **Enhanced Error Handling:** Better webhook error responses
5. **Function Metrics:** Track function usage and performance
6. **Dynamic Function Loading:** Runtime function registration based on conversation context

## Notes

- V17 maintains compatibility with V16 mental health functions
- All function definitions stored in database (no hardcoded functions)
- Webhook approach provides flexibility but adds latency
- Function execution includes comprehensive logging when enabled
- Agent verification ensures configuration consistency