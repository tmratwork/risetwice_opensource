# Plan to Remove ChatbotV11

## Security Status
✅ **V11 is SECURE** - Uses the same ephemeral token approach as V15 and V16:
- Server-side `/api/v11/session` endpoint uses `process.env.OPENAI_API_KEY` (never exposed to client)
- Returns ephemeral token (`client_secret.value`) to the client
- Client uses ephemeral token for WebRTC connection via `Authorization: Bearer ${ephemeralToken}`
- No API key exposure to the browser

## Current Status
V11 cannot be safely deleted yet. V16 (the active version) has multiple dependencies on V11 components, styles, and utilities.

## V16 Dependencies on V11

### 1. Constants and Configuration
**Location**: `/src/app/chatbotV16/page.tsx`
- Imports `DEFAULT_VOICE` and `DEFAULT_TOOL_CHOICE` from `../chatbotV11/prompts`
- These constants are defined in `/src/app/chatbotV11/prompts/instructions.ts`:
  - `DEFAULT_VOICE = "alloy"`
  - `DEFAULT_TOOL_CHOICE = "auto"`

### 2. UI Components
**Location**: Various V16 pages
- `MapResourcesDisplay` - imported in `/src/app/chatbotV16/page.tsx`
- `FuturesPathwaysCards` - imported in `/src/app/chatbotV16/future-pathways/page.tsx`

### 3. Styles
**Location**: V16 sub-pages
- `/src/app/chatbotV16/sleep/page.tsx` imports `../../chatbotV11/chatbotV11.css`
- `/src/app/chatbotV16/mental-health/page.tsx` imports `../../chatbotV11/chatbotV11.css`

### 4. API Routes
- `/api/v11/resource-search/` - Still actively used for resource searching functionality
- Other V11 API routes may still be in use

## Migration Steps Required

To safely remove V11, the following steps must be completed:

### Step 1: Migrate Constants
- [ ] Create `/src/app/chatbotV16/prompts/constants.ts`
- [ ] Move `DEFAULT_VOICE` and `DEFAULT_TOOL_CHOICE` to V16
- [ ] Update imports in V16 pages

### Step 2: Migrate Components
- [ ] Copy `MapResourcesDisplay` component to `/src/app/chatbotV16/components/`
- [ ] Copy `FuturesPathwaysCards` component to `/src/app/chatbotV16/components/`
- [ ] Update all imports to use V16 versions

### Step 3: Migrate Styles
- [ ] Copy `chatbotV11.css` to `/src/app/chatbotV16/styles/`
- [ ] Rename to `chatbotV16.css` or `shared.css`
- [ ] Update style imports in:
  - `/src/app/chatbotV16/sleep/page.tsx`
  - `/src/app/chatbotV16/mental-health/page.tsx`

### Step 4: Migrate API Routes
- [ ] Identify all V11 API routes still in use by V16
- [ ] Create V16 versions of required API routes
- [ ] Update V16 to use new API endpoints

### Step 5: Test and Verify
- [ ] Test all V16 functionality after migration
- [ ] Verify no broken imports or missing dependencies
- [ ] Check that WebRTC connections still work
- [ ] Test resource search functionality
- [ ] Test mental health and sleep features

### Step 6: Clean Up
- [ ] Remove all V11 files and directories
- [ ] Remove V11-specific hooks (`/src/hooksV11/`)
- [ ] Clean up any V11 references in shared utilities

## Files/Directories to Remove (After Migration)

```
/src/app/chatbotV11/              # Entire V11 app directory
/src/app/api/v11/                 # All V11 API routes
/src/hooksV11/                    # V11-specific hooks
```

## Risk Assessment

**Low Risk**: 
- Moving constants and styles

**Medium Risk**: 
- Migrating UI components (may have hidden dependencies)

**High Risk**: 
- API route migration (may affect data flow and functionality)
- Resource search functionality is critical and must be tested thoroughly

## Recommendation

**DO NOT DELETE V11 YET**

Complete the migration steps methodically, testing each change before proceeding. V11 serves as the foundation for V16's functionality, and premature removal could break critical features.

## Notes

- V15 also exists but appears to be less used than V16
- V16 is currently the active version being used in production
- The WebRTC implementation has already been secured (uses ephemeral tokens, not exposed API keys)