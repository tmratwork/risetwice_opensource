# V17 Voice Settings System

## Overview

The V17 voice settings system allows users to customize how the ElevenLabs conversational AI sounds by adjusting various voice parameters through an Advanced settings modal. These preferences are automatically applied when starting any conversation (Let's Talk, Dr Mattu demo, Dr Judy demo).

## Available Voice Settings

### 🎛️ Voice Quality Settings

#### **Speed Control**
- **Range**: 0.7x - 1.2x
- **Default**: 1.0x (normal speed)
- **Description**: Controls how fast or slow the AI speaks
- **Examples**:
  - 0.7x = Much slower, deliberate speech
  - 1.0x = Normal conversational speed
  - 1.2x = Faster, more energetic speech

#### **Stability**
- **Range**: 0.0 - 1.0
- **Default**: 0.5
- **Description**: Balance between expressiveness and consistency
- **Examples**:
  - 0.0 = More expressive, emotional variations
  - 0.5 = Balanced expression and stability
  - 1.0 = Very consistent, less emotional variation

#### **Similarity Boost**
- **Range**: 0.0 - 1.0
- **Default**: 0.75
- **Description**: Enhances clarity and voice fidelity
- **Examples**:
  - 0.0 = More natural but less clear
  - 0.75 = Good balance of clarity and naturalness
  - 1.0 = Maximum clarity and voice similarity

#### **Style Exaggeration**
- **Range**: 0.0 - 1.0
- **Default**: 0.0
- **Description**: Amplifies the speaker's unique characteristics
- **Examples**:
  - 0.0 = Neutral, natural speech patterns
  - 0.5 = Moderate amplification of voice characteristics
  - 1.0 = Maximum amplification of unique speech patterns

#### **Speaker Boost**
- **Type**: Boolean toggle
- **Default**: false
- **Description**: Enhanced similarity processing (may increase latency)
- **Note**: Provides better voice matching but slightly slower response times

### 🔧 Model & Language Settings

#### **Model Family**
- **Options**:
  - Same as Agent Default
  - Flash (Fastest)
  - Turbo (Balanced)
  - Multilingual (Highest Quality)
- **Default**: Same as Agent Default
- **Description**: Different AI models optimized for speed vs quality

#### **Language**
- **Options**: English, Spanish, French, German, Italian, Portuguese, Japanese, Korean, Chinese
- **Default**: English
- **Description**: Primary language for optimal pronunciation and intonation

## Code Architecture

### Frontend Components

#### **VoiceSettingsModal.tsx**
**Location**: `/src/app/chatbotV17/components/VoiceSettingsModal.tsx`

**Key Features**:
- Modal interface for adjusting all voice settings
- Real-time slider controls for numeric values
- Dropdown selectors for model family and language
- Auto-loads current settings (agent or localStorage preferences)
- Saves preferences to localStorage when no active agent
- Auto-closes modal after saving preferences

**State Management**:
```typescript
interface VoiceSettings {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}
```

#### **Main Page Integration**
**Location**: `/src/app/chatbotV17/page.tsx`

- Advanced link positioned below Terms of Service
- Opens VoiceSettingsModal when clicked
- Modal appears with high z-index (9999) to overlay all elements

### Backend APIs

#### **Agent Creation API**
**Location**: `/src/app/api/v17/agents/create/route.ts`

**Key Functions**:
- Accepts `voicePreferences` parameter in request body
- Applies user preferences or falls back to defaults
- Configures ElevenLabs agent with custom voice settings

**Voice Configuration Logic**:
```typescript
// Load user preferences or use defaults
const defaultVoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
  speed: 1.0
};

const voiceSettings = voicePreferences?.voice_settings || defaultVoiceSettings;
const modelFamily = voicePreferences?.model_family || 'eleven_turbo_v2';
const language = voicePreferences?.language || 'en';

// Apply to ElevenLabs agent configuration
const voiceConfig = {
  voice_id: voiceId,
  model_id: modelFamily === 'same_as_agent' ? 'eleven_turbo_v2' : modelFamily,
  stability: voiceSettings.stability,
  similarity_boost: voiceSettings.similarity_boost,
  style: voiceSettings.style,
  use_speaker_boost: voiceSettings.use_speaker_boost,
  speed: voiceSettings.speed,
  ...(language !== 'en' && { language })
};
```

#### **Voice Settings Update API**
**Location**: `/src/app/api/v17/voice-settings/route.ts`

**Endpoints**:
- `PUT`: Update active agent voice settings
- `GET`: Retrieve current agent voice settings

**API Structure**:
```typescript
// Update payload uses conversation_config.tts structure
const updatePayload = {
  conversation_config: {
    tts: {
      ...voice_settings,
      ...(model_family && model_family !== 'same_as_agent' && { model_id: model_family }),
      ...(language && { language })
    }
  }
};
```

### Frontend-Backend Integration

#### **ElevenLabs Conversation Hook**
**Location**: `/src/hooksV17/use-elevenlabs-conversation.ts`

**Preference Loading Process**:
```typescript
// 1. Load saved voice preferences from localStorage
let voicePreferences = null;
try {
  const savedPrefs = localStorage.getItem('v17_voice_preferences');
  if (savedPrefs) {
    voicePreferences = JSON.parse(savedPrefs);
  }
} catch (error) {
  // Handle parsing errors
}

// 2. Pass preferences to agent creation
const agentResponse = await fetch('/api/v17/agents/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    specialistType,
    userId: user?.uid || null,
    voiceId: demoVoiceId || 'EmtkmiOFoQVpKRVpXH2B',
    demoPromptAppend,
    voicePreferences // ✅ Preferences passed to API
  })
});
```

## User Flow

### 1. Setting Voice Preferences
1. User clicks "Advanced" link on main page
2. Voice Settings Modal opens
3. User adjusts sliders and dropdowns
4. User clicks "Save as Preferences"
5. Settings saved to `localStorage` as `v17_voice_preferences`
6. Modal auto-closes after 1.5 seconds

### 2. Starting Conversations
1. User clicks "Let's Talk", "Talk with Dr Mattu", or "Talk with Dr Judy"
2. `startSession()` called in ElevenLabs conversation hook
3. Hook loads preferences from `localStorage`
4. Agent creation API called with preferences
5. ElevenLabs agent configured with user's custom settings
6. Conversation starts with personalized voice

### 3. Updating Active Agent
1. User opens Advanced settings during active conversation
2. Modal loads current agent settings (not localStorage)
3. User adjusts settings and clicks "Save Settings"
4. Voice settings API updates active ElevenLabs agent
5. Changes apply immediately to ongoing conversation

## Storage Structure

### localStorage Format
**Key**: `v17_voice_preferences`

**Structure**:
```json
{
  "voice_settings": {
    "speed": 1.2,
    "stability": 0.5,
    "similarity_boost": 0.75,
    "style": 0.1,
    "use_speaker_boost": false
  },
  "model_family": "turbo",
  "language": "en",
  "saved_at": "2025-01-20T10:30:00.000Z"
}
```

### ElevenLabs Agent Configuration
**Structure**: `conversation_config.tts`
```json
{
  "conversation_config": {
    "tts": {
      "voice_id": "EmtkmiOFoQVpKRVpXH2B",
      "model_id": "eleven_turbo_v2",
      "stability": 0.5,
      "similarity_boost": 0.75,
      "style": 0.0,
      "use_speaker_boost": true,
      "speed": 1.0,
      "language": "en"
    }
  }
}
```

## Key Benefits

### For Users
- **Persistent preferences**: Settings saved across browser sessions
- **Immediate application**: Preferences apply to all new conversations
- **Real-time updates**: Changes to active agents apply instantly
- **No regeneration needed**: All settings work with existing cloned voices

### For Developers
- **Clean separation**: Frontend preferences, backend application
- **Fallback defaults**: System works without saved preferences
- **Comprehensive logging**: Full traceability of preference application
- **API flexibility**: Supports both preference-based and direct voice configuration

## Troubleshooting

### Common Issues

**Voice settings not applying**:
- Check browser console for localStorage errors
- Verify `ELEVENLABS_API_KEY` is configured
- Ensure agent creation logs show preferences being applied

**Settings modal not opening**:
- Check z-index conflicts (modal uses 9999)
- Verify Advanced button click handlers
- Check for JavaScript errors in browser console

**Preferences not persisting**:
- Check localStorage permissions
- Verify JSON parsing/stringification
- Ensure preferences are being saved before modal closes

### Debug Information

Enable V17 logging to see detailed voice preference application:
```bash
NEXT_PUBLIC_ENABLE_V17_LOGS=true
```

**Key log messages**:
- `📖 Loaded voice preferences from localStorage`
- `🎛️ Voice configuration applied`
- `✅ ElevenLabs agent updated successfully`

## Future Enhancements

### Potential Additions
- **Voice preview**: Test settings before saving
- **Preset profiles**: Save multiple voice configurations
- **Per-specialist settings**: Different voices for different AI specialists
- **Advanced pronunciation**: Custom phoneme dictionaries
- **Voice cloning**: Upload custom voice samples

### API Extensibility
The current architecture easily supports additional voice parameters by:
1. Adding new fields to `VoiceSettings` interface
2. Including them in localStorage format
3. Passing them through the agent creation pipeline
4. Applying them in ElevenLabs API calls