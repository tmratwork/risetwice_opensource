/**
 * API Route: Admin Unique Users
 * Provides list of unique users with their IDs for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

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

    // Get unique users from sessions within the date range
    const { data: sessions, error } = await supabase
      .from('usage_sessions')
      .select('user_id, anonymous_id, session_start, page_views')
      .gte('session_start', startDate.toISOString())
      .lte('session_start', endDate.toISOString())
      .order('session_start', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch unique users' },
        { status: 500 }
      );
    }

    // Process sessions to get unique users with aggregated stats
    const userMap = new Map<string, {
      user_id: string | null;
      anonymous_id: string | null;
      first_visit: string;
      last_visit: string;
      total_sessions: number;
      total_page_views: number;
      total_time_spent_minutes: number;
    }>();

    sessions.forEach(session => {
      const userId = session.user_id || session.anonymous_id;
      if (!userId) return;

      const existing = userMap.get(userId);
      if (existing) {
        existing.total_sessions++;
        existing.total_page_views += session.page_views || 0;
        existing.last_visit = session.session_start;
      } else {
        userMap.set(userId, {
          user_id: session.user_id,
          anonymous_id: session.anonymous_id,
          first_visit: session.session_start,
          last_visit: session.session_start,
          total_sessions: 1,
          total_page_views: session.page_views || 0,
          total_time_spent_minutes: 0 // Not calculated for now
        });
      }
    });

    const users = Array.from(userMap.values())
      .sort((a, b) => new Date(b.last_visit).getTime() - new Date(a.last_visit).getTime());

    return NextResponse.json({
      users: users || [],
      count: users?.length || 0
    });

  } catch (error) {
    console.error('Error in unique-users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}