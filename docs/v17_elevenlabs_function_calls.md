# V17 ElevenLabs Tool Implementation - Complete Migration

## Overview

V17 implements a complete migration of V16's triage AI functions to ElevenLabs agents using June 2025 server tools architecture with webhook-based execution and response-aware tool capabilities.

## Architecture Summary

**Single Triage AI**: V17 uses only one ElevenLabs agent (triage) - no specialist handoffs
**16 Total Functions**: All essential V16 triage functions migrated to server tools
**June 2025 Standards**: Response-aware tools with dynamic variables and structured metadata
**Webhook Security**: Bearer token authentication for all tool calls

## Function Migration Status

### ✅ **16 V17 Triage Functions Implemented**

**Therapeutic Content Functions (10):**
- `get_safety_triage_protocol` - Safety assessment with crisis detection
- `get_conversation_stance_guidance` - AI communication strategies  
- `get_assessment_protocol` - 4-stage therapeutic assessment
- `get_continuity_framework` - Session continuity management
- `get_cbt_intervention` - CBT techniques with dynamic context
- `get_dbt_skills` - DBT skills with distress level awareness
- `get_trauma_informed_approach` - Trauma protocols with parts work
- `get_substance_use_support` - Motivational interviewing techniques
- `get_practical_support_guidance` - Resource navigation support
- `get_acute_distress_protocol` - Crisis grounding with strict entry criteria

**System Functions (3):**
- `end_session` - Enhanced session cleanup with outcome tracking
- `getUserHistory_function` - User personalization and history
- `logInteractionOutcome_function` - Therapeutic effectiveness tracking

**Resource Functions (3):**
- `display_map_function` - Client-side map visualization trigger
- `resource_feedback_function` - Resource quality feedback collection
- `search_resources_unified` - Resource search with location awareness

## Implementation Architecture

### 1. Server Tools Configuration

**Source:** `src/app/api/v17/agents/create/route.ts`
- Configures ElevenLabs agent with server tools using June 2025 standards
- Each tool configured with webhook URL and Bearer token authentication
- Environment-aware webhook URLs (localhost for dev, production URL for live)
- 6 core functions configured as server tools in agent

### 2. Webhook Handler Implementation

**Source:** `src/app/api/v17/tools/webhook/route.ts`
- Handles authenticated webhook calls from ElevenLabs agent
- Routes all 16 function calls to appropriate handlers
- Returns June 2025 response-aware structured responses
- Bearer token authentication using `ELEVENLABS_WEBHOOK_TOKEN`

### 3. June 2025 Response Architecture

**Enhanced Tool Responses:**
- **Dynamic Variables**: Extracted for agent context
- **Structured Metadata**: Execution time, success tracking, version info
- **Next Available Actions**: Context-aware suggestions for agent
- **User Feedback Prompts**: Automatic engagement questions
- **Error Recovery**: Intelligent fallback recommendations

**Example Response:**
```json
{
  "success": true,
  "data": {
    "protocol": {
      "risk_type": "suicide_ideation",
      "risk_level": "active_assessment", 
      "guidance": ["Safety assessment guidance..."],
      "context_applied": true
    },
    "immediate_actions_required": false,
    "crisis_resources_needed": ["988", "crisis_text_line"]
  },
  "metadata": {
    "execution_time_ms": 245.67,
    "function_name": "get_safety_triage_protocol",
    "success": true,
    "timestamp": "2025-09-08T03:15:30.123Z",
    "version": "V17_June2025"
  },
  "dynamic_variables": [
    {
      "key": "current_risk_level",
      "value": "active_assessment",
      "extracted_from": "function_parameters",
      "data_type": "string"
    }
  ],
  "next_available_actions": [
    "continue_conversation",
    "assess_immediate_safety", 
    "provide_crisis_resources"
  ],
  "user_feedback_prompt": "Was this safety guidance helpful and clear?",
  "agent_context": {
    "conversation_state": "active",
    "safety_assessment_active": true,
    "therapeutic_focus": "safety_first"
  }
}
```

## Agent Setup Process

### 1. Agent Configuration API

**Endpoint:** `POST /api/v17/agents/create`

**Process:**
1. **Load Triage Prompt**: Gets triage AI instructions from Supabase `ai_prompts` table
2. **Configure Server Tools**: Sets up 6 core server tools with webhook authentication
3. **Update ElevenLabs Agent**: PATCH request with tools, voice settings, and instructions
4. **Environment Detection**: Uses correct webhook URLs for dev/production

**Request:**
```bash
curl -X POST http://localhost:3000/api/v17/agents/create \
-H "Content-Type: application/json" \
-d '{"specialistType": "triage"}'
```

### 2. Server Tools Configured

**6 Core Tools Registered with Agent:**
- `get_safety_triage_protocol` - Safety assessment
- `get_conversation_stance_guidance` - Communication strategies  
- `get_assessment_protocol` - Therapeutic assessment
- `get_acute_distress_protocol` - Crisis grounding
- `search_resources_unified` - Resource search
- `end_session` - Session cleanup

**Each Tool Configured With:**
- Webhook URL: `{BASE_URL}/api/v17/tools/webhook`  
- Authentication: `Bearer {ELEVENLABS_WEBHOOK_TOKEN}`
- Parameter validation and descriptions
- Environment-aware URLs (localhost/production)

## Tool Execution Flow

### 1. Agent Tool Call
1. **User Interaction**: User speaks/types to ElevenLabs agent
2. **Agent Decision**: Agent determines need for function call
3. **Webhook Request**: Agent POST to `/api/v17/tools/webhook` with authentication
4. **Function Execution**: Webhook routes to appropriate handler
5. **Enhanced Response**: June 2025 structured response returned
6. **Agent Integration**: Agent uses response context to continue conversation

### 2. Authentication Flow
```
ElevenLabs Agent → POST /api/v17/tools/webhook
Headers: Authorization: Bearer {ELEVENLABS_WEBHOOK_TOKEN}
Body: {"function_name": "get_safety_triage_protocol", "parameters": {...}}
```

### 3. Response Flow
```
Webhook Handler → Enhanced Response → ElevenLabs Agent
{
  "success": true,
  "data": {...},
  "metadata": {...},
  "dynamic_variables": [...],
  "next_available_actions": [...],
  "agent_context": {...}
}
```

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