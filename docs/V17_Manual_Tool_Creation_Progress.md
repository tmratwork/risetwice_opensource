# V17 Manual Tool Creation Progress

## Overview
We are manually creating V17 tools via the ElevenLabs UI after all programmatic approaches failed. This document tracks our progress and explains why manual creation became necessary.

## Why Manual Creation is Required

### Programmatic Attempts - All Failed with 422 Validation Errors

We systematically tested **9 different webhook tool creation formats** via POST `/v1/convai/tools`:

#### Original 5 Formats (Based on Error Analysis):
1. **Flat Structure** - `{"tool_config": {"type": "webhook", "name": "...", "url": "...", "parameters": {...}}}`
2. **Nested Webhook** - `{"tool_config": {"type": "webhook", "webhook": {"url": "...", "method": "POST"}, "parameters": {...}}}`
3. **API Schema** - `{"tool_config": {"type": "webhook", "api_schema": {"type": "object", "properties": {...}}}}`
4. **OpenAPI Style** - `{"tool_config": {"type": "webhook", "webhook_config": {"schema": {...}}}}`
5. **Direct API Schema** - `{"tool_config": {"type": "webhook", "webhook": {"api_schema": {...}}}}`

#### WebAI-Suggested Formats (Based on Discriminator Insights):
6. **Server Discriminator** - `{"tool_config": {"type": "server", "api_schema": {...}}}`
7. **Tool Type Discriminator** - `{"tool_config": {"tool_type": "webhook", "parameters": {...}}}`
8. **Nested Configuration** - `{"tool_config": {"type": "server", "config": {"webhook": {...}}}}`
9. **Server with Parameters** - `{"tool_config": {"type": "server", "parameters": {...}}}`

### Consistent Error Patterns:
- **Discriminator Error**: `"Unable to extract tag using discriminator 'type'"`
- **Missing Field Error**: `"Field required","loc":["body","tool_config","webhook","api_schema"]"`
- **All formats failed with 422 validation errors**

### Root Cause Analysis:
- ElevenLabs deprecated `tools` array format after July 16, 2025
- New programmatic tools API has incomplete/incorrect documentation
- WebAI research confirmed lack of working examples for June 2025+ API changes
- The exact webhook tool creation schema remains undocumented

## Manual Creation Process

### Tools to Create (6 Total):
1. `get_safety_triage_protocol` - Safety assessment procedures and crisis protocols
2. `get_conversation_stance_guidance` - Empathy matching strategies and conversational guidance  
3. `get_assessment_protocol` - 4-stage assessment framework with specific prompts
4. `get_acute_distress_protocol` - Immediate grounding exercises for acute distress
5. `search_resources_unified` - Search for mental health resources and community support
6. `end_session` - End session and trigger cleanup/memory processing

### Current Progress Status:

#### ✅ COMPLETED:
- **Architecture Migration**: Successfully updated from deprecated `tools` array to new `tool_ids` approach
- **Agent Configuration**: PATCH payload correctly uses `tool_ids` instead of `tools`
- **Webhook Handler**: Complete V17 webhook implementation with all 16 triage functions in `/src/app/api/v17/tools/webhook/route.ts`

#### 🔄 IN PROGRESS:
**Creating Tool #1: `get_safety_triage_protocol`**

**Location**: ElevenLabs UI > Agents > RiseTwice triage Agent > Custom tools > Add tool > webhook

**Steps Completed**:
1. ✅ Basic Configuration:
   - Name: `get_safety_triage_protocol`
   - Description: `Retrieve safety assessment procedures and crisis protocols for immediate risk situations`
   - Method: `POST`
   - URL: `http://localhost:3000/api/v17/tools/webhook`

2. ✅ Headers:
   - Authorization: `Bearer 7896ef50e8ed9c97ca3a6669c46e4889adc256e12829d32f92056b7f5c088469`

3. ✅ Body Parameters:
   - Description: `Parameters for safety triage protocol retrieval`

4. ✅ Properties Added:
   - **risk_type** (String, Required): `Type of safety concern detected (suicide_ideation, self_harm, harm_to_others, psychosis, unsafe_environment, illegal_behaviors)`
   - **risk_level** (String, Required): `Level of risk assessment needed based on user indicators (passive_monitoring, active_assessment, imminent_danger, high_distress)`

**Next Steps**:
1. Add optional third parameter: `session_context` (String, Optional): `Current conversation context for continuity-aware responses`
2. Click "Add tool" to create the first tool and get its ID
3. Repeat process for remaining 5 tools
4. Update agent configuration with all 6 tool IDs
5. Test end-to-end functionality

#### ⏳ PENDING:
- Tool #2: `get_conversation_stance_guidance`
- Tool #3: `get_assessment_protocol`  
- Tool #4: `get_acute_distress_protocol`
- Tool #5: `search_resources_unified`
- Tool #6: `end_session`

## Update: JSON Edit Broken - Back to Form Method

**UPDATE**: ElevenLabs "Edit as JSON" feature is broken. Must use manual form filling approach for remaining 5 tools.

## Latest: Programmatic Creation Still Fails Despite UI JSON

**TESTED**: Even with the exact JSON structure from ElevenLabs UI, programmatic creation via API continues to fail with different validation errors:

1. **Missing `tool_config` wrapper**: Fixed by wrapping JSON
2. **Discriminator error**: Fixed by adding `type: "webhook"` 
3. **Schema mismatch**: API expects completely different structure:
   - Expects `webhook` at root level of `tool_config`
   - Expects `assignments` with `dynamic_variable` or `value_path` fields  
   - Expects `api_schema.url` field (not OpenAPI format)

**CONCLUSION**: The UI JSON format and programmatic API format are completely different. Manual creation is the only viable approach.

## Tool Creation Status: 1 of 6 COMPLETE
✅ **Tool #1**: `get_safety_triage_protocol` - CREATED (has tool ID)
⏳ **Remaining**: 5 tools need manual creation via UI forms

## Next Session Instructions:

1. **Continue from**: Creating remaining 5 tools using JSON copy-paste method
2. **Reference**: This document for context and tool specifications  
3. **Approach**: Use "Edit as JSON" button and copy-paste complete JSON for each tool
4. **Goal**: Get all 6 tool IDs, then update `/src/app/api/v17/agents/create/route.ts` to use those IDs instead of programmatic creation

## Technical Context:
- **Webhook URL**: `http://localhost:3000/api/v17/tools/webhook`
- **Authentication**: Bearer token from `ELEVENLABS_WEBHOOK_TOKEN`
- **Architecture**: V17 uses `tool_ids` array instead of deprecated `tools` array
- **Implementation**: 95% complete - just need valid tool IDs to finish

The V17 migration will be complete once we have all 6 tool IDs from manual creation.