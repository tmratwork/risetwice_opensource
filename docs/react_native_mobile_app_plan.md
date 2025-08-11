docs/react_native_mobile_app_plan.md

# React Native Mobile App Plan for RiseTwice ChatbotV16

## Overview
Create a React Native mobile application focused exclusively on the chatbotV16 functionality (`http://localhost:3000/chatbotV16`), excluding community and resources features to create a streamlined mobile experience.

## Core Features to Include

### Primary Chat Interface
- Real-time AI conversation with WebRTC audio
- Audio Orb UI with voice interaction and visual feedback
- Smart Send functionality with message buffering
- Conversation history and message persistence
- Session management (start/resume conversations)

### Specialized Chat Modes
- **Mental Health**: AI-powered mental health support
- **Future Pathways**: Career and life guidance
- **Sleep**: Sleep improvement assistance
- Main triage AI for general conversations

### User Management
- Firebase authentication integration
- Anonymous user support
- User profile and memory management
- Language preference settings
- Session tracking and usage analytics

### Admin & Debug Tools
- Admin interface for prompts and greetings management
- Memory processing and management
- Usage statistics and conversation analysis
- Debug panels for development

## Excluded Features
- Community circles, posts, comments, and reactions
- Resource locator and search functionality
- Community insights page
- QR code generators and circle sharing
- Moderation and reporting tools

## Technology Stack

### Core Framework
- **React Native**: Cross-platform mobile development
- **TypeScript**: Type safety and development experience
- **TypeScript Configuration**: Isolated mobile config to prevent build conflicts
- **Type Safety**: Cross-platform compatible type definitions
- **React Navigation**: Screen navigation and routing

### State Management & Data
- **Zustand**: Existing WebRTC store and state management
- **Supabase**: Database operations and real-time features (uses exact same tables as web app)
- **Firebase**: Authentication and user management

#### Shared Database Architecture
The React Native app uses the **exact same Supabase tables** as the web application, providing:
- **Cross-platform data continuity**: Start conversations on web, continue on mobile
- **Unified user profiles**: User memory and preferences persist across platforms
- **Same AI behavior**: Identical prompts, functions, and specialist configurations
- **Real-time sync**: Changes made on one platform immediately available on the other
- **No data duplication**: Single source of truth for all user data and conversations

### Audio & Communication
- **WebRTC**: Real-time voice communication
- **React Native Voice**: Speech-to-text capabilities
- **Audio recording libraries**: For voice message capture

### UI & Styling
- **NativeWind**: Tailwind CSS for React Native
- **React Native Vector Icons**: Icon library
- **React Native Reanimated**: Smooth animations for audio orb

## Project Architecture

```
mobile/
├── src/
│   ├── components/
│   │   ├── AudioOrb/
│   │   │   ├── AudioOrbV16.tsx
│   │   │   └── OrbVisualization.tsx
│   │   ├── Chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── ConversationHistory.tsx
│   │   ├── Navigation/
│   │   │   ├── TabNavigator.tsx
│   │   │   └── StackNavigator.tsx
│   │   └── Common/
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorBoundary.tsx
│   ├── screens/
│   │   ├── ChatScreen.tsx
│   │   ├── MentalHealthScreen.tsx
│   │   ├── FuturePathwaysScreen.tsx
│   │   ├── SleepScreen.tsx
│   │   ├── MemoryScreen.tsx
│   │   ├── AdminScreen.tsx
│   │   └── AuthScreen.tsx
│   ├── hooks/ (reuse from V16)
│   │   ├── useSupabaseFunctions.ts
│   │   ├── useWebRTCStore.ts
│   │   └── useFunctionRegistration.ts
│   ├── stores/
│   │   └── webrtc-store.ts (adapted for mobile)
│   ├── services/
│   │   ├── api/
│   │   ├── audio/
│   │   └── storage/
│   ├── utils/
│   │   ├── permissions.ts
│   │   └── audioUtils.ts
│   └── types/
│       └── index.ts
├── android/
├── ios/
└── package.json
```

## TypeScript Configuration

### Cross-Platform Type Safety
- **Separate `tsconfig.json`** for mobile project in `/mobile` folder
- **Web app excludes mobile folder**: `"exclude": ["node_modules", "mobile"]` in root tsconfig
- **Handle FormData type differences** between web and mobile environments
- **Use `ReturnType<typeof setTimeout>`** for cross-platform timeout compatibility
- **Isolated dependency management** prevents type conflicts between platforms

### Mobile-Specific TypeScript Setup
```json
// mobile/tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "strict": true
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Root TypeScript Configuration
```json
// Root tsconfig.json (for Next.js web app)
{
  "compilerOptions": { /* ... */ },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "mobile"]  // ← Excludes mobile folder
}
```

## Key Components to Extract from Web App

### Core Files to Adapt
- `src/app/chatbotV16/page.tsx` → Main chat interface
- `src/app/chatbotV16/components/AudioOrbV15.tsx` → Audio orb component
- `src/stores/webrtc-store.ts` → State management
- `src/hooksV16/` → All V16 hooks and utilities
- `src/app/api/v16/` → API endpoints (reference for mobile API calls)

### Supabase Integration
- User profile management
- Conversation history
- AI prompts and functions
- Memory processing
- Usage tracking

### WebRTC Implementation
- Real-time audio streaming
- Voice activity detection
- Audio muting/unmuting
- Connection management

## Implementation Phases

### Phase 1: Project Setup & Core Structure
1. Initialize React Native project with TypeScript
2. Set up navigation structure (Tab + Stack navigators)
3. Configure development environment for iOS/Android
4. Install and configure core dependencies

### Phase 2: Authentication & User Management
1. Implement Firebase authentication
2. Create login/signup screens
3. Add anonymous user support
4. Set up user profile management

### Phase 3: Core Chat Interface
1. Extract and adapt main chat component from V16
2. Implement message display and conversation history
3. Add typing indicators and status messages
4. Create responsive mobile layout

### Phase 4: Audio Integration
1. Adapt AudioOrbV15 component for React Native
2. Implement WebRTC for mobile platforms
3. Add voice recording and playback
4. Handle mobile audio permissions

### Phase 5: Specialized Chat Modes
1. Mental Health chat mode
2. Future Pathways guidance
3. Sleep assistance mode
4. Mode switching and navigation

### Phase 6: State Management & Data Persistence
1. Adapt Zustand WebRTC store for mobile
2. Implement local storage for offline capability
3. Add conversation persistence
4. Sync with Supabase backend

### Phase 7: Admin & Debug Features
1. Admin screens for prompt management
2. Memory management interface
3. Debug panels for development
4. Usage statistics display

### Phase 8: Polish & Optimization
1. Performance optimization
2. Animation improvements
3. Error handling and user feedback
4. Accessibility features

## Mobile-Specific Considerations

### Audio Handling
- Request microphone permissions on app launch
- Handle audio interruptions (calls, other apps)
- Optimize for battery usage during long conversations
- Support for Bluetooth headsets and AirPods

### UI/UX Adaptations
- Touch-optimized interface design
- Swipe gestures for navigation
- Pull-to-refresh for conversation history
- Modal-based admin interfaces

### Performance
- Lazy loading for conversation history
- Efficient audio streaming
- Background processing limitations
- Memory management for long conversations

### Platform-Specific Features
- iOS: Siri integration potential
- Android: Background processing capabilities
- Push notifications for important updates
- Deep linking support

## API Integration

### Existing V16 Endpoints to Use
- `/api/v16/start-session` - Initialize chat sessions
- `/api/v16/save-message` - Persist conversation messages
- `/api/v16/load-prompt` - Get AI prompts
- `/api/v16/load-functions` - Get executable functions
- `/api/v16/process-memory` - User memory processing
- `/api/v16/greeting-prompt` - Get localized greetings

### Mobile-Specific API Needs
- Device registration for analytics
- Mobile-optimized response formats
- Efficient batch operations for offline sync
- Push notification endpoints

## Deployment Strategy

### Development
- Expo development build for rapid iteration
- iOS Simulator and Android Emulator testing
- TestFlight for iOS beta testing
- Google Play Internal Testing for Android

### Production
- App Store Connect for iOS release
- Google Play Console for Android release
- Over-the-air updates for quick fixes
- Analytics integration for user behavior tracking

## Success Metrics

### Technical Metrics
- App startup time < 3 seconds
- Audio latency < 200ms
- 99%+ WebRTC connection success rate
- Crash rate < 1%

### User Experience Metrics
- Average session duration
- Conversation completion rates
- User retention (1-day, 7-day, 30-day)
- Feature adoption rates for different chat modes

## Risks & Mitigation

### Technical Risks
- **WebRTC mobile compatibility**: Extensive testing on different devices
- **Audio quality issues**: Fallback audio processing options
- **Battery drain**: Optimize audio processing and connection management
- **App store approval**: Follow platform guidelines carefully

### Development Risks
- **Complexity of V16 codebase**: Gradual extraction and testing
- **Real-time features**: Thorough testing of WebRTC implementation
- **Cross-platform differences**: Platform-specific testing and fixes

## Timeline Estimate

- **Phase 1-2**: 2-3 weeks (Setup & Auth)
- **Phase 3-4**: 4-5 weeks (Core Chat & Audio)
- **Phase 5-6**: 3-4 weeks (Specialized Modes & State)
- **Phase 7-8**: 2-3 weeks (Admin & Polish)
- **Testing & Deployment**: 2-3 weeks

**Total Estimated Timeline: 13-18 weeks**

## Next Steps

1. **Approve this plan** and make any necessary adjustments
2. **Set up development environment** for React Native
3. **Begin Phase 1** with project initialization
4. **Create detailed technical specifications** for each component
5. **Set up CI/CD pipeline** for automated testing and deployment

This mobile app will provide users with a focused, streamlined experience for AI-powered conversations while maintaining all the core functionality that makes RiseTwice's chatbotV16 powerful and effective.