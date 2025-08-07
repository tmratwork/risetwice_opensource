file: docs/your_insights.md

# Your Insights Documentation

## Overview

"Your Insights" is a personal development feature that analyzes user conversations to extract meaningful patterns, strengths, and coping strategies. It's designed to help users understand their own growth and development through self-reflection.

## Purpose and Distinction

### What "Your Insights" Provides
- **Personal Development Focus**: Shows patterns, strengths, and coping strategies in the user's own language
- **Self-Awareness Categories**: Organized around personally meaningful areas (strengths, goals, coping)
- **Privacy-First Design**: Granular consent for each category with user control over what insights are generated
- **Offline Access**: Cached in localStorage for access across sessions
- **Batch Processing**: Processes up to 10 conversations per batch with visible progress tracking

### How It Differs from Other Sections

| Feature | Your Insights | AI Remembers | Warm Handoff |
|---------|---------------|--------------|--------------|
| **Purpose** | Personal development & self-understanding | AI personalization & response improvement | Professional healthcare provider summaries |
| **Target Audience** | User (self-reflection) | AI system | Healthcare providers |
| **Data Focus** | Personal growth categories | Detailed behavioral profile | Clinical summary format |
| **Privacy** | Category-level consent | All-or-nothing | Professional sharing |
| **Caching** | localStorage | Database only | Database only |
| **Processing** | Batch processing (10 max) with stats | Batch processing (10 max) with stats | Batch processing (10 max) with stats |

## Architecture

### V15 Implementation (Current)

The system was updated to follow the warm handoff pattern for consistency:

#### API Endpoint
- **Location**: `/api/v15/generate-user-insights/route.ts`
- **Method**: POST
- **Authentication**: Firebase ID token

#### Key Features
1. **Admin-Managed Prompts**: All prompts fetched from database (`user_insights_system` and `user_insights_user` categories)
2. **Batch Processing**: Processes up to 10 conversations per request
3. **Conversation Tracking**: Prevents re-analysis of processed conversations
4. **Quality Filtering**: Uses existing `get_quality_conversations` function
5. **Progressive Enhancement**: Merges new insights with existing data

### Database Schema

#### Primary Table: `user_insights`
- Stores the generated insights data
- One record per user (upserted on updates)
- Contains grouped insights by category

#### Tracking Table: `user_insights_conversations`
```sql
CREATE TABLE user_insights_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Firebase user IDs are TEXT, not UUID!
  conversation_id UUID NOT NULL, -- References conversations(id)
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, conversation_id)
);

-- CRITICAL: Disable RLS for server-side API access
-- The V15 API runs without authentication context and needs to write tracking data
ALTER TABLE user_insights_conversations DISABLE ROW LEVEL SECURITY;
```

**IMPORTANT NOTES**: 
- Firebase user IDs are alphanumeric strings (e.g., `"NbewAuSvZNgrb64yNDkUebjMHa23"`), not UUIDs. Always use `TEXT` for `user_id` fields when working with Firebase authentication, even though `auth.users.id` is UUID type. This prevents "invalid input syntax for type uuid" errors.
- **RLS must be disabled** on this tracking table. The server-side API runs without authentication context (`auth.uid()` returns `null`), so RLS policies that require `auth.uid()::text = user_id` will block all operations. This follows the same pattern as `warm_handoff_conversations` table.

### Processing Flow

1. **Privacy Check**: Verify user has opted in to insights analysis
2. **Find Quality Conversations**: Use `get_quality_conversations` RPC with filters:
   - Minimum 6 total messages
   - Minimum 3 user messages  
   - Minimum 200 characters user content
3. **Check Processed**: Query `user_insights_conversations` to find already processed conversations
4. **Batch Processing**: Process up to 10 unprocessed conversations
5. **AI Analysis**: Send to Claude with system and user prompts from database
6. **Merge Results**: Combine new insights with existing insights
7. **Save & Track**: Upsert insights and mark conversations as processed

## User Experience

### Privacy Controls
- **Opt-in Required**: Users must explicitly enable insights analysis
- **Category Selection**: Granular control over which types of insights to generate:
  - Strengths I've shown
  - My goals and priorities  
  - Helpful coping strategies
  - Resources I've explored
  - Signs of distress
  - Conversation patterns
- **Staff Visibility**: Optional setting to allow staff to view insights for system improvement

### Generation Process
1. User clicks "Generate Insights" button
2. System shows progress indicator and processing statistics
3. Processing completes immediately (V15 API is synchronous, processes max 10 conversations per batch)
4. Results displayed with timestamp and conversation count
5. Insights cached locally for offline access
6. Statistics show total conversations found, already processed, and remaining

### Data Display
- **Organized by Category**: Each insight type displayed with appropriate icon
- **Source Attribution**: Each insight includes source information
- **Timestamp**: Shows when insights were last generated
- **Statistics**: Displays conversation and message counts analyzed

## Technical Implementation Details

### Prompt Management
- **System Prompt**: Category `insights_system` in prompts table
- **User Prompt**: Category `insights_user` in prompts table
- **Template Variables**: 
  - `${existingInsights ? 'update' : 'create'}` - Conditional text for new vs update
  - `${insightTypes.includes('category')}` - Category-specific inclusion
  - `${existingInsights?.insights}` - Previous insights for merging
  - `${conversationsText}` - Formatted conversation data

### Error Handling
- **Breaking Errors**: Missing prompts cause immediate failure (no fallbacks)
- **Graceful Degradation**: Network errors don't lose existing cached data
- **User Feedback**: Clear error messages with specific details

### Performance Considerations
- **Batch Limiting**: Maximum 10 conversations per request prevents timeouts
- **Conversation Tracking**: Prevents duplicate processing using `user_insights_conversations` table
- **Quality Filtering**: Only processes meaningful conversations
- **Local Caching**: Reduces server load and improves user experience
- **Memory System Pattern**: Follows same processing approach as warm handoff for consistency

## Development History

### Migration from V11 to V15
This feature was originally implemented using V11 architecture with job-based polling. It was updated to V15 to:

1. **Consistency**: Follow the same pattern as warm handoff processing
2. **Reliability**: Remove complex job polling in favor of synchronous processing
3. **Maintainability**: Use admin-managed prompts instead of hardcoded ones
4. **Efficiency**: Implement proper conversation tracking and batch processing

### Key Changes Made
1. **API Endpoint**: Created new `/api/v15/generate-user-insights/route.ts`
2. **Database Table**: Added `user_insights_conversations` tracking table
3. **UI Updates**: Modified insights page to use V15 API for generation
4. **Explanatory Text**: Added clear description of feature purpose
5. **Batch Processing**: Implemented 10-conversation limit with progress tracking

### Implementation Issues and Fixes Applied

#### 1. Database Schema Issues
- **Problem**: Initial table used UUID for user_id, but Firebase user IDs are TEXT strings
- **Error**: `"invalid input syntax for type uuid: 'NbewAuSvZNgrb64yNDkUebjMHa23'"`
- **Fix**: Updated table schema to use TEXT for user_id, UUID for conversation_id
- **Prevention**: Added documentation and code comments about Firebase user ID types

#### 2. Prompt Category Naming
- **Problem**: API looked for `user_insights_system`/`user_insights_user` categories
- **Actual**: Database categories are `insights_system`/`insights_user`
- **Fix**: Updated API to use correct category names

#### 3. Query Structure Issues
- **Problem**: `.single()` method failed with "multiple rows returned" due to JOIN with prompt_versions
- **Fix**: Removed `.single()`, used array access with proper error handling

#### 4. JSON Parsing Issues
- **Problem**: Claude returns JSON wrapped in markdown code blocks (````json ... ````)
- **Error**: `"Unexpected token '`', "```json\n[\n"... is not valid JSON"`
- **Fix**: Updated code to convert Claude's array response to grouped format
- **Solution Needed**: Update prompts via admin interface to request raw JSON without markdown

#### 5. Admin Interface Updates
- **Added**: Links to edit `insights_system` and `insights_user` prompts
- **Updated**: Both admin dashboard and prompt editor to include insights prompts
- **Access**: Available at `/chatbotV15/admin/prompt/insights_system` and `/chatbotV15/admin/prompt/insights_user`

## Configuration

### Environment Variables
- `NEXT_PUBLIC_ENABLE_INSIGHTS_LOGS`: Enable detailed logging for debugging

### Database Requirements
- `user_insights` table (existing)
- `user_insights_conversations` table (new)
- `prompts` table with `user_insights_system` and `user_insights_user` categories
- `user_privacy_settings` table for opt-in tracking

## Future Enhancements

### Potential Improvements
1. **Incremental Updates**: Only process new conversations since last update
2. **Insight Confidence Scoring**: Add confidence levels to individual insights
3. **Trend Analysis**: Show how insights change over time
4. **Export Functionality**: Allow users to export their insights
5. **Sharing Options**: Enable selective sharing of insights with providers

### Technical Debt
- **V11 Fetch API**: Still uses V11 for reading existing insights (could be consolidated)
- **LocalStorage Dependency**: Could be supplemented with more robust offline storage
- **Error Recovery**: Could implement better recovery mechanisms for partial failures

## Monitoring and Debugging

### Logging
- All processing steps logged with `[user_insights]` prefix
- Error details captured for debugging
- Performance metrics tracked

### Common Issues
1. **Missing Prompts**: Ensure `insights_system` and `insights_user` prompts exist
2. **Privacy Settings**: Verify user has opted in to insights analysis
3. **Conversation Quality**: Check that user has sufficient quality conversations
4. **Database Permissions**: Ensure RLS policies allow user access
5. **Firebase User ID Type Error**: If you see "invalid input syntax for type uuid" errors, it's because Firebase user IDs are TEXT strings, not UUIDs. Always use `TEXT` type for `user_id` columns and `auth.uid()::text` in RLS policies
6. **JSON Parsing Errors**: If Claude returns JSON wrapped in markdown code blocks, update the system prompt to explicitly request raw JSON without formatting
7. **Admin Interface Access**: Use `/chatbotV15/admin` to access prompt editors for `insights_system` and `insights_user` prompts

## V16 UI Updates (Latest Changes)

### Memory System Pattern Implementation

The V16 insights UI has been updated to follow the exact same pattern as the warm handoff feature for consistency:

#### Processing Statistics Display
- **Progress Info Panel**: Shows total quality conversations, already processed, and remaining
- **Batch Progress Tracking**: Displays conversations processed in current batch (max 10)
- **Dynamic Button Text**: Changes to "Process next conversations" when more batches remain
- **Real-time Stats**: Updates statistics after each batch completion

#### User Experience Improvements
- **Consistent Processing Flow**: Matches warm handoff behavior exactly
- **Transparent Progress**: User can see exactly how much work remains
- **Batch Completion Feedback**: Clear indication when all conversations are processed
- **Memory System Logging**: Comprehensive logging for debugging and monitoring

#### Technical Implementation
- **Stats State Management**: Added `insightsStats` state to track processing progress
- **API Response Handling**: Properly captures and displays statistics from V15 API
- **Progress Bar Updates**: Shows batch progress (not total progress) for accuracy
- **Button State Logic**: Intelligently shows appropriate action based on remaining work

### Benefits of Memory System Pattern
- **User Clarity**: Users understand exactly what's happening during processing
- **Predictable Behavior**: Same UX pattern across warm handoff and insights
- **Performance Transparency**: Shows why processing takes time (10 conversations max per batch)
- **Progress Tracking**: Users can see total scope of work and completion status

## Security Considerations

### Data Protection
- **Row Level Security**: All database access restricted to authenticated users
- **User Consent**: Explicit opt-in required for all processing
- **Data Isolation**: Each user can only access their own insights
- **Audit Trail**: All processing tracked with timestamps

### Privacy by Design
- **Granular Control**: Users control which categories of insights are generated
- **Local Storage**: Sensitive data cached locally under user control
- **Opt-out Support**: Users can disable insights at any time
- **Staff Visibility**: Optional and explicitly controlled by user