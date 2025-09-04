# Guide: Adding New AI Functions

## Overview

Adding new functions that AI models can call requires updates in **THREE critical locations**. Missing any one will cause runtime failures even if the AI can see the function.

## The Three-Step Process

### Step 1: Implementation
**File:** `/src/hooksV16/use-mental-health-functions-v16.ts`

Add your function implementation:
```typescript
const getYourNewFunction = useCallback(async (params: {
  param1: string;
  param2?: string;
}) => {
  try {
    // Your implementation here
    return {
      success: true,
      data: { /* your data */ }
    };
  } catch (error) {
    return {
      success: false,
      error: `Error: ${error.message}`
    };
  }
}, [/* dependencies */]);
```

Also add to the `functionRegistry` object at the bottom of the file:
```typescript
'your_new_function': wrapFunctionWithEvents(
  async (args: unknown) => getYourNewFunction(args as Parameters<typeof getYourNewFunction>[0]),
  'your_new_function'
),
```

### Step 2: Router Registration
**File:** `/src/hooksV16/use-supabase-functions.ts`

Add a case in the `executeFunctionImplementation` switch statement:
```typescript
case 'your_new_function':
  return await mentalHealthFunctions.getYourNewFunction(
    args as Parameters<typeof mentalHealthFunctions.getYourNewFunction>[0]
  );
```

### Step 3: Function Definition in Supabase
**Location:** Supabase `ai_prompts` table

Add the function definition to the appropriate AI type's functions array:
```json
{
  "name": "your_new_function",
  "type": "function",
  "description": "Clear description of what this function does",
  "parameters": {
    "type": "object",
    "properties": {
      "param1": {
        "type": "string",
        "description": "What this parameter is for"
      },
      "param2": {
        "type": "string",
        "description": "Optional parameter description"
      }
    },
    "required": ["param1"]
  }
}
```

## Common Pitfalls

### 1. Missing Router Registration
**Symptom:** "Unknown function [name] called" error even though AI calls it
**Cause:** Function exists but isn't in the switch statement
**Fix:** Add case to `executeFunctionImplementation`

### 2. Parameter Mismatch
**Symptom:** Function executes but fails with parameter errors
**Common Issues:**
- API endpoints may require additional parameters (like `book` ID)
- Type casting issues between AI call and implementation

### 3. Function Not in Registry
**Symptom:** Function not available to AI
**Cause:** Not added to `functionRegistry` object
**Fix:** Add to both implementation and registry

### 4. Namespace/Context Issues
**Symptom:** Function works but returns no/wrong data
**Common Issues:**
- Hardcoded namespaces that should be dynamic
- Missing context (user ID, conversation ID, book ID)

## Testing Checklist

Before considering a function complete:

- [ ] Function implementation added to `use-mental-health-functions-v16.ts`
- [ ] Function added to `functionRegistry` object
- [ ] Case added to router switch statement in `use-supabase-functions.ts`
- [ ] Function definition added to Supabase `ai_prompts` table
- [ ] Test: AI can see the function (check logs for available functions)
- [ ] Test: AI can call the function without errors
- [ ] Test: Function returns expected data
- [ ] Test: Error cases handled gracefully

## Debugging Tips

### Enable Logging
Set these environment variables in `.env.local`:
```bash
NEXT_PUBLIC_ENABLE_FUNCTION_EXECUTION_LOGS=true
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=true
```

### Check Function Availability
Look for this log line to see what functions AI has:
```
[FUNCTION-CALL] Available functions in registry: Array(17) [...]
```

### Trace Function Execution
Follow these log patterns:
1. `[functionCallDiagnosis] ===== AI CALLING FUNCTION =====`
2. `[FUNCTION-CALL] Function [name] found in registry, executing...`
3. `[FUNCTION-CALL] Function [name] execution result:`

## Architecture Context

The system uses a three-layer architecture:

1. **Function Definitions** (metadata) - What the AI sees
2. **Function Router** (switch statement) - Maps names to implementations  
3. **Function Implementations** (actual code) - The business logic

All three must be synchronized for functions to work.

## Related Files

- `/src/config/ai-models.ts` - AI model configurations
- `/src/stores/webrtc-store.ts` - WebRTC store that calls functions
- `/docs/logging_method.md` - Logging standards for debugging
- `/CLAUDE.md` - Overall development guidelines

## Historical Context

This multi-step process exists because:
- Functions come from different sources (Supabase, local implementations)
- The AI only receives function metadata, not implementations
- The router provides a centralized place for parameter mapping and error handling

## Version Notes

- **V16**: Functions loaded from Supabase, routed through `use-supabase-functions.ts`
- **V15**: Used hardcoded function hooks
- **Future**: Consider automating router generation from implementations