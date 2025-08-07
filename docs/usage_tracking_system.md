# Usage Tracking System

**Version:** V16  
**Created:** 2025-01-16  
**Status:** Implemented and Active

## Overview

The usage tracking system provides comprehensive analytics for both authenticated (Firebase) and anonymous users. It tracks user sessions, page views, and custom events to provide insights into application usage patterns.

## Key Features

- **Anonymous User Tracking**: Generates persistent UUIDs for users not signed in
- **Session Management**: Complete session lifecycle tracking with start/end times
- **Event Tracking**: Granular event logging within sessions
- **Admin Analytics**: Real-time dashboard with charts and statistics
- **Privacy-Focused**: Minimal data collection with secure RLS policies

## Database Schema

### Tables Created

1. **`usage_sessions`** - Individual user sessions
   - `id` (UUID) - Primary key
   - `user_id` (TEXT) - Firebase user ID (authenticated users)
   - `anonymous_id` (UUID) - Anonymous user ID (unauthenticated users)
   - `session_start` - Session start timestamp
   - `session_end` - Session end timestamp (nullable)
   - `user_agent` - Browser user agent
   - `ip_address` - User IP address
   - `referrer` - Referrer URL
   - `page_views` - Count of page views in session
   - `metadata` - Additional session data (JSONB)

2. **`usage_events`** - Events within sessions
   - `id` (UUID) - Primary key
   - `session_id` (UUID) - References usage_sessions
   - `event_type` - Type of event (page_view, etc.)
   - `event_data` - Event-specific data (JSONB)
   - `page_path` - Page path for event
   - `timestamp` - Event timestamp

3. **`user_usage_summary`** - Aggregated user statistics
   - `user_id` (TEXT) - Firebase user ID
   - `anonymous_id` (UUID) - Anonymous user ID
   - `first_visit` - First visit timestamp
   - `last_visit` - Last visit timestamp
   - `total_sessions` - Total session count
   - `total_page_views` - Total page view count
   - `total_time_spent_minutes` - Total time spent

### Constraints

- XOR constraint: Each record must have either `user_id` OR `anonymous_id`, but not both
- Proper indexing for performance on analytics queries
- RLS policies for data security

## Core Components

### Anonymous User Management
**File:** `src/lib/anonymous-user.ts`

```typescript
// Get or create anonymous user ID
const anonymousId = getAnonymousUserId();

// Check if user is anonymous
const isAnonymous = isAnonymousUser(firebaseUser);

// Get appropriate identifier
const { userId, anonymousId } = getUserIdentifier(firebaseUser);
```

**Storage Strategy:**
- Primary: localStorage (persists across browser sessions)
- Fallback: sessionStorage (session-only persistence)
- Backup: HTTP cookies (1 year expiry)

### Usage Tracking Service
**File:** `src/lib/usage-tracker.ts`

Singleton service that manages tracking operations:

```typescript
// Initialize tracking
await usageTracker.initialize(firebaseUser);

// Track page views
await usageTracker.trackPageView(path, firebaseUser);

// Track custom events
await usageTracker.trackEvent({
  eventType: 'chat_start',
  eventData: { specialist: 'anxiety' },
  pagePath: '/chat'
});

// End session
await usageTracker.endSession();
```

### React Hook
**File:** `src/hooks/use-usage-tracking.ts`

React hook for component integration:

```typescript
const { trackEvent, trackPageView, sessionInfo } = useUsageTracking({
  firebaseUser: user,
  enablePageTracking: true
});
```

## API Endpoints

### Tracking APIs

1. **`POST /api/usage/start-session`**
   - Creates new session record
   - Updates user summary statistics
   - Returns session ID

2. **`POST /api/usage/track-event`**
   - Records individual events
   - Updates session page view counters
   - Supports custom event data

3. **`POST /api/usage/end-session`**
   - Finalizes session with end timestamp
   - Updates aggregated user statistics
   - Calculates session duration

### Admin API

**`GET /api/admin/usage-stats?days=7`**

Returns comprehensive analytics:

```json
{
  "totalUsers": 150,
  "authenticatedUsers": 45,
  "anonymousUsers": 105,
  "totalSessions": 320,
  "totalPageViews": 1250,
  "averageSessionDuration": 12,
  "dailyStats": [...],
  "topPages": [...],
  "userActivity": {
    "newUsersToday": 8,
    "activeUsersToday": 25,
    "returningUsers": 12
  }
}
```

## Admin Dashboard

**URL:** `/chatbotV15/admin/usage-stats`

### Features

- **Overview Cards**: Total users, sessions, page views, avg session duration
- **Today's Activity**: New users, active users, returning users
- **Daily Activity Chart**: Interactive line chart showing trends
- **Top Pages**: Most visited pages with view counts
- **Time Period Filtering**: 7, 30, or 90 days
- **Real-time Refresh**: Manual refresh button

### Charts

Uses Recharts library for visualizations:
- Line charts for daily activity trends
- Responsive design for mobile/desktop
- Tooltips with detailed information

## Integration

### Global Setup

The system is integrated at the application root level:

```typescript
// src/components/providers.tsx
<AuthProvider>
  <UsageTrackingProvider>
    {children}
  </UsageTrackingProvider>
</AuthProvider>
```

### Automatic Tracking

- **Page Views**: Automatically tracked on route changes
- **Session Start**: Initialized when user first visits
- **Session End**: Tracked on page unload/refresh
- **Anonymous ID**: Generated and persisted on first visit

## Data Privacy & Security

### Privacy Measures

- **Minimal Data Collection**: Only essential usage metrics
- **No PII Storage**: No personal information beyond Firebase UIDs
- **IP Anonymization**: IP addresses stored for session context only
- **Secure Cookies**: SameSite=Strict cookie policy

### Security Features

- **RLS Policies**: Row-level security for all tables
- **Service Role Access**: Admin functions use service role
- **User Data Isolation**: Users can only access their own data
- **Input Validation**: All API endpoints validate input data

## Performance Considerations

### Optimizations

- **Indexed Queries**: All common query patterns are indexed
- **Batch Operations**: Multiple tracking calls batched where possible
- **Async Processing**: All tracking operations are non-blocking
- **Fallback Handling**: Graceful degradation if tracking fails

### Monitoring

- **Error Handling**: Comprehensive error logging
- **Performance Metrics**: Track API response times
- **Data Validation**: Ensure data integrity at all levels

## Usage Examples

### Track Custom Events

```typescript
import { trackEvent } from '@/lib/usage-tracker';

// Track chat interactions
await trackEvent({
  eventType: 'chat_message_sent',
  eventData: { 
    specialist: 'anxiety',
    messageLength: 45,
    isFirstMessage: true
  },
  pagePath: '/chat'
});

// Track feature usage
await trackEvent({
  eventType: 'feature_used',
  eventData: { 
    feature: 'voice_chat',
    duration: 120 
  }
});
```

### Component Integration

```typescript
import { useUsageTracking } from '@/hooks/use-usage-tracking';

function ChatComponent() {
  const { trackEvent } = useUsageTracking({
    firebaseUser: user,
    enablePageTracking: true
  });

  const handleChatStart = () => {
    trackEvent('chat_started', { specialist: 'anxiety' });
  };

  return <ChatInterface onStart={handleChatStart} />;
}
```

## Troubleshooting

### Common Issues

1. **Anonymous ID Not Persisting**
   - Check localStorage/cookie permissions
   - Verify browser supports crypto.randomUUID()
   - Check for private/incognito mode

2. **Session Not Ending**
   - Verify beforeunload event listeners
   - Check for SPA navigation issues
   - Ensure proper cleanup in useEffect

3. **Admin Dashboard Not Loading**
   - Check API endpoint permissions
   - Verify Supabase service role key
   - Check for CORS issues

### Debug Information

- Check browser console for tracking errors
- Verify session ID in localStorage
- Monitor network requests to /api/usage/* endpoints
- Check Supabase logs for database errors

## Future Enhancements

### Potential Improvements

1. **Real-time Analytics**: WebSocket-based live updates
2. **User Journey Mapping**: Track complete user flows
3. **A/B Testing Integration**: Track experiment participation
4. **Performance Monitoring**: Core web vitals tracking
5. **Cohort Analysis**: User retention metrics
6. **Geographic Analytics**: Location-based insights

### Maintenance Tasks

1. **Data Retention**: Implement data cleanup policies
2. **Index Optimization**: Monitor query performance
3. **Schema Evolution**: Plan for future data needs
4. **Privacy Compliance**: Regular privacy audits

## Dependencies

- **Recharts** (^2.x): Charts and visualizations
- **Lucide React** (^0.x): Icons for admin interface
- **Supabase** (^2.x): Database and API
- **Next.js** (^14.x): App Router and API routes
- **Firebase Auth** (^10.x): User authentication

## Contact & Support

For questions or issues with the usage tracking system:
- Review this documentation first
- Check the troubleshooting section
- Examine existing code patterns
- Test with sample data before production changes