# V17 ElevenLabs Environment Setup

## ✅ Already Configured



## 🔧 Optional V17 Variables to Add

Add these to your existing `.env.local` for enhanced V17 functionality:

```bash

# Webhook Security (optional for production)
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_for_signature_validation



# Knowledge Base Configuration (optional - has sensible defaults)
ELEVENLABS_EMBEDDING_MODEL=e5_mistral_7b_instruct
ELEVENLABS_MAX_CHUNKS=5
ELEVENLABS_SIMILARITY_THRESHOLD=0.7
```


**To test V17 now:**
1. Add V17 logging: `NEXT_PUBLIC_ENABLE_V17_LOGS=true` to `.env.local`
2. Run the database migrations (see `docs/v17_database_schema.sql`)
3. Visit `http://localhost:3000/chatbotV17`
4. Click "Let's Talk" and test the ElevenLabs conversation

## 🔧 How Your Credentials Were Obtained (Reference)

Your existing credentials suggest you already:
1. ✅ Created an ElevenLabs account
2. ✅ Got your API key from the dashboard  
3. ✅ Created an agent (ID: `agent_9001k4eazm2fffhapyz1z0ewyd77`)

The V17 implementation will:
- Use your existing agent or create new specialists automatically
- Pull AI instructions from your Supabase `ai_prompts` table (same as V16)
- Set up webhook functions for resource search and handoffs

## Voice Configuration Options

### Popular Voice Options:
```bash
# Professional voices
NEXT_PUBLIC_ELEVENLABS_DEFAULT_VOICE_ID=pNInz6obpgDQGcFmaJgB  # Adam (male, professional)
NEXT_PUBLIC_ELEVENLABS_DEFAULT_VOICE_ID=EXAVITQu4vr4xnSDxMaL  # Sarah (female, professional)

# Calm/therapeutic voices  
NEXT_PUBLIC_ELEVENLABS_DEFAULT_VOICE_ID=AZnzlk1XvdvUeBnXmlld  # Domi (female, warm)
NEXT_PUBLIC_ELEVENLABS_DEFAULT_VOICE_ID=VR6AewLTigWG4xSOukaG  # Arnold (male, calm)
```

### Voice Model Options:
```bash
NEXT_PUBLIC_ELEVENLABS_VOICE_MODEL=eleven_turbo_v2_5      # Fastest, good quality
NEXT_PUBLIC_ELEVENLABS_VOICE_MODEL=eleven_multilingual_v2  # Multiple languages
NEXT_PUBLIC_ELEVENLABS_VOICE_MODEL=eleven_monolingual_v1   # English only, highest quality
```

## Security Best Practices

### API Key Security
- Never commit API keys to version control
- Use environment variables only
- Rotate keys regularly
- Monitor usage in ElevenLabs dashboard

### Webhook Security
```bash
# Set up webhook signature validation
ELEVENLABS_WEBHOOK_SECRET=your-secure-random-string-here
```

### Domain Allowlisting
```bash
# Restrict which domains can use your agents
NEXT_PUBLIC_ELEVENLABS_ALLOWLIST_DOMAINS=localhost:3000,yourdomain.com,*.vercel.app
```

## Testing Configuration

### 1. Test API Connection
```bash
curl -X GET "https://api.elevenlabs.io/v1/user" \
  -H "xi-api-key: YOUR_API_KEY"
```

### 2. Test Agent Creation
```bash
curl -X POST "http://localhost:3000/api/v17/agents/create" \
  -H "Content-Type: application/json" \
  -d '{"specialistType": "triage"}'
```

### 3. Test Knowledge Base Upload
```bash
curl -X POST "http://localhost:3000/api/v17/knowledge-base/upload" \
  -H "Content-Type: application/json" \
  -d '{
    "googleDocUrl": "https://docs.google.com/document/d/your-doc-id",
    "documentName": "Test Knowledge Base",
    "specialistType": "triage"
  }'
```

### 4. Test Webhook Function
```bash
curl -X POST "http://localhost:3000/api/v17/tools/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "function_name": "search_knowledge_base",
    "parameters": {
      "query": "mental health resources"
    }
  }'
```

## Common Configuration Issues

### 1. Invalid API Key
**Error**: `Authentication failed`
**Solution**: Check API key format and permissions

### 2. Agent Not Found  
**Error**: `Agent ID not found`
**Solution**: Verify agent exists in ElevenLabs dashboard

### 3. Webhook Timeout
**Error**: `Webhook request timeout`
**Solution**: Check webhook URL accessibility and response time

### 4. Voice Not Available
**Error**: `Voice ID not found`
**Solution**: Use voice library API to get available voices:
```bash
curl -X GET "https://api.elevenlabs.io/v1/voices" \
  -H "xi-api-key: YOUR_API_KEY"
```

## Development vs Production

### Development Setup
```bash
ELEVENLABS_API_KEY=your_dev_api_key
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=dev_agent_id
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

### Production Setup
```bash
ELEVENLABS_API_KEY=your_prod_api_key
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=prod_agent_id
NEXT_PUBLIC_ENABLE_V17_LOGS=false
ELEVENLABS_WEBHOOK_SECRET=strong-production-secret
```

## Cost Management

### Free Tier Limits
- 10,000 characters per month
- 3 custom voices
- Basic features only

### Paid Tiers
- **Starter**: $5/month - 30,000 characters
- **Creator**: $22/month - 100,000 characters  
- **Pro**: $99/month - 500,000 characters
- **Scale**: $330/month - 2,000,000 characters

### Usage Monitoring
```bash
# Check usage via API
curl -X GET "https://api.elevenlabs.io/v1/user/subscription" \
  -H "xi-api-key: YOUR_API_KEY"
```

## Support Resources

- [ElevenLabs Documentation](https://docs.elevenlabs.io/)
- [Conversational AI Guide](https://docs.elevenlabs.io/conversational-ai)
- [API Reference](https://docs.elevenlabs.io/api-reference)
- [Community Discord](https://discord.gg/elevenlabs)