# V17 Function Migration TODO - ElevenLabs June 2025 Breaking Changes

## Overview

V17 migration is complete for basic tool creation, but we need to optimize the architecture to leverage ElevenLabs' June 2025 breaking changes that introduced proper **client tools** vs **server tools** distinction.

## June 2025 Breaking Changes Summary

### Key Changes
- **June 30, 2025**: Last day for full backwards compatibility
- **July 1, 2025**: GET endpoints stopped returning the `tools` field
- **July 16, 2025**: Legacy `prompt.tools` field permanently removed

### New Architecture
- **Decoupled tools from agents**: Tools now exist as standalone records reusable across multiple agents
- **New field structure**: 
  - `prompt.tool_ids` - Array of client or server tool IDs
  - `prompt.built_in_tools` - System tools like `end_call` and `language_detection`
- **Centralized tool management**: Comprehensive tools interface for creating/managing tools across workspace

## Current V17 Status ✅

### Completed
- ✅ All 33 V16 triage functions migrated to ElevenLabs Tools API
- ✅ All tools configured with proper POST schemas and parameter validation  
- ✅ Agent configuration updated with all 33 tool IDs
- ✅ Legacy server tools configuration removed
- ✅ Code cleanup completed

### Current Architecture
- **All tools are server tools** (webhook-based)
- All call: `https://r2ai.me/api/v17/tools/webhook`
- All use Bearer token authentication
- All have proper request_body_schema definitions

## Required Architecture Optimization 🚧

### Problem
Currently ALL 33 tools are server tools, but some should be **client tools** for better UX and real-time UI interactions.

### Server Tools vs Client Tools

#### **Server Tools** (Keep as webhooks)
Backend operations that require:
- Database queries
- API calls to external services
- Sensitive data processing
- Complex business logic

#### **Client Tools** (Migrate to browser execution)  
UI operations that should execute in browser:
- Display/render UI components
- Navigation between pages
- Real-time UI updates
- Local state management
- DOM manipulation

## Tool Categorization Analysis

### 🔧 **Server Tools** (Keep as webhooks - 28 tools)

#### **Resource Locators** (13 tools)
- `basic_needs_assistance_function` - Database queries for local resources
- `community_programs_function` - External API calls
- `educational_support_function` - Database/API lookups
- `emergency_shelter_function` - Sensitive housing database queries
- `food_assistance_function` - External resource APIs
- `healthcare_access_function` - Healthcare provider databases
- `job_search_assistance_function` - Employment API integrations
- `legal_aid_function` - Legal service databases
- `lgbtq_support_function` - Specialized resource databases
- `resource_search_function` - Web scraping/search APIs
- `substance_abuse_support_function` - Treatment provider databases
- `transportation_assistance_function` - Transit API integrations
- `young_parent_support_function` - Support service databases

#### **Crisis Support** (3 tools)
- `crisis_mental_health_function` - Hotline database, sensitive protocols
- `crisis_response_function` - Crisis protocol databases
- `domestic_violence_support_function` - Sensitive safety resources

#### **Mental Health Core** (6 tools)
- `grounding_function` - Therapeutic content databases
- `problem_solving_function` - CBT content databases
- `psychoeducation_function` - Educational content databases  
- `screening_function` - Clinical assessment databases
- `thought_exploration_function` - CBT technique databases
- `validation_function` - Therapeutic response databases

#### **Future Planning** (6 tools)
- `educational_guidance_function` - Educational database queries
- `futures_assessment_function` - Assessment processing
- `goal_planning_function` - Planning algorithm processing
- `pathway_exploration_function` - Career database queries
- `resource_connection_function` - Networking database queries
- `skill_building_function` - Training resource databases

### 🌐 **Client Tools** (Migrate to browser - 5 tools)

#### **UI/Display Functions**
1. **`display_map_function`** 🎯 **HIGH PRIORITY**
   - **Current**: Server webhook returns map data
   - **Should be**: Client tool that renders interactive map component
   - **Benefits**: Real-time map interaction, zoom, click events
   - **Implementation**: Register client tool that calls React map component

#### **Navigation/Session Functions**  
2. **`trigger_specialist_handoff`** 🎯 **HIGH PRIORITY**
   - **Current**: Server webhook processes handoff logic
   - **Should be**: Hybrid - server processes logic, client handles UI transition
   - **Benefits**: Smooth UI transitions, loading states, specialist branding
   - **Implementation**: Server tool for logic + client tool for UI updates

3. **`end_session`** 🎯 **MEDIUM PRIORITY**
   - **Current**: Server webhook handles session cleanup
   - **Should be**: Hybrid - server cleanup + client navigation/UI reset
   - **Benefits**: Immediate UI feedback, page navigation, state cleanup
   - **Implementation**: Server tool for cleanup + client tool for navigation

#### **Feedback/Interaction Functions**
4. **`resource_feedback_function`** 🎯 **MEDIUM PRIORITY** 
   - **Current**: Server webhook submits feedback
   - **Should be**: Hybrid - client captures feedback + server stores
   - **Benefits**: Real-time form validation, immediate UI feedback
   - **Implementation**: Client tool for form + server tool for storage

5. **`report_technical_error`** 🎯 **LOW PRIORITY**
   - **Current**: Server webhook logs errors
   - **Should be**: Client tool for user-facing error reporting
   - **Benefits**: Immediate error UI, user feedback forms
   - **Implementation**: Client tool for UI + server tool for logging

## Implementation Plan 📋

### Phase 1: High Priority Client Tools
1. **Migrate `display_map_function`** 
   - Create client tool that renders React map component
   - Keep server tool for data fetching if needed
   - Test map display and interactions

2. **Migrate `trigger_specialist_handoff`**
   - Create client tool for UI transitions
   - Keep server tool for handoff logic
   - Test smooth specialist transitions

### Phase 2: Medium Priority Hybrid Tools
3. **Enhance `end_session`**
   - Add client tool for immediate UI feedback
   - Keep server tool for cleanup
   - Test session termination UX

4. **Enhance `resource_feedback_function`**
   - Add client tool for form interactions
   - Keep server tool for data storage
   - Test feedback submission flow

### Phase 3: Testing & Optimization
5. **Test all client tools** with ElevenLabs agent
6. **Optimize performance** for client-server coordination
7. **Update documentation** for hybrid tool patterns

## Technical Implementation Details

### Client Tool Registration Pattern
```typescript
// In Next.js component (useEffect)
useEffect(() => {
  // Register client tool for map display
  window.clientTools?.register('display_map_function', (params) => {
    // Render map component directly in browser
    setMapData(params.searchId);
    setShowMap(true);
    return { success: true, mapDisplayed: true };
  });

  // Register client tool for specialist handoff UI
  window.clientTools?.register('trigger_specialist_handoff_ui', (params) => {
    // Handle UI transition to specialist
    setSpecialistType(params.specialist_type);
    setShowTransition(true);
    return { success: true, transitionStarted: true };
  });
}, []);
```

### Hybrid Tool Coordination
For tools that need both server processing AND client UI updates:

1. **AI calls server tool** (existing webhook)
2. **Server tool processes business logic** 
3. **Server tool calls client tool** via response
4. **Client tool handles UI updates**

### ElevenLabs Configuration Changes
```typescript
// Agent configuration will include both:
const toolIds = [
  // Server tools (existing webhook tools)
  'tool_5401k4kyv4ztexw95bsra3ctfm12',  // get_safety_triage_protocol
  
  // Client tools (new browser-based tools)
  'client_tool_display_map_12345',      // display_map_function
  'client_tool_handoff_ui_67890',       // specialist handoff UI
];
```

## Benefits of Hybrid Architecture

### User Experience Improvements
- **Real-time map interactions** instead of static map images
- **Smooth specialist transitions** with loading states and animations  
- **Immediate UI feedback** for user actions
- **Responsive form interactions** for feedback submission
- **Better error handling** with user-friendly error displays

### Technical Benefits
- **Reduced server load** for UI-only operations
- **Faster response times** for client-side operations
- **Better separation of concerns** (server = data, client = UI)
- **Enhanced offline capabilities** for cached client tools

## Risk Assessment

### Low Risk Changes
- `display_map_function` - Pure UI enhancement
- `resource_feedback_function` - Form interaction improvement

### Medium Risk Changes  
- `trigger_specialist_handoff` - Critical user flow, needs careful testing
- `end_session` - Session management, needs thorough testing

### Mitigation Strategies
- **Gradual rollout**: Implement one tool at a time
- **Fallback mechanisms**: Keep server tools as backup
- **Extensive testing**: Test all user flows with client tools
- **Monitoring**: Track client tool execution and errors

## Success Metrics

### User Experience Metrics
- **Map interaction time**: Measure time spent interacting with maps
- **Specialist transition smoothness**: User feedback on transitions
- **Error reporting completion**: Rate of successful error reports
- **Session termination clarity**: User confusion metrics

### Technical Metrics
- **Client tool execution success rate**: Monitor failures
- **Response time improvements**: Compare client vs server execution
- **Resource usage**: Monitor browser performance impact
- **Error rates**: Track client tool errors vs server tool errors

## Timeline Estimate

### Week 1-2: Analysis & Planning
- Finalize client tool candidates
- Design client tool registration system
- Plan hybrid coordination patterns

### Week 3-4: High Priority Implementation  
- Implement `display_map_function` client tool
- Implement `trigger_specialist_handoff` UI client tool
- Test basic client tool functionality

### Week 5-6: Medium Priority Implementation
- Implement `end_session` client tool enhancements
- Implement `resource_feedback_function` client tool
- Test hybrid server-client coordination

### Week 7-8: Testing & Optimization
- Comprehensive testing of all client tools
- Performance optimization
- User experience testing
- Documentation updates

## Conclusion

This migration from pure server tools to a hybrid server/client tool architecture will significantly improve the user experience while maintaining the robust backend processing that our mental health functions require. The key is identifying which functions benefit from client-side execution and implementing them thoughtfully with proper fallback mechanisms.

The next step is to begin Phase 1 implementation with the high-priority client tools: `display_map_function` and `trigger_specialist_handoff`.