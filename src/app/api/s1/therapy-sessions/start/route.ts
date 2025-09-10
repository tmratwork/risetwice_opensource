// src/app/api/s1/therapy-sessions/start/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Extract user from Firebase token (following V16 pattern)
const getAuth = (request: NextRequest) => {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No authorization header found');
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer '
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    const payload = JSON.parse(atob(tokenParts[1]));
    const userId = payload.sub || payload.user_id; // Firebase UID
    
    if (!userId) {
      throw new Error('No user ID found in token');
    }
    
    return Promise.resolve({ user: { id: userId } });
  } catch (error) {
    throw new Error('Invalid token');
  }
};

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Verify session belongs to the therapist and is scheduled
    const { data: session, error: sessionError } = await supabase
      .from('s1_therapy_sessions')
      .select(`
        id,
        status,
        therapist_id,
        ai_patient_id,
        s1_ai_patients!inner (
          id,
          name,
          primary_concern,
          personality_traits,
          behavioral_patterns,
          session_config,
          background_story
        )
      `)
      .eq('id', session_id)
      .eq('therapist_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'in_progress') {
      return NextResponse.json({ error: 'Session already in progress' }, { status: 400 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
    }

    // Update session status and start time
    const { data: updatedSession, error: updateError } = await supabase
      .from('s1_therapy_sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .eq('id', session_id)
      .select(`
        id,
        status,
        started_at,
        session_number,
        session_type,
        session_goals,
        therapeutic_approach,
        s1_ai_patients!inner (
          id,
          name,
          age,
          gender,
          primary_concern,
          secondary_concerns,
          severity_level,
          personality_traits,
          behavioral_patterns,
          session_config,
          background_story,
          therapeutic_goals,
          difficulty_level
        )
      `)
      .single();

    if (updateError) {
      console.error('Error starting session:', updateError);
      return NextResponse.json({ error: 'Failed to start session' }, { status: 500 });
    }

    // Note: The AI patient greeting is handled by WebRTC and s1_ai_prompts table
    // This hardcoded approach is intentionally disabled to prevent fallback behavior

    return NextResponse.json({
      session: updatedSession
    });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions/start:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

