docs/multilingual_language_management.md

# Multilingual Language Management System

## Overview

The V16 chatbot implements a comprehensive multilingual language management system that supports 57 languages through dynamic language preferences, auto-translation capabilities, and database-driven multilingual content management.

## Architecture

### Core Components

1. **Language Preference System** (`/src/lib/language-utils.ts`)
2. **Database Schema** (`greeting_resources` table)
3. **API Layer** (`/src/app/api/v16/`)
4. **Frontend Language Selector** (`/src/components/header.tsx`)
5. **Admin Interface** (`/src/app/chatbotV16/admin/greetings/`)

## Supported Languages

The system supports 57 languages as defined by the GPT-4o Realtime API:

```typescript
// Core languages include:
- English (en) - Default
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Russian (ru)
- Chinese Mandarin (zh)
- Japanese (ja)
- Korean (ko)
- Arabic (ar)
- Hindi (hi)
// ... and 45 more languages
```

## Database Schema

### `greeting_resources` Table

```sql
CREATE TABLE greeting_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  greeting_type TEXT NOT NULL,
  language_code TEXT NOT NULL,
  greeting_content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(greeting_type, language_code, is_active) DEFERRABLE INITIALLY DEFERRED
);
```

### Greeting Types

- `resources` - Resource Locator greeting
- `triage` - Triage AI initial greeting
- `crisis` - Crisis support greeting
- `general` - General support greeting

## API Endpoints

### Core APIs

#### `/api/v16/greeting-prompt`
Fetches greeting content for a specific type and language.

**Parameters:**
- `type` - Greeting type (required)
- `language` - Language code (optional, defaults to 'en')
- `userId` - User ID (optional)

**Example:**
```
GET /api/v16/greeting-prompt?type=resources&language=es&userId=123
```

#### `/api/v16/load-prompt`
Loads AI prompts with dynamic language injection.

**Parameters:**
- `type` - Prompt type (required)
- `language` - Language preference (optional)
- `userId` - User ID (optional)

### Admin APIs

#### `/api/v16/admin/greetings`
CRUD operations for greeting management.

- `GET` - List all greetings
- `POST` - Create new greeting
- `PUT` - Update existing greeting
- `DELETE` - Delete greeting

#### `/api/v16/admin/greetings/translate`
Auto-translation endpoint using GPT-4o.

**Request Body:**
```json
{
  "greeting_type": "resources",
  "source_language": "en",
  "overwrite_existing": false
}
```

**Features:**
- Batch processing (5 languages per batch)
- Rate limiting (1-second delays)
- Mental health-focused translation prompts
- Comprehensive error handling

## Frontend Implementation

### Language Selector

Located in the header dropdown menu (`/src/components/header.tsx`):

```typescript
const handleLanguageSelect = (languageCode: string) => {
  setSelectedLanguage(languageCode);
  setStoredLanguagePreference(languageCode);
  window.dispatchEvent(new CustomEvent('languageChanged', {
    detail: { languageCode }
  }));
};
```

### Language Persistence

Uses localStorage for client-side persistence:

```typescript
// Set language preference
setStoredLanguagePreference(languageCode);

// Get current preference
const preference = getStoredLanguagePreference(); // defaults to 'en'
```

### Dynamic Language Updates

The system listens for language changes and automatically:

1. **Reloads triage prompts** with new language
2. **Regenerates resource greetings** if a resource is selected
3. **Updates all future API calls** to use new language preference

## Admin Interface

### Location
`http://localhost:3000/chatbotV16/admin/greetings`

### Features

1. **Greeting Management**
   - View/Edit/Delete greetings by type and language
   - Create new greetings for any type/language combination
   - Real-time preview of greeting content

2. **Auto-Translation**
   - One-click translation from English to 56 other languages
   - Cost estimation and confirmation dialogs
   - Real-time progress tracking with detailed results
   - Batch processing with rate limit handling

3. **Statistics Dashboard**
   - Total greetings count
   - Available languages count
   - Available greeting types count

## Language Change Flow

### User Experience
1. User selects language from header dropdown
2. UI immediately updates to show selected language
3. Language preference saved to localStorage
4. `languageChanged` event dispatched

### System Response
1. **Triage Prompt Reload**: New triage prompt fetched in selected language
2. **Resource Greeting Regeneration**: If resource selected, greeting regenerated
3. **Future API Calls**: All subsequent calls use new language preference

### Code Implementation

```typescript
// Language change handler in V16 page component
const handleLanguageChange = (event: Event) => {
  const customEvent = event as CustomEvent<{ languageCode: string }>;
  const newLanguageCode = customEvent.detail.languageCode;
  
  // Reload triage prompt
  const fetchTriagePrompt = async () => {
    const apiUrl = `/api/v16/load-prompt?type=triage&userId=${user?.uid}&language=${newLanguageCode}`;
    // ... API call logic
  };
  
  // Regenerate resource greeting if applicable
  const regenerateResourceGreeting = async () => {
    if (resourceLocatorContext?.selectedResource) {
      const newResourceGreeting = await getResourceWelcomeContent(
        resourceLocatorContext.selectedResource, 
        user?.uid
      );
      setResourceGreeting(newResourceGreeting);
    }
  };
  
  fetchTriagePrompt();
  regenerateResourceGreeting();
};
```

## Translation System

### GPT-4o Integration

The auto-translation system uses OpenAI's GPT-4o model with specialized prompts:

```typescript
const systemPrompt = `You are a professional translator specializing in mental health and wellness communications. Your task is to translate greetings for a mental health support application.

IMPORTANT GUIDELINES:
- Maintain the warm, supportive, and professional tone of the original
- Preserve the conversational and approachable nature
- Use culturally appropriate language for mental health contexts
- Ensure the translation feels natural to native speakers
- Maintain any formatting (line breaks, punctuation style)
- Do not add or remove meaning - translate faithfully
- Use professional but accessible language (avoid overly clinical terms)

The greeting is used when users first interact with mental health support AI, so it should be welcoming and reduce barriers to seeking help.`;
```

### Batch Processing

```typescript
// Process translations in batches to avoid rate limits
const BATCH_SIZE = 5;
const batches = [];
for (let i = 0; i < targetLanguages.length; i += BATCH_SIZE) {
  batches.push(targetLanguages.slice(i, i + BATCH_SIZE));
}

// 1-second delay between batches
if (batchIndex < batches.length - 1) {
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

## Error Handling Philosophy

### Breaking Errors (No Silent Fallbacks)

The system follows a "breaking error" philosophy - configuration errors are made visible rather than hidden:

```typescript
// Example: No fallback content when greeting is missing
if (!greetingData) {
  throw new Error(`No greeting data returned for type '${greetingType}' in language '${languagePreference}'`);
}
```

### User-Friendly Error Messages

```typescript
const errorMessage = `No active greeting found for type '${greetingType}' in language '${languagePreference}'. Please create this greeting in the admin interface at /chatbotV16/admin/greetings`;
```

## Logging and Debugging

### Environment Variables

```bash
# Enable detailed language-related logging
NEXT_PUBLIC_ENABLE_GREETING_LOGS=true
NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS=true
NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS=true
```

### Log Categories

- `[greeting_api]` - API-level greeting operations
- `[triage_handoff]` - Language changes and prompt reloading
- `[resource_greeting]` - Resource-specific greeting generation
- `[greeting_translate]` - Auto-translation operations

## Configuration Files

### Language Utilities (`/src/lib/language-utils.ts`)

Central configuration for all supported languages:

```typescript
export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  // ... 55 more languages
];
```

### Prompt Enhancement (`/src/app/api/v16/utils/language-prompt.ts`)

Dynamic language injection for AI prompts with strengthened instructions to prevent first message language issues:

```typescript
/**
 * Single source of truth for language instruction template
 * STRENGTHENED to fix first message language issues
 */
export const LANGUAGE_INSTRUCTION_TEMPLATE = `CRITICAL LANGUAGE REQUIREMENT: You MUST respond in \${languageName} ONLY. Your first message and all subsequent messages must be in \${languageName}. This is mandatory and cannot be overridden. The user has specifically selected \${languageName} as their preferred language.

GREETING PROTOCOL: Your very first message must be in \${languageName}.

`;

export function enhancePromptWithLanguage(basePrompt: string, languageCode: string): string {
  const languageName = formatLanguageForPrompt(languageCode);
  
  // Use the single source of truth template and replace placeholder
  const languageInstruction = LANGUAGE_INSTRUCTION_TEMPLATE.replace(/\$\{languageName\}/g, languageName);

  // Inject language instruction at the beginning of the prompt for maximum visibility
  return languageInstruction + basePrompt;
}
```

## Best Practices

### Adding New Languages

1. Add language to `SUPPORTED_LANGUAGES` array
2. Create English greeting for the new context
3. Use auto-translation to generate other language versions
4. Test with actual native speakers when possible

### Creating New Greeting Types

1. Add new type to admin interface dropdown
2. Create English version first
3. Use auto-translation for other languages
4. Update API endpoints if needed

### Managing Translations

1. Always create English version first (source language)
2. Use auto-translation for bulk generation
3. Review and edit translations for cultural appropriateness
4. Test with native speakers for key languages

## Troubleshooting

### Common Issues

1. **Missing Greeting Error**
   - **Cause**: No greeting exists for the selected language/type combination
   - **Solution**: Create greeting via admin interface or use auto-translation

2. **Translation API Failures**
   - **Cause**: OpenAI API rate limits or authentication issues
   - **Solution**: Check API keys, implement retry logic, reduce batch size

3. **Language Not Persisting**
   - **Cause**: localStorage issues or event listener problems
   - **Solution**: Check browser console, verify event dispatch/listening

### Debug Steps

1. Check environment variables for logging
2. Verify database has required greetings
3. Test API endpoints directly
4. Check browser localStorage for language preference
5. Monitor network requests for language parameters

## Security Considerations

### Row Level Security (RLS)

```sql
-- Example RLS policy for greeting_resources
CREATE POLICY "Public read access for greeting_resources" 
ON greeting_resources FOR SELECT 
TO public 
USING (is_active = true);
```

### Admin Access Control

```typescript
// Admin check in greeting management interface
const isAdmin = user?.uid === "ADMIN_UID_HERE";
```

## Performance Optimization

### Caching Strategy

- Client-side: localStorage for language preferences
- Server-side: Consider Redis for frequently accessed greetings
- CDN: Static translation files for common greetings

### Database Optimization

- Index on `(greeting_type, language_code, is_active)`
- Regular cleanup of inactive greetings
- Monitor query performance for translation endpoints

## Future Enhancements

### Planned Features

1. **Translation Quality Scoring**
   - Human review system for translations
   - Quality metrics and feedback loops

2. **Context-Aware Translations**
   - User demographic-based language variations
   - Cultural context adaptation

3. **Real-time Translation**
   - Live translation during conversations
   - Multi-language support within single session

4. **Analytics Dashboard**
   - Language usage statistics
   - Translation effectiveness metrics
   - User preference trends

### Technical Improvements

1. **Caching Layer**
   - Redis integration for greeting caching
   - Edge caching for common translations

2. **Background Processing**
   - Queue system for bulk translations
   - Scheduled translation updates

3. **Version Control**
   - Translation versioning system
   - Rollback capabilities for greeting changes

## Anonymous User Language Handling

### Current Implementation (V16)

For non-signed-in users, we completely ignore localStorage and always use English. This eliminates any possibility of language contamination from previous sessions.

**Key Design Decisions:**
- Anonymous users have no language selection UI, so they should always get English
- localStorage can contain residual language preferences from previous authenticated sessions
- This was causing "2 out of 10" non-English AI responses for anonymous users
- Simple solution: Force English for all non-authenticated users

**Code Implementation:**
```typescript
// In getStoredLanguagePreference(isAuthenticated?: boolean)
if (isAuthenticated === false) {
  // ALWAYS return 'en' for anonymous users, ignore localStorage completely
  return DEFAULT_LANGUAGE;
}
```

### Future Enhancements (TODO)

**Smarter Anonymous Language Detection:**
Someday perhaps we develop a smarter way to know which language AI should present that will work better for non-EN non-signed-in users. Potential approaches could include:

1. **Browser Language Detection**
   - Use `navigator.language` and `navigator.languages` for initial language guess
   - Validate against supported languages list
   - Require user confirmation before using non-English

2. **Geographic Location Detection**
   - IP-based location detection for regional language preferences
   - Country-specific language defaults
   - Privacy-compliant implementation

3. **Progressive Language Discovery**
   - Allow anonymous users to select language without requiring authentication
   - Store preference in session storage (not persistent localStorage)
   - Clear preference when session ends

4. **AI-Powered Language Detection**
   - Analyze user's first message for language clues
   - Switch language mid-conversation if detected
   - Maintain conversation continuity

**Implementation Considerations:**
- Must maintain mental health context appropriateness
- Privacy implications of language detection methods
- Performance impact of detection algorithms
- Fallback mechanisms for edge cases
- User experience during language transitions

**Current Status:** Not prioritized. Today we keep it simple - all non-signed-in users are EN only.

## Recent Fixes and Improvements (August 2025)

### Issue: First Message Language Problem

**Problem Identified:**
The AI was sometimes responding in the wrong language for the first message, despite proper language preferences being set. This occurred for both signed-in users (who had selected a specific language) and anonymous users (who should always get English).

**Root Cause Analysis:**
1. **Race Condition Timing**: The OpenAI Realtime API was generating an immediate response before fully processing language instructions
2. **Weak Language Instructions**: Original language instructions were too mild ("IMPORTANT: Always communicate in [language]")
3. **English Language Enhancement Skip Bug**: Language enhancement was being skipped for English users, assuming they didn't need explicit language instructions

### Solution Implemented

#### 1. **Established Single Source of Truth**
- **Created**: `LANGUAGE_INSTRUCTION_TEMPLATE` in `/src/app/api/v16/utils/language-prompt.ts`
- **Eliminated**: Hardcoded duplication in admin interface
- **Result**: Consistent language instruction management across the application

#### 2. **Strengthened Language Instructions**
**Before:**
```
IMPORTANT: Always communicate in [language] unless the user explicitly requests a different language.
```

**After:**
```
CRITICAL LANGUAGE REQUIREMENT: You MUST respond in [language] ONLY. Your first message and all subsequent messages must be in [language]. This is mandatory and cannot be overridden. The user has specifically selected [language] as their preferred language.

GREETING PROTOCOL: Your very first message must be in [language].
```

#### 3. **Fixed English Language Enhancement Skip Bug**
**Problem**: Language enhancement was conditionally skipped for English users:
```typescript
// BUGGY: Only enhanced for non-English languages
if (languagePreference && languagePreference !== 'en') {
  finalContent = enhancePromptWithLanguage(finalContent, languagePreference);
} else if (languagePreference === 'en') {
  // Separate inconsistent path for English
}
```

**Solution**: Always inject language instructions for ALL languages:
```typescript
// FIXED: ALWAYS inject language instructions, even for English
if (languagePreference) {
  finalContent = enhancePromptWithLanguage(finalContent, languagePreference);
}
```

#### 4. **Enhanced Logging for Debugging**
Following `docs/logging_method.md` rules with consistent `[multilingual_support]` prefix:

- **Language preference retrieval** (anonymous vs signed users)
- **Language instruction creation and injection**
- **Prompt enhancement timing and content**
- **Full enhanced prompt previews** sent to AI

### Current Status

**✅ Initial Testing Results**: AI working correctly in initial tests
**⚠️ Monitoring Needed**: More extensive testing required to confirm complete resolution

### Logging Mystery (Unresolved)

**Issue**: Server-side logs from `enhancePromptWithLanguage()` function are not appearing in browser console, despite:
- Client-side evidence showing language enhancement is working
- Server-side instruction content confirming enhancement is applied
- Other server-side logs appearing normally

**Evidence Enhancement is Working**:
- Client logs show: `promptContentPreview: "CRITICAL LANGUAGE REQUIREMENT: You MUST respond in..."`
- Server response contains: `"CRITICAL LANGUAGE REQUIREMENT: You MUST respond in English ONLY..."`

**Mystery**: Why are the specific server-side logs from the `enhancePromptWithLanguage()` function not appearing in the browser console when other server-side logs do appear?

**Current Impact**: None - the functionality works correctly, but debugging visibility is limited.

### Debugging Environment

**Enable Logging:**
```bash
# .env.local
NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS=true
```

**Key Log Patterns to Monitor:**
- `👤 SIGNED USER LANGUAGE PREFERENCE` - Language preference detection
- `🔒 ANONYMOUS USER LANGUAGE ENFORCEMENT` - Anonymous user English enforcement
- `🔧 LANGUAGE INJECTION` - Language instruction creation (currently missing from browser console)
- `✅ LANGUAGE INJECTION` - Enhanced prompt creation (currently missing from browser console)
- `promptContentPreview: "CRITICAL LANGUAGE REQUIREMENT"` - Evidence enhancement applied

### Testing Checklist

To validate the fix works consistently:

1. **Anonymous Users** (should always get English):
   - Test multiple sessions
   - Clear localStorage between tests
   - Verify first message is always English

2. **Signed Users with English Preference**:
   - Test first message remains English
   - No language switching during conversation

3. **Signed Users with Non-English Preference**:
   - Test first message matches selected language
   - Verify language consistency throughout conversation
   - Test language changes mid-session

4. **Edge Cases**:
   - User switches language then immediately starts conversation
   - Browser localStorage corruption/clearing
   - Network timing issues during language preference loading

**Current Status:** Initial tests successful, extended testing in progress.

## Conclusion

The V16 multilingual language management system provides a comprehensive solution for supporting 57 languages with dynamic preference management, auto-translation capabilities, and robust admin tooling. The system follows best practices for mental health applications with appropriate error handling, cultural sensitivity, and user experience optimization.

For anonymous users, the system prioritizes reliability and consistency by enforcing English-only interactions, eliminating the complexity and potential issues of cross-session language contamination.