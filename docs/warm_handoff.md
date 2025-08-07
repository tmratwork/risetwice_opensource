file: docs/warm_handoff.md

# Warm Handoff Summary Sheet Implementation

## Overview

The warm handoff feature allows users to generate a comprehensive summary sheet from their conversation history to share with healthcare providers or support professionals. This facilitates a smooth transition of care while maintaining user privacy and dignity.

## Implementation Location

- **Primary UI**: `src/app/chatbotV16/insights/page.tsx` (V16 insights page)
- **API Endpoint**: `src/app/api/v15/generate-summary-sheet/route.ts` (V15 API - updated from V11)
- **Logging**: `src/utils/server-logger.ts` (logWarmHandoffServer function)

## User Flow

### 1. User Initiates Generation
- User navigates to `/chatbotV16/insights` 
- Expands "Summary Sheet for Warm Handoff" panel
- Clicks "Generate summary sheet" button
- **Auto-collapse behavior**: Other panels automatically collapse to keep progress visible
- **Smooth scrolling**: Page automatically scrolls to progress section

### 2. Privacy Validation
- System checks user has opted into insights analysis (`insights_opt_in: true`)
- Validates user has selected categories to include in summary
- Returns 403 error if user hasn't opted in

### 3. Conversation Quality Filtering
- Fetches user's conversations from database
- Applies memory system quality filtering:
  - **At least 6 messages total** (minimum 3 exchanges)
  - **At least 3 user messages** (ensures user engagement)
  - **At least 200 characters** of user content (meaningful content)
- Shows filtering statistics to user
- Applies 50 conversation processing limit

### 4. User Warning and Statistics
- Shows optional warning if >50 qualifying conversations exist
- Displays filtering statistics: "Processing X of Y conversations (Z filtered: reasons)"
- Warning is informational only - doesn't block processing
- Processes 50 most recent qualifying conversations

### 5. AI Analysis
- Uses Claude Sonnet 4 model for analysis
- Applies trauma-informed, warm handoff prompt
- Generates summary in user-consented categories only
- Temperature: 0.2 (factual analysis)
- Max tokens: 16,000

### 6. Summary Generation
- Structures content into summary sheet format
- Includes enhanced user stats (conversation count, message count, filtering statistics)
- Generates unique sharing token for URL
- Saves to `user_summary_sheets` table

### 7. Completion
- Returns data immediately (no job polling)
- Provides shareable URL: `/share/summary/{sharing_token}`
- Summary expires after 30 days
- **Progress remains visible**: Shared progress component shows completion status
- **Optional panel re-expansion**: Panels can be programmatically re-expanded after processing

## Technical Architecture

### Database Tables

#### `user_summary_sheets`
- `user_id` - User identifier
- `insight_id` - Foreign key to latest user insight
- `summary_content` - JSON containing full summary with enhanced statistics
- `sharing_token` - Unique token for sharing URL (format: summary-sheet-v15-{timestamp})
- `generated_at` - Timestamp of generation
- `expires_at` - Expiration timestamp (30 days)

#### `user_privacy_settings`
- `insights_opt_in` - Boolean flag for insights consent
- `insights_categories` - Array of consented categories
- `summary_sheet_opt_in` - Boolean flag for summary sheet consent

### API Endpoints

#### `POST /api/v15/generate-summary-sheet`
**Request Body:**
```json
{
  "userId": "user123",
  "formatOptions": {
    "includeCategories": ["strength", "goal", "coping"],
    "title": "Warm Hand-off Summary", 
    "footer": "Generated for healthcare provider"
  }
}
```

**Response (Immediate - No Job Polling):**
```json
{
  "success": true,
  "summaryContent": { /* Summary object */ },
  "url": "/share/summary/summary-sheet-v15-123-456",
  "sharingToken": "summary-sheet-v15-123-456",
  "stats": {
    "totalConversationsFound": 45,
    "filteredConversations": 25,
    "processedConversations": 20,
    "messageCount": 342,
    "filteringReasons": {
      "tooShort": 15,
      "insufficientUserMessages": 8,
      "insufficientUserContent": 2
    },
    "hasMoreThan50": false,
    "warningMessage": null
  }
}
```

## User Privacy Categories

The system respects user privacy by only including consented categories:

- **strength** - Identified strengths and positive qualities
- **goal** - Current goals and priorities discussed
- **coping** - Helpful coping strategies and techniques
- **resource** - Resources explored or of interest
- **risk** - Safety plan highlights (if consented)
- **safety** - Notes for support person

## AI Prompt Structure

**Database-Driven Prompts**: The warm handoff system now fetches prompts from the database rather than using hardcoded prompts. This allows for prompt management through the admin interface.

### Prompt Categories (Memory System Pattern)

The warm handoff system now follows the **memory system pattern** with separate analysis and merge steps:

**Analysis Step (Stage 1)**:
- **System Prompt** (`warm_handoff_analysis_system`): Trauma-informed approach for analyzing individual conversations
- **User Prompt** (`warm_handoff_analysis_user`): Template-based extraction of structured insights from single conversations

**Merge Step (Stage 2)**:
- **System Prompt** (`warm_handoff_system`): Instructions for merging conversation insights into growing summary
- **User Prompt** (`warm_handoff_user`): Template for combining insights into final warm handoff summary sheets

### Key Features:
- **Two-stage processing**: Individual conversation analysis → merge with existing summary
- **Template-based**: Supports `${variable}` substitution for dynamic content
- **Category-aware**: Only processes user-consented categories
- **Trauma-informed**: Maintains strengths-based, non-clinical approach
- **Privacy-preserving**: Uses user's own language while protecting identity

### Prompt Management
- **Admin Interface**: Available at `/chatbotV15/admin/` under "Warm Handoff" category (4 prompts total)
- **Database Storage**: Stored in `prompts` and `prompt_versions` tables
- **Version Control**: Supports prompt versioning and updates
- **Template Variables**: Supports `${variable}` substitution for dynamic content

### Available Prompts in Admin Interface:
1. **Warm Handoff Analysis System Prompt** - System instructions for analyzing individual conversations
2. **Warm Handoff Analysis User Prompt** - User instructions for extracting structured insights
3. **Warm Handoff Merge System Prompt** - System instructions for merging insights into summary
4. **Warm Handoff Merge User Prompt** - User instructions for combining insights into final summary

## Error Handling

### Common Errors
- **403 Forbidden**: User hasn't opted into insights
- **404 Not Found**: No conversations found
- **500 Server Error**: Database or AI API failures

### API Failures
- **Prompt Fetch Failures**: Critical errors if database prompts cannot be retrieved
- **Privacy validation failures**: User not opted in to insights
- **No conversation data**: No quality conversations found
- **AI analysis errors**: Claude API failures or invalid responses
- **Database save failures**: Summary sheet storage errors

### Critical Error Handling
The system now implements **breaking error handling** for prompt fetching:
- If any of the 4 warm handoff prompts are missing from database → Critical error
- If prompt versions are empty → Critical error  
- If database connection fails → Critical error
- **No fallback prompts** - system will not proceed without valid database prompts

### Required Database Prompts:
- `warm_handoff_analysis_system` - Analysis stage system prompt
- `warm_handoff_analysis_user` - Analysis stage user prompt
- `warm_handoff_system` - Merge stage system prompt
- `warm_handoff_user` - Merge stage user prompt

## V15 Architecture Implementation ✅ COMPLETED

✅ **Issue Resolved**: V16 insights page now uses V15 API endpoints for consistent architecture.

### V15 Updates Implemented:
1. **`/api/v15/generate-summary-sheet`** - New V15 endpoint with enhanced features
2. **V16 insights page** - Updated to use V15 endpoint instead of V11
3. **Conversation quality filtering** - Follows V15 memory system patterns
4. **50 conversation limit** - Performance optimization
5. **Enhanced statistics** - Detailed filtering and processing information

### Architecture Benefits:
- **Consistent patterns** with V15 memory system
- **Immediate response** - No job polling required
- **Quality filtering** - Only processes substantial conversations
- **Performance limits** - Bounded processing time
- **Enhanced logging** - Comprehensive debugging information
- **Backward compatibility** - V11 endpoints remain unchanged

## Comprehensive Logging

### Log File
- **Location**: `logs/warmHandoff.log`
- **Format**: Structured JSON with timestamps
- **Control**: `NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS=true`

### Log Categories
- **HANDOFF_START** - Generation initiated
- **PRIVACY_CHECK** - User privacy validation
- **DATA_FETCH** - Conversation/message retrieval
- **PROMPT_FETCH** - Database prompt retrieval operations
- **AI_ANALYSIS** - Claude API interactions
- **PROCESSING_COMPLETE** - Successful completion
- **ERROR** - All error scenarios

### Sample Log Entry
```json
{
  "timestamp": "2025-01-16T10:30:00Z",
  "level": "INFO",
  "category": "PROCESSING_COMPLETE",
  "operation": "summary-sheet-completed",
  "userId": "user123",
  "data": {
    "jobId": "summary-1234567890",
    "totalConversations": 15,
    "messageCount": 342,
    "summaryUrl": "/share/summary/summarysheet-123-456",
    "contentLength": 2847
  }
}
```

## Security Considerations

### Data Protection
- Summaries expire after 30 days
- Sharing tokens are cryptographically unique
- No direct conversation quotes in summaries
- User consent required for all included categories

### Access Control
- User authentication required for generation
- Privacy settings validated before processing
- Only consented categories included
- Staff access controlled by user preference

## Performance Characteristics (Memory System Pattern)

### Processing Limits
- **Maximum conversations**: 10 per batch (following memory system pattern)
- **Quality filtering**: Only processes conversations with:
  - At least 6 messages total
  - At least 3 user messages
  - At least 200 characters of user content
- **No time window**: Processes all conversations (unlike memory system's 7-day limit)
- **Automatic filtering**: Database excludes already processed conversations
- **Duplicate prevention**: `warm_handoff_conversations` table prevents reprocessing

### Typical Processing Times
- **Single batch** (1-10 unprocessed conversations): 15-45 seconds per batch
- **Growing summary**: Each batch merges with existing summary (like memory system profile updates)
- **User-controlled**: User decides when to process next batch by clicking same button
- **Completion detection**: API automatically detects when all conversations are processed

### Resource Usage (Memory System Pattern)
- **Memory**: ~10MB per batch during processing
- **Database**: 
  - Query processed conversations from `warm_handoff_conversations` table
  - Fetch existing summary from `user_summary_sheets` table
  - Upsert updated summary (single row per user)
- **AI API**: 1 request per batch for analysis and merging (16k token limit)
- **Processing**: Immediate response per batch, no job polling
- **Storage**: Single growing summary per user (not multiple separate sheets)

## Future Improvements

### Feature Enhancements
- **Custom prompt templates** per user for specialized providers
- **Multiple export formats** (PDF, Word, structured data)
- **Provider-specific formatting** options for different healthcare systems
- **Batch processing** for multiple users (admin feature)
- **Time-based filtering** option (last 6 months, last year)

### Performance Optimizations
- **Conversation chunking** for very large histories (>50 conversations)
- **Redis caching** for frequently accessed summaries
- **Streaming responses** for real-time progress updates
- **Parallel processing** for multiple concurrent requests
- **Smart filtering** based on conversation quality scores

### User Experience Enhancements
- **Preview mode** - Show summary before saving
- **Edit capabilities** - Allow users to modify generated summaries
- **Category customization** - User-defined summary sections
- **Provider templates** - Pre-configured formats for common providers
- **Collaboration features** - Share drafts with providers for review

## UI/UX Improvements (V16 Update)

### Auto-Collapse Panel Behavior
**Problem Solved**: Progress feedback was displayed at the top of the page, requiring users to scroll up to see generation status.

**Solution Implemented**:
- **Auto-collapse panels**: When warm handoff generation starts, other panels automatically collapse
- **Smooth scrolling**: Page automatically scrolls to progress section
- **Single progress component**: Maintains existing shared progress component for consistency
- **Optional re-expansion**: Panels can be programmatically re-expanded after processing completes

### Implementation Details:
- **Panels collapsed**: Privacy settings, Insights, AI remembers panels
- **Panel kept expanded**: Warm handoff panel remains open
- **Timing**: 100ms delay for smooth animation before scrolling
- **Error handling**: Consistent behavior on both success and error cases
- **Flexibility**: Commented code allows easy re-expansion if desired

### User Experience Benefits:
- **Progress always visible**: No need to scroll to find generation status
- **Context preservation**: Warm handoff panel stays open for reference
- **Smooth transitions**: Animated scrolling provides polished feel
- **Consistent behavior**: Same UX pattern for all processing states

## Troubleshooting

### Common Issues

1. **Critical Prompt Fetch Errors**
   - **Missing prompt categories**: Run SQL to create all 4 warm handoff prompts (analysis + merge)
   - **Empty prompt versions**: Check `prompt_versions` table for content
   - **Database connection issues**: Verify database connectivity
   - **Admin interface**: Use `/chatbotV15/admin/` to verify all 4 prompts exist

2. **Generation Fails Immediately**
   - Check user privacy settings (`insights_opt_in: true`)
   - Verify conversations exist and meet quality requirements
   - Confirm database connectivity and RPC function availability

3. **No Quality Conversations Found**
   - Review conversation filtering statistics
   - Check if conversations meet minimum requirements:
     - At least 6 messages total
     - At least 3 user messages
     - At least 200 characters of user content
   - Verify user has sufficient conversation history

4. **Summary Content Issues**
   - **Validate category consent**: Check privacy settings
   - **Check conversation data quality**: User engagement levels
   - **Review AI prompt content**: Use admin interface to edit prompts
   - **Template variable issues**: Check `${variable}` substitution in prompts

5. **Missing Insights Error**
   - User must have generated insights first
   - Check `user_insights` table for user entries
   - Verify insights are not expired

### Debugging Steps
1. **Check database prompts**: Verify all 4 warm handoff prompts exist in admin interface
2. **Enable warm handoff logging**: `NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS=true`
3. **Check browser console**: Look for client errors and statistics
4. **Review server logs**: Check `logs/warmHandoff.log` for server events and filtering details
5. **Verify user privacy settings**: Check database settings
6. **Check conversation quality**: Use `get_quality_conversations` RPC
7. **Validate user insights**: Check `user_insights` table for user entries
8. **Test prompt fetching**: Monitor `[PROMPT_FETCH]` log categories for database issues
9. **Verify two-stage processing**: Check that analysis step runs before merge step

This implementation provides a comprehensive warm handoff solution while maintaining user privacy and providing detailed logging for troubleshooting.

## Testing and Development

### Reset Conversations for Testing

When testing the warm handoff system, you may need to mark some conversations as unprocessed to test the processing flow again. The system tracks processed conversations in the `warm_handoff_conversations` table.

To reset conversations for testing:

```sql
-- To mark specific conversations as unprocessed
DELETE FROM warm_handoff_conversations WHERE conversation_id IN ('conv_id_1', 'conv_id_2');

-- To mark all conversations for a user as unprocessed
DELETE FROM warm_handoff_conversations WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = 'your_user_id'
);

-- To mark all conversations as unprocessed (full reset)
DELETE FROM warm_handoff_conversations;
```

The warm handoff system follows the V15 memory system pattern where:
- `warm_handoff_conversations` tracks processed conversations (like `conversation_analyses` in memory system)
- The API automatically finds unprocessed conversations by excluding those in this table
- Each batch processes up to 10 unprocessed conversations and adds their IDs to this table

## Memory System Pattern Implementation (V16 Update)

### Overview
The V16 implementation has been completely rewritten to follow the V15 memory system pattern, eliminating all client-side batch tracking and providing a more reliable, database-driven approach.

### Database-Driven Prompt Management (Latest Update)
The warm handoff system now uses **database-managed prompts** following the **memory system pattern**:

**New Architecture (4 Prompts)**:
- **Analysis prompts**: `warm_handoff_analysis_system` and `warm_handoff_analysis_user`
- **Merge prompts**: `warm_handoff_system` and `warm_handoff_user`
- **Admin management**: Available at `/chatbotV15/admin/` under "Warm Handoff" section (4 prompts total)
- **Template processing**: Supports `${variable}` substitution for dynamic content
- **Breaking errors**: System fails with detailed logging if any prompts are missing

**Two-Stage Processing**:
1. **Analysis Stage**: Individual conversation analysis using analysis prompts
2. **Merge Stage**: Combine insights with existing summary using merge prompts

**Benefits**:
- **Proper separation**: Analysis and merge steps use different prompts (like memory system)
- **Editable prompts**: No code changes needed to update AI instructions
- **Version control**: Full prompt history and versioning
- **Consistent pattern**: Uses exact same V15 pattern as memory system
- **Error visibility**: Clear errors when prompts are missing or invalid

### Key Architectural Changes
- **Database-Driven Processing**: Uses `warm_handoff_conversations` table to track processed conversations (like memory system's `conversation_analyses`)
- **Single Growing Summary**: Each user has one summary that grows with each batch (like memory system's `user_profiles`)
- **No Client-Side Offset**: API automatically finds unprocessed conversations, no client tracking needed
- **Incremental Updates**: Each batch analyzes new conversations and merges insights with existing summary

### Database Schema Changes
- **New Table**: `warm_handoff_conversations` tracks which conversations have been processed
- **Updated Table**: `user_summary_sheets` now stores single growing summary per user (upsert pattern)
- **Processing Logic**: Mirrors memory system's approach to prevent duplicate processing

### User Experience (Simplified)
1. **Single Button**: User always clicks "Generate warm handoff summary" 
2. **Automatic Detection**: API finds unprocessed conversations automatically
3. **Progress Display**: Shows total conversations, already processed, and remaining
4. **Growing Summary**: Each batch updates the same summary sheet with new insights
5. **Completion**: Button text changes to "Process next conversations" when more remain

### API Changes (Following Memory System Pattern)
- **Removed**: `offset` parameter (no longer needed)
- **Added**: Automatic conversation filtering based on `warm_handoff_conversations` table
- **Enhanced**: Summary merging (like memory system profile merging)
- **Simplified Response**: Returns processing statistics similar to memory system

### Processing Flow (Like Memory System)
1. **Find Quality Conversations**: Get all conversations meeting quality requirements
2. **Filter Processed**: Remove conversations already in `warm_handoff_conversations` table
3. **Process Batch**: Analyze up to 10 unprocessed conversations
4. **Merge Summary**: Combine new insights with existing summary (like profile merging)
5. **Mark Processed**: Add conversation IDs to `warm_handoff_conversations` table
6. **Update Summary**: Upsert the growing summary in `user_summary_sheets`

### Benefits of Memory System Pattern
- **Reliability**: Database tracks processed conversations, prevents duplicates
- **Simplicity**: No client-side state management needed
- **Consistency**: Same pattern as proven memory system
- **Performance**: Only processes unprocessed conversations
- **Resilience**: If processing fails, conversations remain unprocessed and can be retried
- **Growing Summary**: Single comprehensive summary that improves with each batch