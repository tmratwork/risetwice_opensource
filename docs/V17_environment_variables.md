# V17 Environment Variables

## Required Environment Variables for V17 Eleven Labs Integration

Add these to your `.env.local` file:

```bash
# V17 Eleven Labs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id_here

# V17 Logging (Optional - for debugging)
NEXT_PUBLIC_ENABLE_V17_LOGS=true

# Existing variables (V16 and earlier still work)
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=false
NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS=false
```

## How to Get Eleven Labs Credentials

1. **API Key**: 
   - Go to https://elevenlabs.io
   - Sign up or log in
   - Navigate to Profile Settings
   - Copy your `xi-api-key`

2. **Agent ID**:
   - Go to Eleven Labs Conversational AI section
   - Create or select an agent
   - Copy the agent ID from the URL or agent settings

## Environment Variable Details

### `ELEVENLABS_API_KEY`
- **Purpose**: Server-side authentication with Eleven Labs API
- **Usage**: Used in `/api/v17/signed-url` to generate signed URLs
- **Security**: Never exposed to client-side code
- **Required**: Yes

### `NEXT_PUBLIC_ELEVENLABS_AGENT_ID`
- **Purpose**: Identifies which Eleven Labs agent to use for conversations
- **Usage**: Used in V17 conversation initialization
- **Security**: Public (included in client bundle)
- **Required**: Yes

### `NEXT_PUBLIC_ENABLE_V17_LOGS`
- **Purpose**: Enable detailed V17 debugging logs
- **Usage**: Controls logging in V17 store, hooks, and components
- **Values**: `'true'` or `'false'` (string)
- **Required**: No (defaults to disabled)

## Security Notes

- Keep `ELEVENLABS_API_KEY` secret - never commit to version control
- `NEXT_PUBLIC_*` variables are included in the client bundle and visible to users
- Only put sensitive data in server-side variables (without `NEXT_PUBLIC_`)

## Testing Configuration

For testing V17, use this minimal configuration:

```bash
# .env.local
ELEVENLABS_API_KEY=sk_your_actual_api_key_here
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_actual_agent_id_here
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

## Verify Configuration

After adding environment variables:

1. Restart your development server: `npm run dev`
2. Visit `http://localhost:3000/chatbotV17`
3. Check browser console for V17 initialization logs
4. Ensure no "Missing environment variable" errors appear