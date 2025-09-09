// src/app/api/s1/therapy-sessions/start/route.ts

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
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'Missing required field: session_id' },
        { status: 400 }
      );
    }

    const supabase = createClient();

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

    // Generate initial AI patient greeting based on their profile
    const aiPatient = updatedSession.s1_ai_patients;
    const initialGreeting = generateInitialPatientGreeting(aiPatient, updatedSession.session_number);

    // Save the initial AI greeting message
    const { error: messageError } = await supabase
      .from('s1_session_messages')
      .insert([{
        session_id: session_id,
        role: 'ai_patient',
        content: initialGreeting.content,
        message_type: 'text',
        timestamp_in_session: '00:00:00',
        emotional_tone: initialGreeting.emotional_tone,
        ai_response_reasoning: initialGreeting.reasoning
      }]);

    if (messageError) {
      console.error('Error saving initial message:', messageError);
      // Continue anyway, this isn't critical
    }

    return NextResponse.json({
      session: updatedSession,
      initial_greeting: initialGreeting
    });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions/start:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateInitialPatientGreeting(aiPatient: any, sessionNumber: number) {
  const { personality_traits, primary_concern, severity_level, background_story } = aiPatient;
  
  // Generate context-aware greeting based on patient profile
  let greeting = '';
  let emotionalTone = 'neutral';
  let reasoning = '';

  if (sessionNumber === 1) {
    // First session - more hesitant, establishing rapport
    if (severity_level >= 8) {
      greeting = "Hi... I'm not really sure about this. My friend said I should talk to someone, but I don't know if this will help.";
      emotionalTone = 'anxious';
      reasoning = 'High severity patient showing initial resistance and uncertainty, common for first sessions';
    } else if (severity_level >= 5) {
      greeting = "Hello. I've been having some difficulties lately and thought maybe talking to someone might help.";
      emotionalTone = 'cautious';
      reasoning = 'Moderate severity patient showing willingness but cautiousness';
    } else {
      greeting = "Hi there. I'm looking forward to our conversation today. I've been thinking about some things I'd like to discuss.";
      emotionalTone = 'open';
      reasoning = 'Lower severity patient showing openness and engagement';
    }
  } else {
    // Follow-up sessions - reference previous work
    greeting = `Hi again. I've been thinking about what we talked about last time...`;
    emotionalTone = 'reflective';
    reasoning = 'Follow-up session showing continuity and reflection on previous work';
  }

  return {
    content: greeting,
    emotional_tone: emotionalTone,
    reasoning: reasoning
  };
}