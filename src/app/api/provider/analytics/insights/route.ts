// src/app/api/provider/analytics/insights/route.ts
// GET provider analytics insights (conversation themes, FAQ, session analytics)

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

    // Get all sessions for this provider
    const { data: sessions, error: sessionsError } = await supabase
      .from('v17_session_metrics')
      .select('id, session_id, user_id, session_start, duration_seconds')
      .eq('provider_user_id', providerUserId);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch session data' },
        { status: 500 }
      );
    }

    const totalSessions = sessions?.length || 0;

    // Get conversation analyses for these sessions
    const sessionIds = sessions?.map(s => s.session_id).filter(Boolean) || [];

    let conversationAnalyses = [];
    if (sessionIds.length > 0) {
      const { data: analyses, error: analysesError } = await supabase
        .from('v16_conversation_analyses')
        .select('conversation_id, analysis_result')
        .in('conversation_id', sessionIds);

      if (analysesError) {
        console.error('Error fetching conversation analyses:', analysesError);
      } else {
        conversationAnalyses = analyses || [];
      }
    }

    // Aggregate common topics from conversation analyses
    // This is a simplified version - in production, you'd want more sophisticated NLP
    const topicCounts: Record<string, number> = {};

    conversationAnalyses.forEach(analysis => {
      if (analysis.analysis_result) {
        const result = typeof analysis.analysis_result === 'string'
          ? JSON.parse(analysis.analysis_result)
          : analysis.analysis_result;

        // Extract topics from analysis (this depends on your analysis structure)
        // For now, we'll provide placeholder data that can be enhanced with real analysis
        const topics = result?.topics || result?.themes || [];
        topics.forEach((topic: string) => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
      }
    });

    // Convert to array and sort by count
    const commonTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({
        topic,
        count,
        percentage: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 topics

    // If no topics found in analyses, provide default categories
    if (commonTopics.length === 0) {
      // These would ideally come from actual conversation analysis
      // For now, return empty array - will be populated as conversations are analyzed
    }

    // Calculate session duration analytics
    const validDurations = sessions?.filter(s => s.duration_seconds && s.duration_seconds > 0) || [];
    const durations = validDurations.map(s => s.duration_seconds || 0);

    const avgDropoffPoint = durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : 0;

    const formatDuration = (seconds: number): string => {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    };

    // Calculate peak engagement times (hour of day)
    const hourCounts: Record<number, number> = {};
    sessions?.forEach(session => {
      if (session.session_start) {
        const hour = new Date(session.session_start).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    const formatPeakTimes = (hours: number[]): string => {
      if (hours.length === 0) return 'Not enough data';

      const formatHour = (h: number) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${displayHour} ${period}`;
      };

      if (hours.length === 1) {
        return `${formatHour(hours[0])}`;
      } else if (hours.length === 2) {
        return `${formatHour(hours[0])}-${formatHour(hours[1])}`;
      } else {
        return `${formatHour(hours[0])}-${formatHour(hours[hours.length - 1])}`;
      }
    };

    // Frequently asked questions - placeholder for now
    // This would ideally come from conversation message analysis
    const frequentQuestions: string[] = [];

    return NextResponse.json({
      commonTopics,
      sessionAnalytics: {
        avgDropoffPoint: formatDuration(avgDropoffPoint),
        avgDropoffPointSeconds: avgDropoffPoint,
        peakEngagementTimes: formatPeakTimes(peakHours),
        totalSessions
      },
      frequentQuestions
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
