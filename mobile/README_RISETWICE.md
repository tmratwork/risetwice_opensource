# RiseTwice Mobile App

A React Native mobile application for RiseTwice's ChatbotV16 functionality, providing AI-powered conversations with real-time audio and specialized support modes.

## Features

### Core Features
- **Real-time AI Conversations**: WebRTC-powered voice chat with OpenAI's Realtime API
- **Audio Orb Interface**: Interactive voice visualization with touch controls
- **Specialized Chat Modes**: Mental Health, Future Pathways, and Sleep assistance
- **Cross-platform Data Sync**: Shared Supabase database with web application
- **Firebase Authentication**: Anonymous and email-based user authentication

### Specialized Modes
- **Mental Health**: AI-powered mental health support and guidance
- **Future Pathways**: Career and life guidance conversations
- **Sleep**: Sleep improvement assistance and recommendations
- **Memory Management**: User profile and conversation memory persistence

## Technology Stack

- **React Native 0.80.2**: Cross-platform mobile framework
- **TypeScript**: Type-safe development
- **React Navigation 7**: Screen navigation and routing
- **Zustand**: State management for WebRTC and app state
- **Firebase**: User authentication and analytics
- **Supabase**: Real-time database and backend services
- **WebRTC**: Real-time voice communication
- **NativeWind**: Tailwind CSS styling for React Native

## Prerequisites

- Node.js >= 18
- React Native CLI
- iOS development: Xcode 14+, iOS 13+
- Android development: Android Studio, API level 21+

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd risetwice_opensource/mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **iOS Setup**:
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Environment Configuration**:
   Create a `.env` file in the mobile directory:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
   
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key
   ```

## Running the App

### Development

**iOS Simulator**:
```bash
npm run ios
```

**Android Emulator**:
```bash
npm run android
```

**Metro Bundler**:
```bash
npm start
```

## Project Structure

```
mobile/
├── src/
│   ├── components/
│   │   ├── AudioOrb/          # Audio visualization components
│   │   ├── Chat/              # Chat interface components
│   │   ├── Navigation/        # Navigation setup
│   │   └── Common/            # Shared UI components
│   ├── screens/               # Main app screens
│   ├── hooks/                 # Custom React hooks
│   ├── stores/                # Zustand state management
│   ├── services/              # API and WebRTC services
│   ├── contexts/              # React contexts
│   ├── config/                # Configuration files
│   ├── utils/                 # Utility functions
│   └── types/                 # TypeScript type definitions
├── android/                   # Android-specific files
├── ios/                       # iOS-specific files
└── App.tsx                    # Main app component
```

## Key Components

### Authentication
- **AuthScreen**: Login and anonymous authentication
- **AuthContext**: Firebase authentication state management

### Chat Interface
- **ChatInterface**: Main conversation interface
- **MessageBubble**: Individual message display
- **ConversationHistory**: Scrollable message history
- **AudioOrbMobile**: Interactive voice control

### Navigation
- **StackNavigator**: Main navigation structure
- **TabNavigator**: Bottom tab navigation for different modes

### State Management
- **WebRTC Store**: Connection state, audio levels, conversations
- **Supabase Integration**: Database operations and real-time sync

## Audio & WebRTC

The app uses WebRTC for real-time voice communication with OpenAI's Realtime API:

- **Permissions**: Automatic microphone permission requests
- **Audio Visualization**: Real-time volume monitoring and visual feedback
- **Connection Management**: Automatic reconnection and error handling
- **Cross-platform Support**: Optimized for both iOS and Android

### Important Note on Authentication

The current WebRTC service has a limitation with OpenAI API authentication in React Native:
- React Native WebSocket doesn't support Authorization headers in the constructor
- **For production**: Implement a backend proxy to handle OpenAI authentication
- **Alternative**: Use a WebSocket library that supports headers (like `ws` with React Native)

## Database Integration

Shares the same Supabase database as the web application:

- **User Profiles**: Cross-platform user memory and preferences
- **Conversations**: Persistent conversation history
- **AI Functions**: Dynamic function loading based on specialist mode
- **Real-time Sync**: Live updates between web and mobile platforms

## Specialized Modes

### Mental Health Mode
- Dedicated AI specialist for mental health support
- Specialized functions and prompts
- Privacy-focused conversation handling

### Future Pathways Mode
- Career and life guidance conversations
- Goal-setting and planning assistance
- Resource recommendations

### Sleep Mode
- Sleep improvement guidance
- Habit tracking and recommendations
- Relaxation and bedtime support

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint and Prettier configured
- Component-based architecture
- Custom hooks for business logic

### Error Handling
- Error boundaries for component crashes
- Graceful WebRTC connection failures
- User-friendly error messages
- Debug logging for development

## Debugging

### Admin Panel
Access via navigation to see:
- Connection status monitoring
- User information display
- Debug controls and logging
- Store reset and export functions

## Contributing

1. Follow TypeScript and ESLint guidelines
2. Test on both iOS and Android
3. Update documentation for new features
4. Maintain backward compatibility with web app database

## Support

For technical support or questions:
- Check existing GitHub issues
- Create new issues with detailed reproduction steps
- Include device information and logs