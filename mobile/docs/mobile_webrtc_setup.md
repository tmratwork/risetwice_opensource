file: mobile/docs/mobile_webrtc_setup.md

# Mobile WebRTC Proxy Server Setup

## 🚨 PROJECT STATUS: DEVELOPMENT DISCONTINUED

**The React Native mobile app development has been discontinued as of August 2025.**

This documentation and related files are preserved for potential future development but are **NOT CURRENTLY MAINTAINED OR FUNCTIONAL**.

## Overview

The React Native mobile app **WAS INTENDED** to require a WebSocket proxy server to handle WebRTC connections to OpenAI, due to React Native New Architecture compatibility issues with `react-native-webrtc`.

## Intended Architecture (Not Implemented)

```
Mobile App ←→ WebSocket Proxy Server ←→ Next.js App ←→ OpenAI Realtime API
```

**Actual Next.js Web App Architecture (Currently Working):**
```
Next.js Browser → Direct WebRTC Connection → OpenAI Realtime API
```

## Files Created (Preserved for Future Development)

### Mobile-Specific Files (in mobile folder)

1. **`mobile/src/lib/mobile_webrtc-websocket-server.ts`** ⚠️ **NOT FUNCTIONAL**
   - Standalone WebSocket server for mobile proxy
   - **LIMITATION**: Requires access to main Next.js app's WebRTC connection logic
   - **STATUS**: Code exists but never fully implemented or tested
   - Prefixed with `mobile_` per architectural guidelines

2. **`mobile/src/lib/mobile_server-startup.ts`** ⚠️ **NOT FUNCTIONAL** 
   - Server initialization script for mobile WebSocket server
   - **STATUS**: Never integrated into development workflow
   - Prefixed with `mobile_` per architectural guidelines

3. **`mobile/src/components/Chat/`** ✅ **PARTIALLY WORKING**
   - React Native chat components
   - **ISSUES FIXED**: Object rendering errors in MessageBubble and ConversationHistory
   - **ISSUES REMAINING**: WebSocket connection failures (no server running)

4. **`mobile/src/screens/MentalHealthScreen.tsx`** ✅ **CONFIGURATION FIXED**
   - **FIXED**: Changed from `specialist="mental_health"` to `specialist="triage"` to match Next.js
   - **STATUS**: Should now load functions correctly when mobile development resumes

## Critical Technical Issues (Unresolved)

### 1. **WebSocket Server Architecture Problem**
- Next.js API routes **CANNOT** handle WebSocket upgrades natively
- The `/api/v16/webrtc-proxy` route is HTTP-only and unused by Next.js web app
- Mobile WebSocket server needs to run as **separate Node.js process**
- **DECISION NEEDED**: Choose between standalone server, Next.js custom server, or HTTP-based alternative

### 2. **Development Integration Missing**
- WebSocket server is **NOT** started by `npm run dev`
- No automated startup process implemented
- Manual server startup required (but process not documented)

### 3. **Dependency Architecture Conflict**
- Mobile WebSocket server requires Next.js WebRTC connection logic
- Creates circular dependency between mobile and web codebases
- Violates architectural separation principles

## Current State of Mobile Files

### ✅ **WORKING/FIXED:**
- Mobile folder structure and organization
- TypeScript configuration and type safety
- React Native component rendering (object errors fixed)  
- Function loading configuration (now uses "triage" like Next.js)
- Architectural separation (all mobile code in mobile/ folder)
- Package dependency isolation (mobile packages in mobile/package.json)

### ❌ **BROKEN/INCOMPLETE:**
- WebSocket server implementation (exists but not functional)
- Mobile app cannot connect to any WebRTC service
- No automated development workflow
- WebSocket proxy architecture never fully implemented

## If Mobile Development Resumes

### Required Actions:
1. **Choose WebSocket Architecture**:
   - Option A: Standalone WebSocket server on port 8080
   - Option B: Custom Next.js server with WebSocket support  
   - Option C: HTTP-based alternative (SSE, long polling, etc.)

2. **Implement Chosen Architecture**:
   - Complete WebSocket server implementation
   - Integrate with `npm run dev` workflow
   - Resolve dependency sharing between mobile and web

3. **Test Integration**:
   - Verify mobile app connects to WebSocket server
   - Test voice conversations end-to-end
   - Ensure function loading works with "triage" specialist type

### Files That Can Be Deleted If Mobile Development Is Permanently Abandoned:
- `/src/app/api/v16/webrtc-proxy/route.ts` (unused by Next.js web app)
- Entire `/mobile` folder (if space is needed)

## Development Workflow Status

### ✅ **Next.js Web App**: 
- **FULLY FUNCTIONAL** and unaffected by mobile development
- Uses direct WebRTC connection to OpenAI
- No mobile-related processes or dependencies

### ❌ **Mobile App**:
- **NOT FUNCTIONAL** - cannot establish WebRTC connections  
- **DEVELOPMENT DISCONTINUED** - no active maintenance
- **FILES PRESERVED** - for potential future development

**Last Updated**: August 2025