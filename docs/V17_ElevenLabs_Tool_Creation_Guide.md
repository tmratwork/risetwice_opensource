# ElevenLabs Tool Creation and Update Guide

## Overview
This document explains how to create and update webhook tools for ElevenLabs Conversational AI based on discoveries from V17 implementation. The ElevenLabs API has specific validation requirements that must be followed exactly.

## Key Discoveries

### 1. API Format Changes (Post-July 2025)
- **Old format**: `tools` array in agent configuration (deprecated)
- **New format**: `tool_ids` array with separately created tools
- **Process**: Create tools first via `/v1/convai/tools`, then reference by ID in agent config

### 2. Critical Schema Requirements

#### Working Tool Creation Format
```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/tools" \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_config": {
      "type": "webhook",
      "name": "tool_name",
      "description": "Tool description",
      "webhook": {
        "url": "https://your-domain.com/api/webhook",
        "method": "POST"
      },
      "api_schema": {
        "url": "https://your-domain.com/api/webhook"
      }
    }
  }'
```

#### Working Tool Update Format
```bash
curl -X PATCH "https://api.elevenlabs.io/v1/convai/tools/TOOL_ID" \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_config": {
      "type": "webhook",
      "name": "tool_name",
      "description": "Tool description",
      "api_schema": {
        "url": "https://your-domain.com/api/webhook",
        "method": "POST",
        "request_body_schema": {
          "type": "object",
          "properties": {
            "param1": {
              "type": "string",
              "description": "Parameter description"
            }
          },
          "required": ["param1"]
        }
      },
      "assignments": [
        {
          "assignment_type": "header",
          "key": "Authorization",
          "value": "Bearer YOUR_TOKEN",
          "dynamic_variable": "",
          "value_path": "value"
        }
      ]
    }
  }'
```

## Step-by-Step Process

### Step 1: Create Tool (Basic)
1. **Create tool with minimal schema** - this establishes the tool
2. **POST method will be converted to GET** - this is expected initially
3. **Parameters will be stripped** - this is expected initially

### Step 2: Update Tool (Full Configuration)
1. **Use PATCH endpoint** to update the created tool
2. **Must include `request_body_schema`** for POST method
3. **Must include proper `assignments`** for authentication

### Step 3: Authentication Headers
- **assignment_type**: `"header"`
- **key**: `"Authorization"`
- **value**: `"Bearer YOUR_TOKEN"`
- **dynamic_variable**: `""` (empty string)
- **value_path**: `"value"` ⚠️ **CRITICAL** - must be exactly "value"

## Common Validation Errors and Solutions

### Error: "Field required: dynamic_variable"
**Solution**: Add `"dynamic_variable": ""` to assignments

### Error: "Field required: value_path"
**Solution**: Add `"value_path": "value"` to assignments

### Error: "value_path cannot be empty"
**Solution**: Use `"value_path": "value"` (not empty string)

### Error: "POST method requires request_body_schema"
**Solution**: Include complete request_body_schema in api_schema

### Error: "Unable to extract tag using discriminator 'type'"
**Solution**: Ensure `"type": "webhook"` is at tool_config root level

## Production vs Development URLs

⚠️ **CRITICAL**: ElevenLabs cannot reach localhost URLs

- ❌ **Wrong**: `http://localhost:3000/api/webhook`
- ✅ **Correct**: `https://your-production-domain.com/api/webhook`

## Complete Working Example

### V17 Safety Triage Protocol Tool
```json
{
  "tool_config": {
    "type": "webhook",
    "name": "get_safety_triage_protocol",
    "description": "Retrieve safety assessment procedures and crisis protocols for immediate risk situations",
    "api_schema": {
      "url": "https://r2ai.me/api/v17/tools/webhook",
      "method": "POST",
      "request_body_schema": {
        "type": "object",
        "properties": {
          "risk_type": {
            "type": "string",
            "description": "Type of safety concern detected"
          },
          "risk_level": {
            "type": "string",
            "description": "Level of risk assessment needed"
          },
          "session_context": {
            "type": "string",
            "description": "Current conversation context"
          }
        },
        "required": ["risk_type", "risk_level"]
      }
    },
    "assignments": [
      {
        "assignment_type": "header",
        "key": "Authorization",
        "value": "Bearer 7896ef50e8ed9c97ca3a6669c46e4889adc256e12829d32f92056b7f5c088469",
        "dynamic_variable": "",
        "value_path": "value"
      }
    ]
  }
}
```

### Expected Successful Response
```json
{
  "id": "tool_5401k4kyv4ztexw95bsra3ctfm12",
  "tool_config": {
    "type": "webhook",
    "name": "get_safety_triage_protocol",
    "api_schema": {
      "url": "https://r2ai.me/api/v17/tools/webhook",
      "method": "POST",
      "request_body_schema": {
        "type": "object",
        "required": ["risk_type", "risk_level"],
        "properties": {
          "risk_type": {
            "type": "string",
            "description": "Type of safety concern detected",
            "dynamic_variable": "",
            "constant_value": ""
          },
          "risk_level": {
            "type": "string",
            "description": "Level of risk assessment needed",
            "dynamic_variable": "",
            "constant_value": ""
          }
        }
      }
    },
    "assignments": [
      {
        "source": "response",
        "dynamic_variable": "",
        "value_path": "value"
      }
    ]
  }
}
```

## Agent Configuration Update

After creating tools, update agent with tool IDs:

```json
{
  "conversation_config": {
    "agent": {
      "prompt": {
        "prompt": "Agent instructions...",
        "first_message": "Hello! How can I help?",
        "tool_ids": ["tool_id_1", "tool_id_2", "tool_id_3"]
      }
    },
    "tts": {
      "voice_id": "voice_id",
      "model_id": "eleven_turbo_v2"
    }
  }
}
```

## Troubleshooting Tips

1. **Always test with production URLs** - localhost will fail
2. **Create first, then update** - don't try to set everything in creation
3. **Include all required fields** - missing fields cause validation errors
4. **Use exact field names** - API is case-sensitive
5. **Check response for actual configuration** - API may modify your input

## Tool Management

### List All Tools
```bash
curl -X GET "https://api.elevenlabs.io/v1/convai/tools" \
  -H "xi-api-key: YOUR_API_KEY"
```

### Get Specific Tool
```bash
curl -X GET "https://api.elevenlabs.io/v1/convai/tools/TOOL_ID" \
  -H "xi-api-key: YOUR_API_KEY"
```

### Delete Tool
```bash
curl -X DELETE "https://api.elevenlabs.io/v1/convai/tools/TOOL_ID" \
  -H "xi-api-key: YOUR_API_KEY"
```

## Implementation Notes

- **Authentication**: Tools created successfully require Bearer token in assignments
- **Schema validation**: Very strict - follow exact format
- **Parameter handling**: ElevenLabs passes parameters to webhook as JSON body
- **Response format**: Follow ElevenLabs response schema for proper agent integration
- **Error handling**: Implement proper error responses in webhook handler

This guide represents hard-won knowledge from systematic testing of the ElevenLabs Conversational AI tools API.