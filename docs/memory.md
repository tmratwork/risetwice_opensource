file: docs/memory.md

# Memory System Documentation

## V16 Memory System (Current Implementation)

### Overview

The V16 Memory System introduces a new, simplified architecture for managing "What AI Remembers" data and generating warm handoff summaries. Unlike the complex V15 system, V16 focuses on direct memory processing with dedicated prompts and streamlined workflows.

### Privacy Protection for Anonymous Users

**Important**: The V16 memory system respects user privacy choices:
- **Anonymous users** (IDs starting with `anonymous-`) are **excluded** from all memory processing
- These users have chosen not to create accounts, indicating they don't want to be remembered
- The system handles anonymous users gracefully:
  - Daily cron jobs (5:00 AM UTC) skip anonymous users entirely
  - Manual job creation marks their conversations as `skipped` with reason `anonymous_user`
  - No errors are returned - the system responds successfully
- Conversations are tracked in `v16_conversation_analyses` as skipped (like low-quality conversations)
- This ensures anonymous users' data is never analyzed while preventing reprocessing attempts

### Key Features

- **Dedicated V16 Memory Page**: New `/chatbotV16/memory` interface
- **Simplified Architecture**: Direct API calls without complex job polling
- **Memory-Based Handoffs**: Warm handoffs generated specifically from memory data
- **Separate V16 Prompts**: Four dedicated V16 memory prompts independent of V15

### File Structure & API Endpoints

#### V16 Memory APIs (`/src/app/api/v16/`)

**Core Memory APIs:**

**`/api/v16/get-memory`** - Retrieve Memory Data
- Fetches the latest V16 memory data for a user
- Returns structured memory content from `v16_memory` table
- Handles cases where no memory data exists yet

**`/api/v16/generate-warm-handoff`** - Create Handoff Summary
- Generates warm handoff based on existing memory data
- Takes `sourceMemoryId` to link handoff to specific memory version
- Creates professional summaries for healthcare provider handoffs
- Stores results in `v16_warm_handoffs` table

**Asynchronous Job Queue APIs:**

**`/api/v16/memory-jobs/create`** - Create Memory Processing Job
- Creates asynchronous memory processing jobs to avoid browser timeouts
- Validates user and analyzes conversation scope
- Returns job ID for status tracking
- Triggers background processing automatically

**`/api/v16/memory-jobs/status`** - Poll Job Status
- Returns real-time job progress and status updates
- Provides progress percentage, processed conversation counts
- Returns completed memory data when job finishes
- Handles job failure states with error messages

**`/api/v16/memory-jobs/process`** - Background Job Processor
- Handles actual memory processing asynchronously
- Processes conversations individually to avoid token limits
- Uses V16-specific extraction and merge prompts
- Creates new memory entries in `v16_memory` table
- Merges with existing memory data when available
- Updates job progress in real-time

### V16 Memory Prompts

The V16 system uses six dedicated prompts stored in the database:

**Memory Processing Prompts:**
1. **`v16_what_ai_remembers_extraction_system`** - System prompt for extracting memory data from conversations
2. **`v16_what_ai_remembers_extraction_user`** - User prompt for structuring conversation analysis
3. **`v16_what_ai_remembers_profile_merge_system`** - System prompt for merging memory data
4. **`v16_what_ai_remembers_profile_merge_user`** - User prompt for combining memory information

**Warm Handoff Prompts:**
5. **`warm_handoff_system`** - System prompt for generating professional warm handoff summaries
6. **`warm_handoff_user`** - User prompt template for clinical handoff generation

All prompts are editable via the V16 admin interface at `/chatbotV16/admin`.

### Database Schema (V16) - Consolidated Single-Table Architecture

#### Core V16 Tables (Current Implementation)

**`v16_conversation_analyses`** - Processing Artifacts
- Individual conversation processing results and deduplication tracking
- Fields: `id`, `user_id`, `conversation_id` (UNIQUE), `analysis_result` (JSONB), `extracted_at`
- Purpose: Track which conversations have been processed, store individual extraction results
- Pattern: One row per conversation analysis
- Usage: Prevents duplicate processing, debugging, processing state tracking

**`user_profiles`** - Unified User Memory (ONE per user) **[CONSOLIDATED]**
- Stores THE single unified memory profile for each user
- Fields: `user_id` (UNIQUE), `profile_data`, `conversation_count`, `message_count`, `version`, `ai_instructions_summary`
- Purpose: Single source of truth for user memory
- Pattern: One row per user (enforced by unique constraint)
- Usage: Display "What AI Remembers", provides context for prompt injection
- Note: Bridges V16 memory to V15 prompt injection via `ai_instructions_summary` field

**`v16_memory_jobs`** - Job Queue Management
- Tracks asynchronous memory processing jobs
- Fields: `id`, `user_id`, `status`, `job_type`, `total_conversations`, `processed_conversations`, `progress_percentage`
- Additional fields: `batch_offset`, `batch_size`, `created_at`, `updated_at`, `started_at`, `completed_at`
- Error tracking: `error_message`, `processing_details` (JSONB)
- Purpose: Manage background processing, prevent timeouts, track progress

**`v16_warm_handoffs`** - Warm Handoff Storage
- Stores generated warm handoff summaries for healthcare providers
- Fields: `id`, `user_id`, `source_memory_id`, `handoff_content`, `created_at`
- Purpose: Maintain history of generated handoffs
- Usage: Display and export warm handoff summaries

### Processing Architecture

#### Individual Conversation Processing (August 2025)

The V16 system processes conversations individually to avoid token limit issues:

1. **Job Creation**: Identifies unprocessed conversations from `v16_conversation_analyses`
2. **Individual Processing**: Each conversation processed separately with appropriate model:
   - GPT-5-mini: Default model (272K token limit)
   - GPT-5: For complex/longer conversations
3. **Quality Filtering**: Minimum 6 messages, 3 user messages, 200 character content
4. **Deduplication**: Checks `v16_conversation_analyses` before processing
5. **Progressive Updates**: Real-time progress tracking during processing
6. **Profile Merging**: Combines new insights with existing profile
7. **AI Summary Generation**: Creates summary for prompt injection system

### Recent Bug Fixes

## Processed Conversations Counter Bug Fix (August 2025)

### Problem Identified
The `processed_conversations` counter was showing incorrect values (e.g., 9 processed when total was only 2) due to double-counting logic in the job processor.

### Root Cause
The counter was being updated twice:
1. Preemptively incremented by batch size before processing started
2. Then overwritten with loop index during individual conversation processing

This caused the counter to show the last loop index (0-9 for 10 conversations) rather than cumulative progress.

### Solution Implemented (August 12, 2025)

**Changes to `/api/v16/memory-jobs/process/route.ts`:**
1. **Removed preemptive update** at line 311-319 that incorrectly added batch size to counter
2. **Fixed individual tracking** at line 641 to use cumulative count: `job.processed_conversations + i + 1`
3. Progress now accurately reflects actual conversations processed

**Result:** Counter now correctly shows cumulative processed conversations across multiple job runs.

## Anonymous User Privacy Protection (August 2025)

### Problem Identified
Anonymous users (with IDs starting with `anonymous-` followed by timestamp and random string) were being processed by the memory system, violating their implicit privacy choice.

### Solution Implemented (August 12, 2025)

**Changes made:**
1. **`/api/v16/scheduled-memory-processing/route.ts`**: Filters out anonymous users before creating jobs
2. **`/api/v16/memory-jobs/create/route.ts`**: Gracefully handles anonymous users by marking conversations as skipped
3. **`v16_conversation_analyses` table**: Records anonymous conversations with `skip_reason: 'anonymous_user'`

**How it works:**
- Anonymous user conversations are marked in `v16_conversation_analyses` with:
  - `processing_status: 'skipped'`
  - `skip_reason: 'anonymous_user'`
  - `analysis_result: { skipped: true, reason: 'anonymous_user' }`
- No error is returned - the API responds with success
- Similar to how low-quality conversations are marked as `'insufficient_quality'`

**Privacy guarantee:** Anonymous users' conversations are never analyzed but are tracked as skipped to prevent reprocessing attempts.

## Token Limit Fix & Individual Processing (August 2025)

### Problem
Jobs failing with "8192 tokens exceeded" errors when processing large conversation batches.

### Solution
Changed from batch processing to individual conversation processing:
- Each conversation analyzed separately
- Automatic model selection based on size
- Comprehensive error tracking per conversation
- Zero token limit errors after implementation

### Verification Results
- **August 11 Cron Job**: 7 jobs, 5 succeeded, 2 duplicate key errors
- **August 12 Cron Job**: 21 jobs, 100% success rate, zero errors

## Important Architectural Decisions

### Two-Table Design Pattern
The V16 system follows a proven two-table architecture:

1. **`v16_conversation_analyses`**: Tracks processing state (many rows)
2. **`user_profiles`**: Stores unified memory (ONE row per user)

This separation ensures:
- No runtime merging required
- Clean accumulation of insights
- Single source of truth for user memory
- Efficient deduplication tracking

### Memory to Prompt Injection Bridge
V16 memory processing automatically generates AI summaries that feed into the prompt injection system:
1. Process conversations → Extract insights
2. Merge into unified profile → Store in `user_profiles`
3. Generate AI summary → Update `ai_instructions_summary`
4. Prompt injection reads summary → Personalizes AI responses

## Common Issues and Solutions

### Browser Timeout Resolution
**Issue**: Processing taking 30-40 seconds causing browser timeouts
**Solution**: Asynchronous job queue with background processing

### Duplicate Processing Prevention
**Issue**: Same conversations processed multiple times
**Solution**: `v16_conversation_analyses` table with unique constraint on conversation_id

### Progress Tracking Accuracy
**Issue**: Incorrect processed conversation counts
**Solution**: Cumulative counter updates without preemptive increments

## Database Schema

### V16 Memory Jobs Table
```sql
CREATE TABLE v16_memory_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    job_type TEXT NOT NULL DEFAULT 'memory_processing',
    batch_offset INTEGER NOT NULL DEFAULT 0,
    batch_size INTEGER NOT NULL DEFAULT 10,
    total_conversations INTEGER NOT NULL DEFAULT 0,
    processed_conversations INTEGER NOT NULL DEFAULT 0,
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    processing_details JSONB DEFAULT '{}'::jsonb,
    conversations_skipped INTEGER DEFAULT 0,
    conversations_failed INTEGER DEFAULT 0,
    average_quality_score NUMERIC(3,1),
    total_tokens_processed INTEGER DEFAULT 0,
    processing_end_time TIMESTAMP WITH TIME ZONE
);
```

### V16 Conversation Analyses Table
```sql
CREATE TABLE v16_conversation_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    conversation_id UUID NOT NULL UNIQUE,
    analysis_result JSONB NOT NULL,
    extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    processing_status TEXT DEFAULT 'pending',
    error_details JSONB,
    extraction_metadata JSONB,
    quality_score INTEGER,
    skip_reason TEXT,
    processing_duration_ms INTEGER
);
```

## Monitoring & Debugging

### Logging System
- Console prefix: `[v16_memory]` for all memory operations
- Server logs: `logs/v16Memory.log`
- Comprehensive tracking of conversation flows
- Detailed error context preservation

### Performance Metrics
- Processing speed: ~500ms per conversation
- Token usage: Tracked per conversation
- Success rate: Monitored via job status
- Quality filtering: Logged with criteria breakdown

## Cron Job Verification

### Daily Processing (5:00 AM UTC)
The system runs automated memory processing via Vercel cron:
- **Schedule**: Daily at 5:00 AM UTC (05:00 UTC)
- **Time Zone Conversions**:
  - 12:00 AM EST / 1:00 AM EDT (Eastern US)
  - 9:00 PM PST / 10:00 PM PDT (Pacific US, previous day)
  - 6:00 AM CET / 7:00 AM CEST (Central Europe)
  - 2:00 PM JST (Japan)
- Processes users with unprocessed conversations
- Individual conversation processing prevents token failures
- Comprehensive statistics tracking
- Automatic retry on transient failures

### Manual Trigger
```bash
curl -X POST https://your-domain.vercel.app/api/v16/scheduled-memory-processing \
  -H "User-Agent: vercel-cron"
```

### Daily Cron Job Verification Prompt (August 13, 2025)

Use this prompt to verify the cron job ran successfully:

```
Check if the V16 memory cron job worked correctly this morning (August 13, 2025 at 5:00 AM UTC). 
The processed_conversations counter bug was fixed on August 12. Verify the fix is working correctly.

Run these SQL queries:

1. Check jobs created around 5:00 AM UTC:
SELECT 
  created_at,
  user_id,
  status,
  total_conversations,
  processed_conversations,
  progress_percentage,
  error_message
FROM v16_memory_jobs
WHERE created_at >= '2025-08-13 04:50:00'
  AND created_at <= '2025-08-13 05:30:00'
ORDER BY created_at DESC;

2. Verify processed_conversations counter accuracy:
- Check that processed_conversations never exceeds total_conversations
- Confirm counter shows cumulative progress (not just last loop index)

3. Get summary statistics:
SELECT 
  COUNT(*) as jobs_created,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as jobs_completed,
  COUNT(CASE WHEN processed_conversations > total_conversations THEN 1 END) as counter_bugs,
  AVG(CASE WHEN total_conversations > 0 
      THEN (processed_conversations::float / total_conversations * 100) 
      ELSE 0 END) as avg_completion_percentage
FROM v16_memory_jobs
WHERE created_at >= '2025-08-13 04:50:00'
  AND created_at <= '2025-08-13 05:30:00';

Expected Results:
- Jobs created around 5:00 AM
- All processed_conversations <= total_conversations (no counter overflow)
- 100% success rate or close to it
- No "counter_bugs" (where processed > total)
```

## Future Improvements

### Planned Enhancements
- Batch size optimization based on conversation complexity
- Parallel processing for multiple users
- Enhanced quality scoring algorithms
- Conversation importance weighting

### Architecture Evolution
- Consider streaming for real-time updates
- Implement conversation clustering
- Add memory versioning with rollback capability
- Enhanced merge strategies for complex profiles

---

Last Updated: August 12, 2025