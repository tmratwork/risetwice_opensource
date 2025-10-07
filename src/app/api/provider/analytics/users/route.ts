// src/app/api/provider/analytics/users/route.ts
// GET engaged users list for provider

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerUserId = searchParams.get('provider_user_id');
    const filter = searchParams.get('filter'); // 'all', 'opted_in', 'high_engagement'

    if (!providerUserId) {
      return NextResponse.json(
        { error: 'Provider user ID required' },
        { status: 400 }
      );
    }

    // Get all sessions for this provider
    const { data: sessions, error: sessionsError } = await supabase
      .from('v17_session_metrics')
      .select('user_id, session_start, duration_seconds')
      .eq('provider_user_id', providerUserId)
      .order('session_start', { ascending: false });

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    // Aggregate user engagement data
    const userEngagement: Record<string, {
      userId: string;
      sessionCount: number;
      lastActive: string;
      totalDuration: number;
    }> = {};

    sessions?.forEach(session => {
      if (!session.user_id) return;

      if (!userEngagement[session.user_id]) {
        userEngagement[session.user_id] = {
          userId: session.user_id,
          sessionCount: 0,
          lastActive: session.session_start,
          totalDuration: 0
        };
      }

      userEngagement[session.user_id].sessionCount++;
      userEngagement[session.user_id].totalDuration += session.duration_seconds || 0;

      // Update last active if this session is more recent
      if (new Date(session.session_start) > new Date(userEngagement[session.user_id].lastActive)) {
        userEngagement[session.user_id].lastActive = session.session_start;
      }
    });

    // Get opt-in status for all users
    const userIds = Object.keys(userEngagement);
    const { data: optIns, error: optInsError } = await supabase
      .from('provider_messaging_opt_ins')
      .select('user_id, opted_in, user_display_name, user_email, opted_in_at')
      .eq('provider_user_id', providerUserId)
      .in('user_id', userIds);

    if (optInsError) {
      console.error('Error fetching opt-ins:', optInsError);
    }

    const optInMap = new Map(
      optIns?.map(opt => [opt.user_id, opt]) || []
    );

    // Format relative time
    const getRelativeTime = (dateString: string): string => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays < 7) return `${diffDays} days ago`;
      return `${Math.floor(diffDays / 7)} weeks ago`;
    };

    // Determine engagement level
    const getEngagementLevel = (sessionCount: number): 'high' | 'medium' | 'low' => {
      if (sessionCount >= 4) return 'high';
      if (sessionCount >= 2) return 'medium';
      return 'low';
    };

    // Create user list with engagement data
    const users = Object.values(userEngagement).map((engagement, index) => {
      const optIn = optInMap.get(engagement.userId);
      const engagementLevel = getEngagementLevel(engagement.sessionCount);

      return {
        // Use anonymous ID format in UI
        id: `User #${String(index + 1).padStart(3, '0')}`,
        actualUserId: engagement.userId, // Keep for backend operations
        sessions: engagement.sessionCount,
        lastActive: getRelativeTime(engagement.lastActive),
        lastActiveTimestamp: engagement.lastActive,
        engagement: engagementLevel,
        optedIn: optIn?.opted_in || false,
        displayName: optIn?.opted_in ? optIn.user_display_name : null,
        email: optIn?.opted_in ? optIn.user_email : null,
        totalDurationSeconds: engagement.totalDuration
      };
    });

    // Sort by last active (most recent first)
    users.sort((a, b) =>
      new Date(b.lastActiveTimestamp).getTime() - new Date(a.lastActiveTimestamp).getTime()
    );

    // Apply filter
    let filteredUsers = users;
    if (filter === 'opted_in') {
      filteredUsers = users.filter(u => u.optedIn);
    } else if (filter === 'high_engagement') {
      filteredUsers = users.filter(u => u.engagement === 'high');
    }

    return NextResponse.json({
      users: filteredUsers,
      totalUsers: users.length,
      optedInCount: users.filter(u => u.optedIn).length
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
