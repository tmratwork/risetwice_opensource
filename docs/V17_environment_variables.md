# V17 Environment Variables - Complete Tool Migration

## Overview

V17 requires environment variables for ElevenLabs agent configuration, webhook security, database connections, and June 2025 tool architecture with response-aware capabilities.

## Required Environment Variables for V17 Tool Migration

Add these to your `.env.local` file:

```bash
# V17 ElevenLabs Agent Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id_here

# V17 Webhook Security (CRITICAL - Required for tool calls)
ELEVENLABS_WEBHOOK_TOKEN=your_secure_webhook_token_here

# V17 Webhook URL Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# V17 Logging (Optional - for debugging)
NEXT_PUBLIC_ENABLE_V17_LOGS=true

# Database Configuration (Shared with V16)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pinecone Configuration (For knowledge base searches)
PINECONE_API_KEY=your_pinecone_key

# Optional: Additional V16 logging (can coexist)
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=false
NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS=false
```

## New V17 Variables Explained

### `ELEVENLABS_WEBHOOK_TOKEN` ⚠️ CRITICAL
- **Purpose**: Secures webhook calls from ElevenLabs agent to your server
- **Usage**: Bearer token authentication for `/api/v17/tools/webhook`
- **Security**: Keep secret - never expose to client code
- **Format**: Any secure random string (e.g., `webhook_secure_token_abc123`)
- **Required**: YES - without this, tool calls won't work

### `NEXT_PUBLIC_APP_URL` 
- **Purpose**: Base URL for webhook configuration
- **Usage**: Tells ElevenLabs agent where to call your webhooks
- **Development**: `http://localhost:3000`
- **Production**: Automatically uses Vercel URL or your custom domain
- **Required**: YES for development

## Production Environment Setup

For production deployment (Vercel/other hosting):

```bash
# Production webhook configuration
NEXT_PUBLIC_APP_URL=https://yourdomain.com
# OR leave empty to use Vercel's automatic URL

# Same authentication variables
ELEVENLABS_WEBHOOK_TOKEN=your_secure_webhook_token_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id_here

# Database and other services
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PINECONE_API_KEY=your_pinecone_key
```

## V17 Tool Migration Architecture

The environment variables support this flow:

1. **Agent Configuration**: `ELEVENLABS_API_KEY` + `AGENT_ID` configure the agent
2. **Webhook Setup**: `APP_URL` + `WEBHOOK_TOKEN` secure tool execution  
3. **Database Access**: `SUPABASE_*` variables load function definitions
4. **Content Search**: `PINECONE_API_KEY` enables therapeutic content queries

## Security Model

### Server-Side Secrets (Never exposed):
- `ELEVENLABS_API_KEY` - API authentication
- `ELEVENLABS_WEBHOOK_TOKEN` - Webhook security  
- `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `PINECONE_API_KEY` - Vector search

### Client-Side Variables (Public):
- `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` - Agent identifier
- `NEXT_PUBLIC_APP_URL` - Base URL for configuration
- `NEXT_PUBLIC_ENABLE_V17_LOGS` - Debug logging

## Webhook Security Flow

```
ElevenLabs Agent → POST {APP_URL}/api/v17/tools/webhook
Headers: Authorization: Bearer {WEBHOOK_TOKEN}
↓
Webhook authenticates request
↓  
Function executes with Supabase/Pinecone access
↓
June 2025 enhanced response returned
```

## Testing V17 Tool Migration

### 1. Configure Environment
```bash
# .env.local
ELEVENLABS_API_KEY=your_api_key
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id  
ELEVENLABS_WEBHOOK_TOKEN=test_webhook_token_123
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

### 2. Configure Agent
```bash
curl -X POST http://localhost:3000/api/v17/agents/create \
-H "Content-Type: application/json" \
-d '{"specialistType": "triage"}'
```

### 3. Verify Setup
- Check logs for "6 tools configured"
- Verify webhook URL: `http://localhost:3000/api/v17/tools/webhook`
- Test authentication with agent calls

## Migration Checklist

- [ ] Add `ELEVENLABS_WEBHOOK_TOKEN` to environment
- [ ] Set `NEXT_PUBLIC_APP_URL` for development  
- [ ] Configure production URLs for deployment
- [ ] Run agent configuration API
- [ ] Test tool calls with V17 logging enabled
- [ ] Verify webhook authentication working
- [ ] Test all 16 therapeutic functions

The V17 tool migration is complete and ready for testing with proper environment configuration!