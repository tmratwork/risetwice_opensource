file: docs/resource_locator.md

# Resource Locator to ChatbotV16 Handoff System

## Overview

The resource locator system enables users to select specific support resources (emergency shelter, healthcare, mental health services, etc.) from a dedicated resources page and seamlessly transition into a contextually-aware AI conversation about that resource on the main chatbot page.

## Architecture Components

### 1. Resources Page (`/src/app/chatbotV16/resources/page.tsx`)

**Purpose**: Displays categorized resource tiles and handles initial resource selection.

**Key Elements**:
- **Resource Grid**: Displays tiles for different support services
- **Filter System**: Allows filtering by categories (emergency, health, mental health, etc.)
- **Modal Dialog**: Shows detailed resource information when tile is clicked
- **Start Button**: Triggers the resource selection and navigation process

**Resource Selection Flow**:
1. User clicks resource tile → Opens modal with details
2. User clicks "Find [Resource]" → Triggers `handleResourceSelection()`
3. Context data stored in sessionStorage → Navigation to `/chatbotV16`

### 2. SessionStorage Data Transfer

**Mechanism**: Uses browser sessionStorage as a temporary bridge between pages.

**Data Structure**:
```javascript
const resourceContext = {
  source: 'resource_locator',           // Identifies the data source
  timestamp: Date.now(),                // When selection was made
  mode: 'resource_locator',             // Processing mode identifier
  selectedResource: {
    id: selectedCard.id,                // Unique resource identifier
    title: selectedCard.title,          // Resource display name
    subtitle: selectedCard.subtitle,    // Resource subtitle
    description: selectedCard.description, // Detailed description
    functionName: selectedCard.functionName, // AI function to execute
    category: selectedCard.category,    // Resource category
    parameters: parameters              // Function-specific parameters
  }
};
```

**Storage Key**: `'resourceLocatorContext'`

**Lifecycle**:
- **Write**: On resource selection in resources page
- **Read**: On chatbot page load/navigation
- **Clear**: Immediately after reading (prevents duplicate processing)

### 3. ChatbotV16 Processing System

**Location**: `/src/app/chatbotV16/page.tsx`

**Processing Pipeline**:

#### Stage 1: Navigation Event Detection
- **Router Event Listener**: Detects navigation to `/chatbotV16` route
- **Browser Navigation**: Handles back/forward button navigation
- **Immediate Processing**: Checks sessionStorage when route is accessed

#### Stage 2: Context Extraction and Validation
```javascript
processResourceLocatorContext() {
  // 1. Read from sessionStorage
  // 2. Parse JSON data
  // 3. Validate structure and required fields
  // 4. Reset existing conversation state if needed
  // 5. Store in Zustand store
  // 6. Clear sessionStorage
}
```

#### Stage 2.5: Conversation State Reset (V16 Fix)

**Problem Addressed**: When user is already in an active conversation and selects a resource tile, the resource context was being stored but the existing conversation continued unchanged.

**Solution**: The `processResourceLocatorContext()` function now detects existing conversation state and resets it before applying resource context.

**Reset Logic**:
```javascript
// Detect if user was in middle of chat session
const currentState = useWebRTCStore.getState();
if (currentState.isConnected || currentState.conversation.length > 0) {
  logResourceLocator('📍 [NAVIGATION] 🔄 Existing conversation detected - resetting state for resource context');
  
  // Reset conversation and auto-start flags
  currentState.handleDisconnectWithReset();
  setResourceContextAutoStarted(false);
  
  logResourceLocator('📍 [NAVIGATION] ✅ Conversation state reset complete');
}
```

**What Gets Reset**:
- **WebRTC Connection**: Cleanly disconnects active audio session
- **Conversation History**: Clears all previous messages
- **User Input**: Resets any pending user text
- **Auto-start Flag**: Allows fresh resource-specific conversation to begin
- **Session State**: Returns to initial "Let's Talk" state

**User Experience**:
- **Before Fix**: Resource selection ignored, conversation continues
- **After Fix**: Previous conversation disappears, new resource-focused chat begins

#### Stage 3: Zustand Store Integration
**Store Location**: `/src/stores/webrtc-store.ts`

**State Management**:
```typescript
interface ResourceLocatorContextType {
  source: string;
  timestamp: number;
  mode: string;
  selectedResource: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    functionName: string;
    category: string;
    parameters: Record<string, unknown>;
  };
}

// Store state
resourceContext: ResourceLocatorContextType | null
resourceContextAutoStarted: boolean
resourceGreeting: string | null
```

#### Stage 4: AI Greeting Generation
- **Function**: `getResourceWelcomeContent()`
- **Purpose**: Creates contextually-aware welcome message
- **Input**: Selected resource data + user ID
- **Output**: Customized greeting for the specific resource type

**Greeting Storage and Generation System**:

1. **Primary Storage**: `/src/app/chatbotV16/prompts/resource-specific-greetings.ts`
   - Contains `RESOURCE_SPECIFIC_GREETINGS` array with 14+ specific greeting templates
   - Each resource has dedicated greeting with tailored context and examples
   - `ResourceGreeting` interface defines structure
   - `getResourceSpecificGreeting()` function retrieves by resource ID

2. **Generation Flow**: `/src/app/chatbotV16/prompts/resource-locator-welcome.ts`
   - `getResourceWelcomeContent()` attempts resource-specific greeting first
   - Falls back to database greeting via `/api/v11/greeting-prompt` if not found
   - Combines greeting with selected resource details

3. **Database Fallback**: `/src/app/api/v11/greeting-prompt/route.ts`
   - Queries Supabase `prompts` table for `greetingType: 'resources'`
   - Supports both user-specific and global resource greetings
   - Returns default message if no database entry exists

4. **Resource ID Mapping**: `/src/app/chatbotV16/resources/page.tsx`
   - Defines resource tiles with IDs (`food_assistance`, `emergency_shelter`, etc.)
   - IDs map to greeting keys in `resource-specific-greetings.ts`

**Example Resource-Specific Greetings**:
- `emergency_shelter`: "I understand you need emergency shelter - that's a really tough situation..."
- `food_assistance`: "I'm here to help you find food resources. Having enough to eat is so important..."
- `crisis_mental_health`: "I'm really glad you reached out for crisis support - that takes courage..."
- `domestic_violence`: "I'm glad you reached out for safety resources - that takes incredible courage..."

#### Stage 5: Conversation Auto-Start
- **Trigger**: When resource context is detected
- **Behavior**: Bypasses normal "Let's Talk" button flow
- **Instructions**: Combines base triage prompt with resource-specific context

## Data Flow Diagram

```
Resources Page                SessionStorage              ChatbotV16 Page
┌─────────────┐              ┌───────────────┐           ┌─────────────────┐
│ Tile Click  │              │               │           │ Navigation      │
│      ↓      │              │  Temporary    │           │ Event Listener  │
│ Modal Opens │              │    Bridge     │           │      ↓          │
│      ↓      │    write     │               │   read    │ Process Context │
│"Find" Click │ ──────────→  │ resourceLoc-  │ ────────→ │      ↓          │
│      ↓      │              │ atorContext   │           │ Reset Existing  │
│ Navigate    │              │               │   clear   │ Conversation    │
└─────────────┘              └───────────────┘           │      ↓          │
                                                         │ Store in Zustand│
                                                         │      ↓          │
                                                         │ Generate Greeting│
                                                         │      ↓          │
                                                         │ Auto-start Chat │
                                                         └─────────────────┘
```

## Dual Processing Strategy

The system implements two parallel processing paths to handle both fresh page loads and same-route navigation:

### Path 1: Component Mount (Original)
- **Trigger**: Fresh page load or component mount
- **Handler**: `useEffect(() => { ... }, [setResourceContext])`
- **Purpose**: Handles initial page visits from external navigation

### Path 2: Navigation Events (New Fix)
- **Trigger**: Navigation to same route (`/chatbotV16`)
- **Handler**: Router event listener + `processResourceLocatorContext()`
- **Purpose**: Handles navigation from resources page when already on chatbot

**Why Both Are Needed**:
- Next.js App Router doesn't remount components on same-route navigation
- Original useEffect only runs on component mount
- Navigation handler ensures processing occurs on route changes

## Technical Implementation Details

### Navigation Event Handling
```javascript
useEffect(() => {
  const handleRouteChange = () => {
    if (window.location.pathname === '/chatbotV16') {
      processResourceLocatorContext();
    }
  };

  // Check immediately for current route
  handleRouteChange();
  
  // Listen for browser navigation (back/forward)
  window.addEventListener('popstate', handleRouteChange);
  
  return () => {
    window.removeEventListener('popstate', handleRouteChange);
  };
}, [processResourceLocatorContext]);
```

### Error Handling
- **JSON Parsing**: Try/catch blocks prevent crashes from malformed data
- **Validation**: Checks for required fields before processing
- **Logging**: Comprehensive logging for debugging with `logResourceLocator()`
- **Fallback**: Graceful handling when no context is found

### Memory Management
- **Immediate Cleanup**: SessionStorage cleared after reading
- **No Persistence**: Context doesn't survive browser refresh
- **Single Use**: Each context is processed exactly once

## AI Integration

### Instruction Modification
The system modifies AI instructions to include resource-specific context:

```javascript
const finalInstructions = resourceLocatorContext
  ? `${triagePrompt.content}\n\n# RESOURCE CONTEXT OVERRIDE\n${resourceGreeting}`
  : triagePrompt.content;
```

### Function Registration
- Pre-configures AI functions based on selected resource
- Provides default parameters for resource-specific queries
- Enables immediate, contextual responses

### Conversation Customization
- **Greeting**: Tailored welcome message for each resource type
- **Instructions**: Enhanced with resource-specific guidance
- **Functions**: Pre-loaded with relevant capabilities
- **Auto-start**: Begins conversation without user interaction

### Resource Greeting File Structure

**Main Greeting File**: `/src/app/chatbotV16/prompts/resource-specific-greetings.ts`

```typescript
interface ResourceGreeting {
  resourceId: string;
  greeting: string;
}

export const RESOURCE_SPECIFIC_GREETINGS: ResourceGreeting[] = [
  {
    resourceId: 'emergency_shelter',
    greeting: '# Emergency Shelter Focus\n\nI understand you need emergency shelter...'
  },
  {
    resourceId: 'food_assistance', 
    greeting: '# Food Assistance Focus\n\nI\'m here to help you find food resources...'
  },
  // 12+ more resource-specific greetings
];

export function getResourceSpecificGreeting(resourceId: string): string | null {
  const greeting = RESOURCE_SPECIFIC_GREETINGS.find(g => g.resourceId === resourceId);
  return greeting?.greeting || null;
}
```

**Greeting Generation**: `/src/app/chatbotV16/prompts/resource-locator-welcome.ts`

```typescript
export async function getResourceWelcomeContent(resourceData: any, userId: string): Promise<string> {
  // 1. Try resource-specific greeting first
  const specificGreeting = getResourceSpecificGreeting(resourceData.id);
  
  if (specificGreeting) {
    return specificGreeting + `\n\nSelected Resource: ${resourceData.title}`;
  }
  
  // 2. Fall back to database greeting
  const response = await fetch('/api/v11/greeting-prompt', {
    method: 'POST',
    body: JSON.stringify({ 
      greetingType: 'resources',
      userId: userId 
    })
  });
  
  return response.greeting || 'Default resource greeting';
}
```

**Multi-Layer Fallback System**:
1. **Hardcoded Specific Greetings** (14+ resources) - Immediate, tailored responses
2. **Database `prompts` Table** - Customizable via admin interface
3. **Default Generic Greeting** - Final fallback if nothing else found

This ensures every resource tile provides a contextually appropriate greeting while allowing for future customization through database updates.

## Benefits of This Architecture

1. **Seamless UX**: Users transition smoothly between pages
2. **Contextual AI**: AI understands what resource user is seeking
3. **Stateless**: No persistent state management required
4. **Reliable**: Handles various navigation scenarios including mid-conversation resource selection
5. **Conversation Reset**: Properly handles interrupting existing conversations for resource context
6. **Debuggable**: Comprehensive logging throughout process
7. **Maintainable**: Clear separation of concerns
8. **Performant**: Minimal overhead with immediate cleanup

## Debugging and Monitoring

### Logging System
All operations are logged with `logResourceLocator()` function:
- **Navigation Events**: When processing is triggered
- **Data Flow**: SessionStorage read/write operations
- **Validation**: Success/failure of context processing
- **State Changes**: Zustand store updates

### Common Issues
1. **Missing Context**: Check if sessionStorage is being cleared too early
2. **Navigation Not Detected**: Verify route change listeners are active
3. **Invalid Data**: Check JSON structure and required fields
4. **Duplicate Processing**: Ensure cleanup prevents multiple processing
5. **Resource Selection Ignored** (Fixed in V16): When user was in active conversation and selected resource tile, context was stored but conversation continued unchanged

### Issue Resolution: Mid-Conversation Resource Selection

**Problem**: Resource tile selection was ignored when user was already chatting with AI.

**Root Cause**: The `handleDisconnectWithReset()` function was only updating **store state** but not properly disconnecting the **connection manager**, creating a state mismatch where:
- Store showed: `connectionState: "disconnected", isConnected: false`
- Connection Manager remained: `"connected"`

When auto-connect attempted to call `connect()`, the connection manager was already connected, so the call succeeded but didn't change state.

**Solution**: Enhanced `handleDisconnectWithReset()` to properly disconnect the connection manager before resetting store state:

```javascript
// Check connection manager state before reset
if (currentState.connectionManager) {
  const cmState = currentState.connectionManager.getState();
  
  if (cmState === 'connected' || cmState === 'connecting') {
    // Properly disconnect connection manager
    currentState.connectionManager.disconnect();
  }
}

// Then reset store state
set({
  isConnected: false,
  connectionState: 'disconnected',
  conversation: [],
  // ... other state resets
});
```

**Evidence from Debug Logs**:
- **Before Fix**: `connect()` ran but `connectionState` remained `"disconnected"`
- **After Fix**: 
  - Reset: `🔌 DISCONNECT RESET: ConnectionManager is active, calling disconnect()`
  - Connect: `🔌 STORE CONNECT: connectionManager.connect() completed successfully`
  - Final: `connectionState: "connecting"` → `"connected"`

**Test Scenario**:
1. Start conversation: "i binge eat" → AI responds
2. Navigate to resources page → Select resource tile  
3. **Expected**: Previous conversation clears, new resource-focused chat begins
4. **Before Fix**: Resource selection ignored, conversation continues
5. **After Fix**: Conversation resets, AI auto-connects with resource-specific context

**Key Lesson**: Always ensure **connection manager state** and **store state** remain synchronized during resets. Store-only resets can create invisible state mismatches that cause connection failures.

## Resource Tile Click Mapping Bug (Fixed - January 2025)

### **Problem Identified**
User clicks "Food Resources" tile but system incorrectly selects and stores "emergency_shelter" instead of "food_assistance".

**Evidence from logs**:
- User reports clicking food tile
- Logs show: `cardId: "emergency_shelter"`, `cardTitle: "Emergency Shelter"`
- Should show: `cardId: "food_assistance"`, `cardTitle: "Food Resources"`

### **Root Cause Analysis**
The bug was in `/src/app/chatbotV16/resources/page.tsx` at line 358 in `handleResourceSelection()`:

```typescript
// BUGGY CODE - Multiple resources share same functionName
const selectedCard = resourceFunctions.find(card => card.functionName === functionName);
```

**The Issue**: Multiple resources shared the same `functionName`:
- `food_assistance` → `functionName: 'search_resources_unified'`
- `emergency_shelter` → `functionName: 'search_resources_unified'`
- `healthcare_access` → `functionName: 'search_resources_unified'`
- etc.

When `find()` searched by `functionName`, it always returned the **first match** in the array, which was `emergency_shelter` since it appears first.

### **Resource Selection Flow (Before Fix)**
1. `handleCardClick(card)` - User clicks food tile, sets `selectedCard` state ✅
2. `handleStart(functionName)` - User clicks "Find Food Resources" button ✅
3. `handleResourceSelection(functionName, parameters)` - Looks up card by `functionName` ❌
4. **BUG**: `find()` returns `emergency_shelter` instead of `food_assistance`

### **Technical Fix Applied**
1. **Enhanced Logging**: Added comprehensive logging with `NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS=true`:
   ```typescript
   const logResourceGreeting = (message: string, ...args: unknown[]) => {
     if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
       console.log(`[resource_greeting] ${message}`, ...args);
     }
   };
   ```

2. **Fixed Resource Lookup**: Changed `handleResourceSelection()` to accept the `ResourceFunction` directly:
   ```typescript
   // BEFORE (buggy)
   const handleResourceSelection = (functionName: string, parameters: Record<string, unknown>) => {
     const selectedCard = resourceFunctions.find(card => card.functionName === functionName);
   }

   // AFTER (fixed)
   const handleResourceSelection = (resourceCard: ResourceFunction, parameters: Record<string, unknown>) => {
     // Use resourceCard directly - no lookup needed
   }
   ```

3. **Updated Flow**: Modified `handleStart()` to pass `selectedCard` directly:
   ```typescript
   // BEFORE
   const handleStart = (functionName: string) => {
     handleResourceSelection(functionName, parameters);
   }

   // AFTER
   const handleStart = () => {
     if (!selectedCard) return;
     handleResourceSelection(selectedCard, parameters);
   }
   ```

4. **Fixed Modal Button**: Updated button click handler:
   ```typescript
   // BEFORE
   <button onClick={() => handleStart(selectedCard.functionName)}>

   // AFTER
   <button onClick={() => handleStart()}>
   ```

### **Logging Points Added**
- **🖱️ CLICK**: `handleCardClick()` - tracks which tile user clicks
- **🚀 START**: `handleStart()` - logs selected card from modal state
- **🎯 SELECTION**: `handleResourceSelection()` - logs resource context storage
- **❌ BUG DETECTED**: Shows resources with same functionName causing conflicts

### **Verification Results**
✅ **Food Resources** tile now correctly stores:
- `cardId: "food_assistance"`
- `cardTitle: "Food Resources"`

✅ **Emergency Shelter** tile stores:
- `cardId: "emergency_shelter"`
- `cardTitle: "Emergency Shelter"`

✅ All other resources now map correctly to their intended functionality.

### **Files Modified**
- `/src/app/chatbotV16/resources/page.tsx` - Fixed resource selection logic and added logging

### **Environment Variable for Debugging**
```bash
# Enable detailed resource selection logging
NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS=true
```

This follows the project's logging methodology using single prefix `[resource_greeting]` for all related logs.

## Debugging Methodology

The issue was diagnosed using a systematic logging approach:

### **Stage 1: Symptom Identification**
- Resource selection worked but auto-connect failed
- Manual "Let's Talk" button worked perfectly
- Same `connect()` function behaved differently in different contexts

### **Stage 2: Hypothesis Formation**
- Initial hypothesis: Browser security restrictions on programmatic WebRTC
- **Key realization**: Previous versions could auto-connect, so it wasn't a fundamental limitation

### **Stage 3: Comprehensive Logging**
Added logging with `NEXT_PUBLIC_ENABLE_RESOURCE_RESET_LOGS=true`:

```javascript
// Component-level logging
const logResourceReset = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_RESET_LOGS === 'true') {
    console.log(`[resource_reset] ${message}`, ...args);
  }
};
```

**Key Log Points**:
- **Reset process**: State before/after, connection manager actions
- **Connect process**: Store connect function entry/exit, connection manager state
- **Dependency tracking**: When React useEffect hooks fire and why

### **Stage 4: State Mismatch Discovery**
Logs revealed the critical insight:
```
🔌 DISCONNECT RESET: ConnectionManager state before reset: "connected"
🔌 STORE CONNECT: connectionManagerState: "connected" (but store shows "disconnected")
```

### **Stage 5: Targeted Fix**
- Added proper connection manager disconnect to reset function
- Verified fix with detailed before/after logging
- Confirmed state synchronization between store and connection manager

### **Debugging Best Practices Learned**:
1. **Log at component boundaries**: React useEffect, store actions, connection manager calls
2. **Compare working vs broken flows**: Manual button vs programmatic auto-connect
3. **Track state across layers**: React store, connection manager, browser WebRTC
4. **Use conditional logging**: Environment variables for debug-specific logs
5. **Log state before AND after**: Capture complete state transitions

## Future Enhancements

1. **URL Parameters**: Could supplement sessionStorage with URL params
2. **Deep Linking**: Direct links to specific resource conversations
3. **Analytics**: Track resource selection patterns
4. **Caching**: Improve performance with resource data caching
5. **Offline Support**: Handle offline scenarios gracefully