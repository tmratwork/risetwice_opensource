file: docs/logging_method.md

# Logging Standards for RiseTwice

## Overview

RiseTwice uses conditional logging controlled by environment variables to help debug specific features without cluttering logs with unnecessary output.

## ⚠️ CRITICAL: Environment Variable Consistency

**ALWAYS use `NEXT_PUBLIC_` prefix for ALL logging variables**, even in server-side API routes. This ensures consistency and prevents environment variable mismatches between client and server code.

**❌ Common Mistake:**
Using `ENABLE_FEATURE_LOGS` for server-side and `NEXT_PUBLIC_ENABLE_FEATURE_LOGS` for client-side creates inconsistency and hard-to-debug issues.

**✅ Correct Approach:**
Use `NEXT_PUBLIC_ENABLE_FEATURE_LOGS` everywhere - it works in both client and server contexts.

## Environment Variable Pattern

### Naming Convention
```
NEXT_PUBLIC_ENABLE_[FEATURE]_LOGS=true|false
```

### Location
All logging environment variables are defined in `.env.local`:

```bash
# IMPORTANT: Use NEXT_PUBLIC_ prefix for ALL logging variables
# This ensures they work in both client-side and server-side code
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=true
NEXT_PUBLIC_ENABLE_RESUME_CONVERSATION_LOGS=false
NEXT_PUBLIC_ENABLE_SPECIALIST_TRACKING_LOGS=true
NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS=false
NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS=false
NEXT_PUBLIC_ENABLE_V16_MEMORY_LOGS=false

# ❌ DEPRECATED: Don't use server-only variables (causes inconsistency)
# ENABLE_TRIAGE_SPECIALIST_LOGS=false
```

### Logging Behavior When Disabled

**IMPORTANT: When a logging environment variable is set to `false`:**
- **NO console logging** will occur (neither client-side nor server-side)
- **NO file logging** will occur (server-side log files won't be written)
- **NO logging overhead** - the logging functions return immediately

This ensures complete silence when debugging is disabled, preventing:
- Console clutter in production
- Unnecessary file I/O on the server
- Performance impact from logging operations

## Log Prefix Standards

### Format
All logs for the same feature **must** use the same prefix:
```
[feature_name] Your log message here
```

### ⚠️ CRITICAL: Single Prefix Rule - NO EXCEPTIONS
**When debugging ONE specific problem, ALL logs must use the SAME prefix.**

**🚨 ABSOLUTE RULE: ONE PROBLEM = ONE PREFIX**

If you're debugging "multilingual support", then **EVERY SINGLE LOG** related to that problem must use `[multilingual_support]`, even if the code spans:
- API routes
- Client components  
- Database operations
- Event handlers
- Utility functions

**❌ WRONG: Multiple prefixes for the same problem**
```typescript
// Debugging multilingual support - WRONG approach:
console.log('[multilingual_support] User selected language');     // Correct prefix
console.log('[triage_handoff] Reloading triage prompt');         // WRONG - different prefix!
console.log('[greeting_api] Loading greeting from database');     // WRONG - different prefix!
console.log('[resource_greeting] Regenerating greeting');         // WRONG - different prefix!
```

**✅ CORRECT: Single prefix for the entire problem**
```typescript
// Debugging multilingual support - CORRECT approach:
console.log('[multilingual_support] User selected language');     // Correct prefix
console.log('[multilingual_support] Reloading triage prompt');    // Correct prefix
console.log('[multilingual_support] Loading greeting from database'); // Correct prefix
console.log('[multilingual_support] Regenerating greeting');      // Correct prefix
```

**🔍 Why this absolute rule exists:**
- **Enables easy filtering**: `grep '[multilingual_support]' logs.txt` catches ALL related logs
- **Prevents debugging disasters**: Missing logs due to different prefixes breaks analysis
- **Clear problem boundaries**: One prefix = one debugging session
- **No confusion**: Never wonder if logs are related to your problem
- **Consistent analysis**: All evidence in one filtered log stream

**⚠️ COMMON MISTAKE:** 
Thinking "this log is about triage, so I'll use `[triage_handoff]`" - NO! If you're debugging multilingual support, use `[multilingual_support]` even if the code happens to be in a triage function.

### Examples
- `[triage_handoff]` - For triage AI handoff debugging
- `[resume_conversation]` - For conversation resumption
- `[audio_cutoff]` - For audio diagnostics
- `[message_persistence]` - For database message saving
- `[user_memory]` - For user memory/profile context operations
- `[memory_refresh]` - For manual memory refresh operations
- `[v16_memory]` - For V16 memory processing operations
- `[function_execution]` - For function execution debugging
- `[multilingual_support]` - For language selection and multilingual greeting issues

### 🎯 Real Example: Multilingual Support Debugging

**SCENARIO:** AI continues greeting in English despite user selecting different language.

**❌ WRONG: Multiple prefixes (common mistake)**
```typescript
// In header component
console.log('[header_component] User selected Spanish');

// In API route  
console.log('[greeting_api] Loading Spanish greeting from database');

// In V16 page
console.log('[triage_handoff] Reloading triage prompt with Spanish');
console.log('[resource_greeting] Regenerating resource greeting');

// Result: Logs scattered across 4 different prefixes - debugging nightmare!
```

**✅ CORRECT: Single prefix for entire problem**
```typescript
// In header component
console.log('[multilingual_support] User selected Spanish');

// In API route
console.log('[multilingual_support] Loading Spanish greeting from database');

// In V16 page  
console.log('[multilingual_support] Reloading triage prompt with Spanish');
console.log('[multilingual_support] Regenerating resource greeting');

// Result: All logs under one prefix - easy filtering with:
// grep '[multilingual_support]' logs.txt
```

## Implementation Patterns

### Client-Side Logging (Browser Console)

**Simple conditional logging:**
```typescript
if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
  console.log('[triage_handoff] Handoff initiated to specialist');
  console.error('[triage_handoff] Handoff failed:', error);
}
```

**Helper function approach:**
```typescript
// At top of file
const logTriageHandoff = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
    console.log(`[triage_handoff] ${message}`, ...args);
  }
};

// Usage
logTriageHandoff('Step 1: Configuration loaded');
logTriageHandoff('Error details:', error);
```

### Server-Side Logging (API Routes)

**CRITICAL: Server-side logs MUST be saved to .log files, not just console**

**IMPORTANT: Always use NEXT_PUBLIC_ prefix for consistency**
```typescript
// ✅ CORRECT: Works in both client and server code
if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
  console.log('[triage_handoff] [SERVER] Configuration saved');
}
```

**❌ INCORRECT: Server-only variables cause inconsistency**
```typescript
// Don't do this - causes environment variable mismatches
if (process.env.ENABLE_TRIAGE_SPECIALIST_LOGS === 'true') {
  console.log('[triage_handoff] Server: Configuration saved');
}
```

**REQUIRED: Use both console AND file logging for server-side code:**
```typescript
import { logTriageHandoffServer } from '@/utils/server-logger';

// Add comprehensive logging helper
const logTriageHandoff = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
    console.log(`[triage_handoff] ${message}`, ...args);
  }
};

// Console logging for debugging
logTriageHandoff('API: Configuration saved', { configLength: 1500 });

// File logging for persistent records (REQUIRED for server-side)
logTriageHandoffServer({
  level: 'INFO',
  category: 'HANDOFF',
  operation: 'specialist-config-loaded',
  correlationId: 'handoff_123',
  conversationId: 'conv_456',
  specialistType: 'anxiety',
  data: { configLength: 1500 }
});
```

**RULE: If adding logs to server-side code (API routes), those logs MUST be saved to a .log file with an appropriate name. Console-only logging is insufficient for server-side debugging.**

## File Structure

### Log Files Location
```
logs/
├── debug.log              # General debug logs
├── triageSpecialistAI.log # Triage-specific logs
├── userMemory.log         # User memory/profile context logs
├── memoryRefresh.log      # Memory refresh operation logs
├── v16Memory.log          # V16 memory processing logs
└── error.log              # Error logs
```

### Automatic Directory Creation
Always ensure log directories exist:
```typescript
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
```

## ⚠️ CRITICAL: Infinite Polling Bug Prevention

**COMMON RECURRING BUG: React polling intervals that don't stop**

### The Pattern:
1. User clicks button → creates polling interval
2. API completes successfully 
3. Polling continues indefinitely even after completion
4. Logs show endless `job-status-check-initiated` calls

### Root Cause:
**React state cleanup logic has bugs in the completion handler**

### ❌ BROKEN PATTERNS (causes infinite polling):

**Pattern 1: Early return prevents cleanup**
```typescript
if (job.status === 'completed') {
  // Clear polling
  if (interval) clearInterval(interval);
  setInterval(null);
  
  // Update UI state  
  updateStats(...);
  
  // ❌ BUG: Early return prevents execution of cleanup code below
  return;
  
  // This code never runs - causes infinite polling
  setCurrentJobId(null);
  setProcessing(false);
}
```

**Pattern 2: Unreachable cleanup code**
```typescript  
if (job.status === 'completed') {
  clearInterval(interval);
  return; // ❌ BUG: Stops execution here
  
  // This is unreachable dead code
  setCurrentJobId(null);
  setProcessing(false);
}
```

**Pattern 3: Missing state reset**
```typescript
if (job.status === 'completed') {
  clearInterval(interval);
  setInterval(null);
  // ❌ BUG: Forgot to clear currentJobId and processing state
  // Next button click will see stale state and malfunction
}
```

### ✅ CORRECT PATTERN (stops polling properly):

**Basic Pattern:**
```typescript
if (job.status === 'completed') {
  console.log(`[feature] 🛑 STOPPING POLLING for job: ${jobId}`);
  
  // 1. IMMEDIATELY clear interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
    setPollingInterval(null);
  }
  
  // 2. IMMEDIATELY reset state
  setCurrentJobId(null);
  setProcessing(false);
  
  // 3. EARLY RETURN to prevent further processing
  return;
  
  // 4. NO CODE after return - it's unreachable
}
```

**Advanced Pattern (React Closure Fix):**
If the basic pattern still fails, it's likely a React closure issue where the `pollingInterval` reference is stale:

```typescript
const startPolling = (jobId: string) => {
  // Store interval reference locally to avoid closure issues
  let localInterval: NodeJS.Timeout | null = null;
  
  const pollJob = async () => {
    // ... polling logic ...
    
    if (job.status === 'completed') {
      console.log(`[feature] 🛑 STOPPING POLLING for job: ${jobId}`);
      
      // Clear local interval (this prevents future polling)
      if (localInterval) {
        clearInterval(localInterval);
        localInterval = null;
        console.log(`[feature] ✅ Local interval cleared`);
      }
      
      // Clear state interval for consistency
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
        console.log(`[feature] ✅ State interval cleared`);
      }
      
      // Reset state
      setCurrentJobId(null);
      setProcessing(false);
      
      return;
    }
  };
  
  // Use local variable for interval creation
  localInterval = setInterval(pollJob, 2000);
  setPollingInterval(localInterval);
};
```

**Why the closure fix works:**
- The `pollJob` function captures a stale `pollingInterval` from React state
- But `localInterval` is always the current reference within the same closure
- Clearing `localInterval` guaranteed stops the actual running interval

### Debugging Infinite Polling:

**Add these logs to identify the bug:**
```typescript
// Before completion check
console.log(`[feature] Polling status: ${job.status}, jobId: ${jobId}`);

// In completion handler
if (job.status === 'completed') {
  console.log(`[feature] 🛑 Job completed - stopping polling`);
  console.log(`[feature] Current interval:`, pollingInterval);
  console.log(`[feature] Current jobId:`, currentJobId);
  
  // Clear interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
    console.log(`[feature] ✅ Interval cleared`);
  }
  
  // Reset state
  setCurrentJobId(null);
  setProcessing(false);
  console.log(`[feature] ✅ State reset`);
  
  return;
}
```

**What logs reveal infinite polling:**
- ✅ Job completes: `status: "completed"`
- ✅ Interval cleared: `Interval cleared`  
- ✅ State reset: `State reset`
- ❌ Still polling: `job-status-check-initiated` continues every 2 seconds

**This means:** The return statement is misplaced or there's unreachable cleanup code.

### Prevention Rules:
1. **NEVER put code after `return` in completion handlers**
2. **ALWAYS clear interval AND reset state BEFORE return**
3. **ALWAYS use early return to prevent further processing**
4. **ALWAYS test polling stops with completion logs**

This pattern has caused infinite polling bugs multiple times. Following this pattern prevents the recurring issue.

## When to Add Logging

### Add Logging For:
- **Complex workflows** (handoffs, state transitions)
- **Error-prone operations** (API calls, database operations)
- **Performance debugging** (timing, bottlenecks)
- **Integration points** (WebRTC, AI APIs, database)
- **⚠️ POLLING INTERVALS** (start, stop, completion handlers)

### Don't Add Logging For:
- **Simple getters/setters**
- **Frequent operations** (every render, every mouse move)
- **Stable, well-tested code**

## Best Practices

### 1. Consistent Prefixes
```typescript
// ✅ Good - consistent prefix
console.log('[triage_handoff] Step 1: Starting');
console.log('[triage_handoff] Step 2: Loading config');

// ❌ Bad - inconsistent prefixes  
console.log('[handoff] Step 1: Starting');
console.log('[TRIAGE] Step 2: Loading config');
```

### 2. Structured Data
```typescript
// ✅ Good - structured data
console.log('[triage_handoff] Handoff completed', {
  specialist: 'anxiety',
  duration: '1.2s',
  steps: 6
});

// ❌ Bad - unstructured string
console.log('[triage_handoff] Handoff to anxiety took 1.2s with 6 steps');
```

### 3. Error Context
```typescript
// ✅ Good - full error context
if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
  console.error('[triage_handoff] Configuration load failed', {
    specialist: specialistType,
    conversationId,
    error: error.message,
    stack: error.stack
  });
}
```

### 4. Progressive Detail Levels
```typescript
// High-level success/failure
console.log('[triage_handoff] ✅ Handoff completed successfully');

// Detailed steps (when debugging enabled)
if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
  console.log('[triage_handoff] Step 1: Pending handoff stored');
  console.log('[triage_handoff] Step 2: Config loaded (1400 chars)');
  console.log('[triage_handoff] Step 3: Functions cleared (12 removed)');
}
```

## Example Implementation

### Full Feature Logging Setup

**1. Add environment variable:**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_MY_FEATURE_LOGS=true
```

**2. Client-side logging:**
```typescript
// Helper function at top of file
const logMyFeature = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_MY_FEATURE_LOGS === 'true') {
    console.log(`[my_feature] ${message}`, ...args);
  }
};

// Usage throughout file
logMyFeature('Operation started');
logMyFeature('Configuration loaded:', config);
logMyFeature('❌ Operation failed:', error);
```

**3. Server-side logging (API routes):**
```typescript
// ✅ CORRECT: Use NEXT_PUBLIC_ prefix for consistency
if (process.env.NEXT_PUBLIC_ENABLE_MY_FEATURE_LOGS === 'true') {
  console.log('[my_feature] [SERVER] API endpoint called');
}

// ❌ INCORRECT: Don't use server-only variables
// if (process.env.ENABLE_MY_FEATURE_LOGS === 'true') {
//   console.log('[my_feature] [SERVER] API endpoint called');
// }
```

### User Memory Logging Example

**Environment variable:**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS=false  # No logs when false
```

**Server-side implementation (from server-logger.ts):**
```typescript
export function logUserMemoryServer(entry: ServerLogEntry): void {
  try {
    // When false, function returns immediately - NO logging occurs
    if (process.env.NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS !== 'true') {
      return;  // Early exit - no console or file logging
    }

    // Only executes when logging is enabled
    // Writes to logs/userMemory.log file
    const logLine = JSON.stringify({...entry}) + '\n';
    fs.appendFileSync(logFile, logLine);

    // Also logs to console
    console.log(`[user_memory] ${entry.level}: ${entry.operation}`, {...});
  } catch (error) {
    // Error handling...
  }
}
```

**Key behavior:**
- When `NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS=false`, the function returns immediately
- NO file is written to `logs/userMemory.log`
- NO console output occurs
- Zero performance impact when disabled

### Memory Refresh Logging Example

**Environment variable:**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS=false  # No logs when false
```

**Server-side implementation (from server-logger.ts):**
```typescript
export function logMemoryRefreshServer(entry: ServerLogEntry): void {
  try {
    // When false, function returns immediately - NO logging occurs
    if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS !== 'true') {
      return;  // Early exit - no console or file logging
    }

    // Only executes when logging is enabled
    // Writes to logs/memoryRefresh.log file
    const logLine = JSON.stringify({...entry}) + '\n';
    fs.appendFileSync(logFile, logLine);

    // Also logs to console
    console.log(`[memory_refresh] ${entry.level}: ${entry.operation}`, {...});
  } catch (error) {
    // Error handling...
  }
}
```

**Usage in server-side API routes:**
```typescript
import { logMemoryRefreshServer } from '@/utils/server-logger';

// Log start of memory refresh
logMemoryRefreshServer({
  level: 'INFO',
  category: 'MEMORY_PROCESSING',
  operation: 'manual-refresh-started',
  userId,
  data: { 
    source: 'manual-refresh',
    totalConversations: 5,
    unprocessedFound: 2
  }
});

// Log completion
logMemoryRefreshServer({
  level: 'INFO',
  category: 'PROCESSING_COMPLETE',
  operation: 'manual-refresh-completed',
  userId,
  data: {
    conversationsProcessed: 2,
    processingTime: '3.2s'
  }
});
```

**Key behavior:**
- When `NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS=false`, the function returns immediately
- NO file is written to `logs/memoryRefresh.log`
- NO console output occurs
- Zero performance impact when disabled

## Debugging Workflow

### 1. Enable Logging
```bash
# Edit .env.local
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=true
```

### 2. Restart Development Server
```bash
npm run dev
```

### 3. Reproduce Issue
- Trigger the problematic feature
- Watch browser console for `[triage_handoff]` logs
- Check `logs/debug.log` for server logs

### 4. Analyze Logs
- Look for error patterns
- Check timing between log entries
- Verify expected flow sequence

### 5. Clean Up
```bash
# Disable when done debugging
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=false
```

This approach ensures debugging information is available when needed but doesn't clutter production logs or impact performance when disabled.