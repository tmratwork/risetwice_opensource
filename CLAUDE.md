# RiseTwice Development Guidelines

## Core Principles 

- **Keep It Simple**: Make the minimal number of changes needed to achieve the requested task. Don't overcomplicate things.
- **Preserve Existing Code**: DO NOT remove code or features without explicit consent from the user. Only modify what's needed to fulfill the current request.
- **TypeScript Errors**: when fixing TypeScript errors, it's essential to preserve the functionality of the code. do not code until i paste the TS errors.
- **WebRTC**: DO NOT CHANGE WEBRTC code, there have been breaking changes since your training.
- **🚨 V17 ElevenLabs Tools**: DO NOT CREATE TOOLS DYNAMICALLY! All 34+ tools already exist in ElevenLabs dashboard. File `src/app/api/v17/agents/create/route.ts` only FETCHES existing tool IDs.

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
- **Background Colors - CRITICAL RULE**:
  - **NEVER hardcode background colors** in page components using Tailwind classes like `bg-sage-200`, `bg-white`, `bg-gray-100`, etc.
  - **ALWAYS use CSS variables** for background colors to maintain single source of truth
  - Background colors are defined in CSS: `--bg-primary: #e7ece9` and `--bg-secondary: #c1d7ca` (green)
  - Layout components automatically apply these backgrounds: `.v16-layout-root`, `.main-content-row`, `.chatbot-v16-wrapper`, `.main-container`
  - When creating new pages, **DO NOT** add `className="bg-*"` to the root div - let it inherit from parent layout
  - Example of CORRECT page structure: `<div className="w-full h-full overflow-y-auto px-6 pt-16 pb-6">`
  - Example of INCORRECT page structure: `<div className="w-full h-full overflow-y-auto px-6 pt-16 pb-6 bg-sage-200">` ❌
  - If background color needs to change, update CSS variables in `/src/app/chatbotV18/chatbotV16.css`, not individual pages

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
- **AVOID KEYWORD DETECTION AND PATTERN MATCHING**: Do not implement regex or string matching for user intent - this applies to ALL versions.
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

# Project V16 Memory

## Project Context
We are working on V16. Ignore previous versions, they will be deleted. 

**Do not start coding until your plan approved.**

## Project Structure
- Reference files in folder: `docs/`

## TypeScript Requirements
- Strict TypeScript compliance
- No `any`, `unknown`, or underscore-prefixed variables. Use proper specific types instead of `any` or `unknown`
- Preserve functionality when fixing TypeScript errors
- Handle specific linting errors properly
- If a variable is never reassigned, use `const` instead
- Reminder: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;` (react/no-unescaped-entities)

## Code Guidelines
- Do not add fallbacks. Our project is in beta, errors should be visible
- All AI prompts and functions are fetched from Supabase tables, DO NOT hard code prompts or functions
- Minimal changes only
- No mock data, placeholders, or stubs
- Breaking errors should be visible (no fallbacks that hide them)
- Check web for WebRTC breaking changes if modifying WebRTC code
- Ignore `.bak` files
- Instead of guessing when fixing errors, add detailed logs to flush out why code is failing. Follow strict logging rules at file: @docs/logging_method.md
- Do not code until your plan is approved

## Database
- Connect to Supabase project directly via MCP for queries
- Present SQL statements if Supabase project needs changing
- Assume `.sql` files may be out-of-date

## Key Reminders
- V16 is a fresh start
- Reference files are in `docs/` folder
- Strict TypeScript compliance required
- No coding until you specify the task and approve the plan
- Use Supabase MCP for database operations
- Follow logging rules in @docs/logging_method.md
- No fallbacks - errors should be visible in beta
- All AI prompts/functions from Supabase tables, not hardcoded

## Adding New AI Functions - CRITICAL PROCESS

  When adding new functions for AI to call, you MUST update THREE locations:
  1. **Implementation**: Add function in `use-mental-health-functions-v16.ts`
  2. **Router**: Add case in switch statement in `use-supabase-functions.ts`
  3. **Registration**: Ensure function definitions are loaded from Supabase