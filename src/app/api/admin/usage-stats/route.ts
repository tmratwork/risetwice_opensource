/**
 * API Route: Admin Usage Statistics
 * Provides aggregated usage statistics for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UsageStats {
  totalUsers: number;
  authenticatedUsers: number;
  anonymousUsers: number;
  totalSessions: number;
  totalPageViews: number;
  averageSessionDuration: number;
  dailyStats: Array<{
    date: string;
    sessions: number;
    pageViews: number;
    uniqueUsers: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
  }>;
  userActivity: {
    newUsersToday: number;
    activeUsersToday: number;
    returningUsers: number;
  };
}

export async function GET(request: NextRequest) {
  const logUsageStats = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_USAGE_STATS_LOGS === 'true') {
      console.log(`[usage_stats] ${message}`, ...args);
    }
  };

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    logUsageStats('Request received with days:', days);

    // Get date range
    const endDate = new Date();
    const startDate = new Date();

    if (days === 0) {
      // Today: from start of today to end of today
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (days === 1) {
      // Yesterday: from start of yesterday to end of yesterday
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // For other days: from X days ago to now
      startDate.setDate(startDate.getDate() - days);
    }

    logUsageStats('Date range calculated:', {
      days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateLocal: startDate.toString(),
      endDateLocal: endDate.toString()
    });

    // Get user summary for user activity metrics only (new users today, etc)
    const { data: userCounts, error: userCountsError } = await supabase
      .from('user_usage_summary')
      .select('user_id, anonymous_id, first_visit');

    if (userCountsError) {
      console.error('Error fetching user counts:', userCountsError);
      return NextResponse.json(
        { error: 'Failed to fetch user statistics' },
        { status: 500 }
      );
    }

    logUsageStats('User summary fetched for activity metrics');

    // Get daily statistics - this will be our main data source for date-filtered stats
    logUsageStats('Fetching daily sessions with date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    const { data: dailySessions, error: dailyError } = await supabase
      .from('usage_sessions')
      .select('session_start, session_end, page_views, user_id, anonymous_id')
      .gte('session_start', startDate.toISOString())
      .lte('session_start', endDate.toISOString())
      .order('session_start', { ascending: true });

    if (dailyError) {
      console.error('Error fetching daily stats:', dailyError);
      return NextResponse.json(
        { error: 'Failed to fetch daily statistics' },
        { status: 500 }
      );
    }

    logUsageStats('Daily sessions fetched:', {
      count: dailySessions.length,
      firstSession: dailySessions[0],
      lastSession: dailySessions[dailySessions.length - 1]
    });

    // Calculate stats from the filtered session data
    const uniqueUsersInPeriod = new Set<string>();
    const authenticatedUsersInPeriod = new Set<string>();
    const anonymousUsersInPeriod = new Set<string>();
    let totalPageViewsInPeriod = 0;
    let totalSessionDurationMinutes = 0;

    dailySessions.forEach(session => {
      const userId = session.user_id || session.anonymous_id;
      if (userId) {
        uniqueUsersInPeriod.add(userId);
        if (session.user_id) {
          authenticatedUsersInPeriod.add(session.user_id);
        }
        if (session.anonymous_id) {
          anonymousUsersInPeriod.add(session.anonymous_id);
        }
      }

      totalPageViewsInPeriod += session.page_views || 0;

      // Calculate session duration if both start and end are available
      if (session.session_start && session.session_end) {
        const duration = new Date(session.session_end).getTime() - new Date(session.session_start).getTime();
        totalSessionDurationMinutes += duration / (1000 * 60); // Convert to minutes
      }
    });

    // Calculate aggregated stats for the selected period
    const totalUsers = uniqueUsersInPeriod.size;
    const authenticatedUsers = authenticatedUsersInPeriod.size;
    const anonymousUsers = anonymousUsersInPeriod.size;
    const totalSessions = dailySessions.length;
    const totalPageViews = totalPageViewsInPeriod;
    const averageSessionDuration = totalSessions > 0 ? Math.round(totalSessionDurationMinutes / totalSessions) : 0;

    logUsageStats('Calculated stats for period:', {
      totalUsers,
      authenticatedUsers,
      anonymousUsers,
      totalSessions,
      totalPageViews,
      averageSessionDuration
    });

    // Process daily stats
    const dailyStats: { [key: string]: { sessions: number; pageViews: number; users: Set<string> } } = {};

    dailySessions.forEach(session => {
      const date = new Date(session.session_start).toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { sessions: 0, pageViews: 0, users: new Set() };
      }

      dailyStats[date].sessions++;
      dailyStats[date].pageViews += session.page_views || 0;
      dailyStats[date].users.add(session.user_id || session.anonymous_id);
    });

    const dailyStatsArray = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      pageViews: stats.pageViews,
      uniqueUsers: stats.users.size
    }));

    // Get top pages
    logUsageStats('Fetching page views with start date:', startDate.toISOString());

    const { data: pageViews, error: pageViewsError } = await supabase
      .from('usage_events')
      .select('page_path')
      .eq('event_type', 'page_view')
      .gte('timestamp', startDate.toISOString())
      .not('page_path', 'is', null);

    if (pageViewsError) {
      console.error('Error fetching page views:', pageViewsError);
      return NextResponse.json(
        { error: 'Failed to fetch page statistics' },
        { status: 500 }
      );
    }

    logUsageStats('Page views fetched:', {
      count: pageViews.length,
      sample: pageViews.slice(0, 3)
    });

    const pageCounts: { [key: string]: number } = {};
    pageViews.forEach(pv => {
      const path = pv.page_path || 'unknown';
      pageCounts[path] = (pageCounts[path] || 0) + 1;
    });

    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    // Get user activity metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todaySessions, error: todayError } = await supabase
      .from('usage_sessions')
      .select('user_id, anonymous_id, session_start')
      .gte('session_start', today.toISOString());

    if (todayError) {
      console.error('Error fetching today sessions:', todayError);
      return NextResponse.json(
        { error: 'Failed to fetch today statistics' },
        { status: 500 }
      );
    }

    const todayUsers = new Set(todaySessions.map(s => s.user_id || s.anonymous_id));
    const activeUsersToday = todayUsers.size;

    // Count new users (first visit today)
    const newUsersToday = userCounts.filter(u => {
      const firstVisit = new Date(u.first_visit);
      return firstVisit >= today;
    }).length;

    // Count returning users (visited before and also today)
    const returningUsers = userCounts.filter(u => {
      const firstVisit = new Date(u.first_visit);
      const hasVisitedBefore = firstVisit < today;
      const visitedToday = todayUsers.has(u.user_id || u.anonymous_id);
      return hasVisitedBefore && visitedToday;
    }).length;

    const stats: UsageStats = {
      totalUsers,
      authenticatedUsers,
      anonymousUsers,
      totalSessions,
      totalPageViews,
      averageSessionDuration,
      dailyStats: dailyStatsArray,
      topPages,
      userActivity: {
        newUsersToday,
        activeUsersToday,
        returningUsers
      }
    };

    logUsageStats('Final stats object:', {
      days,
      dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      totalUsers,
      totalSessions,
      totalPageViews
    });

    return NextResponse.json(stats);

  } catch (error) {
    console.error('Error in usage-stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}