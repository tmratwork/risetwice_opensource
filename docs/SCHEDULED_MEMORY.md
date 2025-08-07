# V15 Scheduled Memory Processing

## Overview

The V15 system includes a daily scheduled job that automatically processes unprocessed conversations to ensure comprehensive memory coverage. This acts as a safety net for conversations that weren't processed due to improper session termination.

## Components

### 1. Scheduled Processing Endpoint
**File:** `/src/app/api/v15/scheduled-memory-processing/route.ts`

**Purpose:** 
- Runs daily at 2:00 AM via Vercel cron
- Identifies all users with unprocessed conversations
- Calls `/api/v15/process-user-memory` in batch mode for each user
- Provides comprehensive logging and error handling

**Key Features:**
- Authorization via `CRON_SECRET` environment variable
- Batch processing with rate limiting (1 second delay between users)
- Detailed logging with `[scheduled-memory]` prefix
- Complete error handling and recovery
- Processing time tracking and statistics

### 2. Cron Configuration
**File:** `/vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/v15/scheduled-memory-processing",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule:** Daily at 2:00 AM UTC
**Frequency:** Once per day during low-traffic hours

### 3. Test Endpoint
**File:** `/src/app/api/v15/test-scheduled-memory/route.ts`

**Purpose:** Manual testing of scheduled memory processing without waiting for cron
**Usage:** `POST /api/v15/test-scheduled-memory`

## Environment Variables

Add to your `.env` files:
```bash
# Cron job security
# Generate a random secret for production: openssl rand -base64 32
CRON_SECRET=your-secure-random-secret
```

**Security Note:** The `CRON_SECRET` prevents unauthorized access to the scheduled endpoint.

## Processing Flow

1. **Cron Trigger:** Vercel cron calls the endpoint daily at 2:00 AM
2. **Authorization Check:** Validates `CRON_SECRET` header
3. **Query Unprocessed:** Finds all conversations not in `conversation_analyses` table
4. **Group by User:** Organizes conversations by `human_id`
5. **Batch Processing:** For each user, calls `/api/v15/process-user-memory` without `conversationId`
6. **Rate Limiting:** 1-second delay between users to prevent system overload
7. **Result Tracking:** Logs success/failure for each user and overall statistics

## Monitoring and Logging

All operations are logged with `[scheduled-memory]` prefix for easy filtering:

```
[scheduled-memory] Starting daily memory processing job at 2024-01-15T02:00:00.000Z
[scheduled-memory] Found 15 unprocessed conversations across 8 users
[scheduled-memory] Processing 3 conversations for user: user_abc123
[scheduled-memory] Successfully processed 3 conversations for user: user_abc123
[scheduled-memory] Daily processing complete: 7 users successful, 1 users failed, 15 total conversations processed in 45000ms
```

## Testing

### Manual Testing
```bash
# Test the scheduled job manually
curl -X POST http://localhost:3000/api/v15/test-scheduled-memory
```

### Production Testing
The scheduled job will run automatically at 2:00 AM daily. Monitor logs for:
- Processing statistics
- Error reports
- Performance metrics

## Integration with Existing Memory System

The scheduled processor leverages the existing V15 memory architecture:
- Uses same `/api/v15/process-user-memory` endpoint
- Follows same two-stage processing (analyze → merge)
- Respects all existing error handling and validation
- Updates same database tables (`conversation_analyses`, `user_profiles`)

## Benefits

1. **Complete Coverage:** Ensures no conversations are lost due to improper session termination
2. **Non-Disruptive:** Runs during low-traffic hours
3. **Fault Tolerant:** Individual user failures don't stop overall processing
4. **Observable:** Comprehensive logging for monitoring and debugging
5. **Testable:** Manual test endpoint for development and validation
6. **Secure:** Authorization prevents unauthorized access

## Limitations and Considerations

1. **Processing Time:** Large backlogs may take significant time to process
2. **Rate Limiting:** 1-second delay between users prevents overload but slows batch processing
3. **Memory Growth:** Very large user profiles may eventually hit context limits (see memory.md)
4. **Cost Impact:** Daily AI processing increases API usage costs

## Future Enhancements

1. **Smart Scheduling:** Skip processing when no unprocessed conversations exist
2. **Parallel Processing:** Process multiple users concurrently with proper rate limiting
3. **Retry Logic:** Automatic retry for failed processing attempts
4. **Alert System:** Notifications for processing failures or unusual patterns
5. **Analytics Dashboard:** UI for monitoring scheduled processing performance