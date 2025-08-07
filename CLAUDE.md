# RiseTwice Development Guidelines

## Core Principles

- **Keep It Simple**: Make the minimal number of changes needed to achieve the requested task. Don't overcomplicate things.
- **Preserve Existing Code**: DO NOT remove code or features without explicit consent from the user. Only modify what's needed to fulfill the current request.
- **TypeScript Errors**: when fixing TypeScript errors, it's essential to preserve the functionality of the code. do not code until i paste the TS errors.
- **WebRTC**: DO NOT CHANGE WEBRTC code, there have been breaking changes since your training.

## Commands
- `npm run dev` - Start development server with TurboPack (DO NOT RUN THIS COMMAND - user will handle this themselves)
- `npm run build` - Build for production (DO NOT RUN THIS COMMAND - user will handle this themselves)
- `npm run start` - Start production server (DO NOT RUN THIS COMMAND - user will handle this themselves)
- `npm run lint` - Run ESLint (only run this when explicitly requested)

## Code Style
- **Formatting**: Uses Next.js core-web-vitals and TypeScript configurations
- **Imports**: Import from packages first, then local modules
- **Types**: Strongly typed with TypeScript, define interfaces for props and API responses
- **Error Handling**: Use try/catch with specific error handling, typed error responses
- **Naming**: 
  - Files: Component files use PascalCase.tsx, utility files use camelCase.ts
  - Functions: camelCase starting with verb (useAiResponse, getAiResponse)
  - Components: PascalCase (AudioPlayer, Login)
- **UI/Accessibility**:
  - **Text Contrast**: Always ensure sufficient contrast between text and background colors
  - Never use light colors (whites, light grays) for text on white/light backgrounds
  - Use at least `font-medium` and `text-gray-800` or darker for text on white backgrounds
  - Test all color combinations for readability in both light and dark modes

## Architecture
- Next.js App Router with TypeScript
- Supabase for storage
- Firebase for authentication
- TailwindCSS for styling
- API routes with proper error handling and typed responses

## Database Operations

- **ALWAYS check supabase.md before any database operations**
- Never assume table schemas, data types, or constraints
- Consult supabase.md for allowed prompt categories, data types, and validation rules
- When adding new prompt categories, follow the documented process in supabase.md
- Ask user to run SQL queries to understand current database state rather than guessing
- Treat database schema mismatches as breaking errors - never use fallbacks or workarounds

## Application Versions

## AI-Driven Design Principles (ALL VERSIONS)
- **MINIMIZE CODE, MAXIMIZE AI REASONING**: Always prefer sending complete context to AI models rather than writing complex conditional logic
- For user intent detection (like topic transitions), always send the full user input to the AI rather than trying to parse it with code
- **AVOID KEYWORD DETECTION AND PATTERN MATCHING**: Do not implement regex or string matching for user intent - this applies to ALL versions, not just V5
- If AI analysis fails, treat it as a critical error since AI is the core of the application's functionality
- Rely on well-crafted prompts rather than code-based heuristics
- Trust the AI models to handle nuanced understanding of language
- **VITAL**: Do not enhance or add keyword detection even for diagnostic purposes - all intent detection should flow through AI analysis

## Handling External API Changes

When working with newer APIs like OpenAI's Realtime API that may have changed since Claude's training data cutoff present a prompt that can be copy pasted to WebAI, which can search the interent and report its findings.

### IMPORTANT: NEVER MODIFY WebRTC OR OpenAI CODE WITHOUT WEB AI ASSISTANCE

There have been many breaking changes to WebRTC and OpenAI APIs since Claude's training data. You should NEVER change code relating to WebRTC connections, OpenAI API endpoints, or any related functionality unless you:

1. Generate a specific prompt for a web-connected AI
2. Wait for the user to provide the web AI's response
3. Only then make changes based on current, accurate information

This is ABSOLUTELY CRITICAL for maintaining application functionality. Guessing implementation details without current documentation will break the application.

### IMPORTANT: STT and TTS APIs Have Recently Changed
OpenAI has made significant changes to their Speech-to-Text and Text-to-Speech APIs. As of March 2025:
- Whisper model has been replaced with "gpt-4o-transcribe" and "gpt-4o-mini-transcribe" models
- Implementation details and endpoints have changed
- Claude should NOT rely on its training data for current implementation details

### IMPORTANT: Always Prioritize Web Search for Unknown Errors
If you're seeing API errors and the logs don't make the cause clear:
1. **DO NOT** keep implementing different potential solutions without data
2. **DO NOT** revert to older APIs/techniques when encountering problems with newer ones
3. **ALWAYS** present a web search prompt for me to use with an internet-connected AI
4. **WAIT** for me to return with the WebAI response before continuing implementation
5. Let the internet-connected AI find the current solution rather than guessing or reverting

### ABSOLUTE ERROR HANDLING CONSTRAINTS - NO EXCEPTIONS

- **NEVER use fallbacks or defaults for database/API errors**
- **ALWAYS treat schema mismatches as breaking errors**
- **NO hardcoded content when real data is unavailable**
- **FAIL LOUDLY with clear error messages**
- **DATABASE ERRORS ARE CRITICAL - no silent recovery allowed**
- **NEVER attempt to "patch around" schema issues with workarounds**
- **REAL DATA OR ERROR - never fabricate data when sources are unavailable**

## V11 WebRTC and Audio Integration Issues

Based on diagnostic analysis, the V11 implementation has a dual audio processing path:

1. **Parallel Audio Processing Paths**:
   - WebRTC sends audio data directly to the audio service
   - Stop signals are routed through the integration layer
   - These parallel paths cause ID mapping errors but don't affect actual functionality

2. **Key Diagnostic Findings**:
   - `processAudioChunk` function is bypassed - no chunk logging appears
   - All stop signals show the same error pattern: `[WEBRTC-AUDIO-INTEGRATION] Mapped to internal ID: not found`
   - Despite error messages, audio playback completes normally as confirmed by completion stats

3. **Root Cause**:
   - Integration layer never receives audio chunks, preventing ID mapping
   - WebRTC audio flows directly to audio service while stop signals go through integration
   - Console errors are noise rather than functional issues

This architectural disconnect produces console warnings but doesn't impact actual audio functionality.

## V11 Audio Cutoff Diagnostics Implementation

To diagnose premature audio cutoffs, a comprehensive diagnostic system has been implemented in V11:

1. **Modular Configuration-Based System**:
   - Easily disabled with `ENABLE_AUDIO_CUTOFF_DIAGNOSTICS` toggle
   - Configurable detail levels (0-3) for controlling verbosity
   - All components designed for easy removal when issues are resolved

2. **Direct Browser Audio Monitoring**:
   - Browser Audio API event listeners track HTML5 audio elements
   - Monitors all events: play, pause, ended, stalled, waiting, timeupdate
   - Captures premature ending events with detailed timing data

3. **High-Precision Time Tracking**:
   - Session and segment-based tracking of all audio chunks
   - Performance.now() for microsecond precision timing
   - Precise duration calculation and verification for each audio segment

4. **Waveform Analysis**:
   - Direct access to audio output buffer for waveform monitoring
   - RMS volume calculation to detect silence periods
   - Automated detection of silent segments that should contain audio

5. **WebRTC Integration**:
   - Hooks into existing WebRTC audio flow non-invasively
   - Tracks message IDs, stop signals, and audio chunks individually
   - Maps diagnostic data to corresponding WebRTC messages

6. **Comprehensive Logging**:
   - Structured diagnostic events saved to localStorage
   - Timing checkpoints throughout audio playback lifecycle
   - Automatic analysis of potential cutoff points

This system provides multiple layers of verification to detect exactly when and why audio might be stopping prematurely, without affecting the underlying audio playback functionality.

## V11 Enhanced Audio Cutoff Diagnostics (May 2025 Update)

The diagnostic system was enhanced with targeted logging to identify the exact cause of premature audio cutoffs:

1. **Microsecond-Precision Timing**:
   - High-resolution timestamping using `performance.now()` for ultra-precise measurements
   - Capture of exact start and end times for each audio chunk's lifecycle
   - Precise comparison between expected and actual playback durations

2. **Audio Element State Snapshots**:
   - Full capture of audio element state at the moment of completion
   - Tracking of AudioContext state, buffer details, and browser visibility
   - Detection of browser conditions that might interrupt playback (tab switching)

3. **Comprehensive Environment Analysis**:
   - Recording of network conditions, memory usage, and browser state
   - Full analysis of the audio buffer queue at completion time
   - Detection of any concurrent processes that might interrupt audio

4. **Stop Signal Correlation**:
   - Precise matching of stop signal timing with chunk completion events
   - Advanced correlation of server and client timing sequences
   - Detailed analysis of gaps between stop signal receipt and chunk completion

5. **Complete Event Sequence Storage**:
   - Global `__prematureCutoffs` and `__audioFinalizationState` storage
   - Complete sequential history of all audio chunks and their playback metrics
   - Detailed analytics on cutoff patterns and frequency

When audio cutoffs occur, this enhanced system captures a detailed snapshot of the exact state of all audio components, allowing precise diagnosis of whether the issue is related to:
- Audio buffer problems
- Timing issues between server stop signals and client playback
- Browser audio stream interruptions
- Tab or window visibility changes affecting audio playback
- Memory or performance pressure causing incomplete playback

The system's data is persisted to `localStorage` for analysis across sessions and detailed reporting.

## Current Task and Debug Status

### V12 Architecture Overview

The V12 implementation replaces the direct WebRTC implementation with Agora's SDK while maintaining the same user experience. Key architectural components include:

1. **Agora SDK Integration**:
   - Implements Agora Voice SDK for real-time audio transmission
   - Utilizes Agora's Conversational AI SDK for OpenAI integration
   - Handles audio capture, transmission, and playback through Agora's network

2. **Audio Service Adaptation**:
   - Adapts the existing audio service to work with Agora's audio format
   - Maintains the same singleton pattern outside React lifecycle
   - Preserves audio playback queue management and error recovery

3. **Function Calling System**:
   - Maintains the same function registration pattern from V11
   - Adapts function execution to work with Agora's message format
   - Preserves both book and mental health function implementations

4. **User Interface**:
   - Keeps the BlueOrbVoiceUI visualization connected to Agora's audio metrics
   - Maintains all existing UI states and transitions
   - Preserves the debugging panel with Agora-specific diagnostics

5. **Error Handling and Resilience**:
   - Implements Agora-specific error detection and recovery
   - Provides detailed logging for connection and audio issues
   - Maintains consistent UI feedback for error states

### Implementation Strategy

The V12 implementation will be built using a phased approach:

1. **Phase 1: Basic Agora Integration**
   - Set up Agora project and obtain credentials
   - Implement basic Agora client connection in a new hook
   - Establish audio capture and transmission
   - Create token generation API endpoint

2. **Phase 2: Conversational AI Integration**
   - Connect Agora with OpenAI for speech-to-text and text-to-speech
   - Implement conversation management
   - Add chat history display and UI indicators

3. **Phase 3: Function Calling Implementation**
   - Adapt function registration system to work with Agora
   - Implement function calling through Agora's messaging system
   - Connect to existing API endpoints for book and mental health data

4. **Phase 4: Audio Visualization and UI Refinement**
   - Connect BlueOrbVoiceUI to Agora's audio metrics
   - Implement volume monitoring for visualization
   - Refine UI transitions and feedback

5. **Phase 5: Testing and Optimization**
   - Implement comprehensive error handling
   - Add detailed logging for debugging
   - Optimize performance and reliability

### Key Technical Components

1. **use-agora-ai.ts Hook**:
   - Manages Agora client lifecycle
   - Handles audio capture and transmission
   - Provides state and methods similar to use-webrtc.ts

2. **audio-service-agora.ts**:
   - Adapts audio playback to work with Agora's audio format
   - Maintains queue management outside React lifecycle
   - Provides diagnostics and error recovery

3. **V12 API Routes**:
   - Token generation for Agora authentication
   - Session configuration with LLM settings
   - Function execution endpoints

4. **Agora Integration Patterns**:
   - Proper handling of SSR issues with Next.js
   - Dynamic imports for browser-only code
   - Resilient connection management

### Migration Benefits

1. **Simplified Infrastructure**: Agora handles complex networking and media processing
2. **Enhanced Reliability**: Built-in reconnection and network traversal
3. **Improved Scalability**: Designed to handle many concurrent users
4. **Reduced Complexity**: Fewer edge cases and failure modes to handle
5. **Better Performance**: Optimized audio processing and transmission

This implementation will maintain the same user experience as V11 while providing a more reliable and maintainable backend architecture based on Agora's specialized SDKs rather than direct WebRTC implementation.

## V15 Memory System (Current Development)

V15 is the current greenfield implementation with clean architecture based on V11 functionality. The memory system handles conversation analysis and user profile building.

### Memory System Architecture

**Conversation End Flow**:
1. Session ends (user or AI initiated)
2. Conversation marked as inactive
3. Background processing triggered for memory extraction and profile updates

### V15 Memory API Endpoints

**Core APIs** (located in `/src/app/api/v15/`):

1. **`/api/v15/process-user-memory`** - Orchestrator
   - Coordinates the full user profile update process
   - Finds unprocessed conversations
   - Triggers analysis and profile update in sequence

2. **`/api/v15/analyze-conversation`** - Stage 1: Extract Insights
   - Uses OpenAI GPT-4 to analyze conversation transcripts
   - Extracts personal details, health info, emotional patterns, triggers
   - Stores analysis in `conversation_analyses` table

3. **`/api/v15/update-user-profile`** - Stage 2: Merge Profile Data  
   - Uses Claude AI to intelligently merge new analysis with existing profile
   - Updates `user_profiles` table with enhanced user understanding

**Supporting APIs**:
- `/api/v15/create-conversation` - Creates new conversation records
- `/api/v15/save-message` - Stores individual conversation messages
- `/api/v15/get-messages` - Retrieves conversation history

### Database Schema

**Key Tables**:
- `conversations` - Conversation metadata and status
- `messages` - Individual conversation messages and transcripts
- `conversation_analyses` - AI-extracted insights per conversation
- `user_profiles` - Compiled user profile data
- `processed_conversations` - Tracking table for analysis completion

### Memory Processing Flow

```
Conversation End → process-user-memory → analyze-conversation → update-user-profile
                                    ↓                      ↓
                              Extract insights      Merge with profile
```

**IMPORTANT**: V15 is current development focus. All memory system work should use V15 APIs, not V11 versions. V11 files are reference only and should not be modified.