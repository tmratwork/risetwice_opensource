// src/app/api/s1/therapy-sessions/end/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuth } from '@/lib/auth/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      session_id, 
      therapist_notes, 
      therapeutic_alliance_score,
      technique_effectiveness_score 
    } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Verify session belongs to the therapist and is in progress
    const { data: session, error: sessionError } = await supabase
      .from('s1_therapy_sessions')
      .select(`
        id,
        status,
        therapist_id,
        ai_patient_id,
        started_at,
        s1_ai_patients!inner (
          name,
          primary_concern
        )
      `)
      .eq('id', session_id)
      .eq('therapist_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: 'Session is not in progress' }, { status: 400 });
    }

    const endTime = new Date();
    const startTime = new Date(session.started_at);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Generate session summary using AI analysis
    const sessionSummary = await generateSessionSummary(session_id, supabase);

    // Generate AI patient feedback
    const aiPatientFeedback = await generateAIPatientFeedback(
      session_id, 
      therapeutic_alliance_score,
      technique_effectiveness_score,
      supabase
    );

    // Update session with completion data
    const { data: completedSession, error: updateError } = await supabase
      .from('s1_therapy_sessions')
      .update({
        status: 'completed',
        ended_at: endTime.toISOString(),
        duration_minutes: durationMinutes,
        therapist_notes,
        therapeutic_alliance_score,
        technique_effectiveness_score,
        session_summary: sessionSummary,
        ai_patient_feedback: aiPatientFeedback,
        is_case_study_eligible: true
      })
      .eq('id', session_id)
      .select(`
        id,
        status,
        ended_at,
        duration_minutes,
        session_summary,
        ai_patient_feedback,
        therapeutic_alliance_score,
        technique_effectiveness_score,
        s1_ai_patients!inner (
          name,
          primary_concern
        )
      `)
      .single();

    if (updateError) {
      console.error('Error completing session:', updateError);
      return NextResponse.json({ error: 'Failed to complete session' }, { status: 500 });
    }

    // Update therapist profile statistics
    await updateTherapistStats(user.id, supabase);

    return NextResponse.json({
      session: completedSession,
      case_study_ready: true
    });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions/end:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateSessionSummary(sessionId: string, supabase: any) {
  try {
    // Get session messages to analyze
    const { data: messages } = await supabase
      .from('s1_session_messages')
      .select('role, content, emotional_tone, therapeutic_techniques')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return 'Session completed with no recorded messages.';
    }

    // Simple summary generation (in production, this would use OpenAI)
    const therapistMessages = messages.filter(m => m.role === 'therapist').length;
    const patientMessages = messages.filter(m => m.role === 'ai_patient').length;
    const totalMessages = messages.length;

    const emotionalTones = messages
      .map(m => m.emotional_tone)
      .filter(Boolean);

    const uniqueTones = [...new Set(emotionalTones)].join(', ');

    return `Session included ${totalMessages} total exchanges (${therapistMessages} therapist, ${patientMessages} patient). Emotional tones observed: ${uniqueTones}. Session showed active engagement from both parties.`;

  } catch (error) {
    console.error('Error generating session summary:', error);
    return 'Session completed successfully.';
  }
}

async function generateAIPatientFeedback(
  sessionId: string, 
  allianceScore?: number, 
  techniqueScore?: number,
  supabase?: any
) {
  try {
    // In production, this would analyze the therapist's techniques and provide AI feedback
    let feedback = 'Thank you for the session. ';
    
    if (allianceScore && allianceScore >= 8) {
      feedback += 'I felt heard and understood. Your approach made me feel comfortable sharing.';
    } else if (allianceScore && allianceScore >= 6) {
      feedback += 'The session went well. I appreciated your patience and questions.';
    } else if (allianceScore && allianceScore < 6) {
      feedback += 'I found it a bit difficult to connect, but I think with time it might get easier.';
    }

    if (techniqueScore && techniqueScore >= 8) {
      feedback += ' Your therapeutic techniques were very helpful in helping me explore my thoughts.';
    } else if (techniqueScore && techniqueScore < 6) {
      feedback += ' I would have liked more guidance in exploring some of the topics we discussed.';
    }

    return feedback;

  } catch (error) {
    console.error('Error generating AI patient feedback:', error);
    return 'Thank you for the session.';
  }
}

async function updateTherapistStats(userId: string, supabase: any) {
  try {
    // Get current stats
    const { data: profile } = await supabase
      .from('s1_therapist_profiles')
      .select('total_sessions_completed, average_alliance_score')
      .eq('user_id', userId)
      .single();

    if (!profile) return;

    // Get recent alliance scores for average calculation
    const { data: recentSessions } = await supabase
      .from('s1_therapy_sessions')
      .select('therapeutic_alliance_score')
      .eq('therapist_id', userId)
      .eq('status', 'completed')
      .not('therapeutic_alliance_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    let newAverageScore = null;
    if (recentSessions && recentSessions.length > 0) {
      const scores = recentSessions.map(s => s.therapeutic_alliance_score);
      newAverageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    // Update profile stats
    await supabase
      .from('s1_therapist_profiles')
      .update({
        total_sessions_completed: (profile.total_sessions_completed || 0) + 1,
        average_alliance_score: newAverageScore
      })
      .eq('user_id', userId);

  } catch (error) {
    console.error('Error updating therapist stats:', error);
    // Don't throw - this is not critical
  }
}