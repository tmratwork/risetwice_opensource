// src/app/api/provider/analytics/metrics/route.ts
// GET provider analytics metrics (overview dashboard)

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

    if (!providerUserId) {
      return NextResponse.json(
        { error: 'Provider user ID required' },
        { status: 400 }
      );
    }

    // Calculate date range for week-over-week comparison
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Get total AI preview sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('v17_session_metrics')
      .select('id, session_start, duration_seconds, user_id')
      .eq('provider_user_id', providerUserId);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    const totalSessions = sessions?.length || 0;

    // Calculate unique users
    const uniqueUserIds = new Set(sessions?.map(s => s.user_id) || []);
    const uniqueUsers = uniqueUserIds.size;

    // Calculate average session duration
    const validDurations = sessions?.filter(s => s.duration_seconds) || [];
    const avgSessionDuration = validDurations.length > 0
      ? Math.round(validDurations.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / validDurations.length)
      : 0;

    // Sessions in last week vs previous week
    const sessionsThisWeek = sessions?.filter(s =>
      new Date(s.session_start) >= oneWeekAgo
    ).length || 0;

    const sessionsPreviousWeek = sessions?.filter(s => {
      const sessionDate = new Date(s.session_start);
      return sessionDate >= twoWeeksAgo && sessionDate < oneWeekAgo;
    }).length || 0;

    const weeklyGrowth = sessionsPreviousWeek > 0
      ? ((sessionsThisWeek - sessionsPreviousWeek) / sessionsPreviousWeek) * 100
      : sessionsThisWeek > 0 ? 100 : 0;

    // 2. Get contact button clicks
    const { data: contactClicks, error: contactError } = await supabase
      .from('provider_analytics_events')
      .select('id, anonymous_user_id, created_at')
      .eq('provider_user_id', providerUserId)
      .eq('event_type', 'contact_click');

    if (contactError) {
      console.error('Error fetching contact clicks:', contactError);
      return NextResponse.json(
        { error: 'Failed to fetch contact click data' },
        { status: 500 }
      );
    }

    const totalContactClicks = contactClicks?.length || 0;

    // Calculate conversion rate (users who clicked contact / total unique users)
    const usersWhoClickedContact = new Set(contactClicks?.map(c => c.anonymous_user_id) || []);
    const conversionRate = uniqueUsers > 0
      ? (usersWhoClickedContact.size / uniqueUsers) * 100
      : 0;

    // Format average session duration as "Xm Ys"
    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    };

    return NextResponse.json({
      totalSessions,
      uniqueUsers,
      totalContactClicks,
      avgSessionDuration: formatDuration(avgSessionDuration),
      avgSessionDurationSeconds: avgSessionDuration,
      conversionRate: Math.round(conversionRate * 10) / 10, // One decimal place
      weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
      sessionsThisWeek,
      sessionsPreviousWeek
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
