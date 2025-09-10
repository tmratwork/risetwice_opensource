// src/app/api/s1/therapy-sessions/messages/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Mock auth for testing
const getAuth = () => Promise.resolve({ user: { id: 'test-user' } });

export async function GET(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: session_id' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Verify session belongs to the therapist
    const { data: session, error: sessionError } = await supabase
      .from('s1_therapy_sessions')
      .select('id, therapist_id')
      .eq('id', sessionId)
      .eq('therapist_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get session messages
    const { data: messages, error } = await supabase
      .from('s1_session_messages')
      .select(`
        id,
        role,
        content,
        message_type,
        timestamp_in_session,
        emotional_tone,
        therapeutic_techniques,
        ai_response_reasoning,
        audio_url,
        audio_duration_seconds,
        created_at
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching session messages:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    return NextResponse.json({ messages });

  } catch (error) {
    console.error('Error in GET /api/s1/therapy-sessions/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuth();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      session_id,
      role,
      content,
      message_type = 'text',
      timestamp_in_session,
      audio_url,
      audio_duration_seconds
    } = body;

    if (!session_id || !role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: session_id, role, content' },
        { status: 400 }
      );
    }

    if (!['therapist', 'ai_patient'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be therapist or ai_patient' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin;

    // Verify session belongs to the therapist and is in progress
    const { data: session, error: sessionError } = await supabase
      .from('s1_therapy_sessions')
      .select(`
        id, 
        therapist_id, 
        status, 
        started_at,
        ai_patient_id,
        s1_ai_patients!inner (
          personality_traits,
          behavioral_patterns,
          session_config,
          primary_concern,
          severity_level
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

    // Calculate timestamp in session if not provided
    let calculatedTimestamp = timestamp_in_session;
    if (!calculatedTimestamp && session.started_at) {
      const sessionStart = new Date(session.started_at);
      const now = new Date();
      const diffMs = now.getTime() - sessionStart.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSeconds / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;
      calculatedTimestamp = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    const messageData: Record<string, unknown> = {
      session_id,
      role,
      content,
      message_type,
      timestamp_in_session: calculatedTimestamp || '00:00:00',
      audio_url,
      audio_duration_seconds
    };

    // If this is a therapist message, analyze for therapeutic techniques
    if (role === 'therapist') {
      const therapeuticTechniques = analyzeTherapeuticTechniques(content);
      messageData.therapeutic_techniques = therapeuticTechniques;
      messageData.emotional_tone = 'professional'; // Could be enhanced with emotion detection
    }

    // If this is an AI patient message, we might want to generate it based on therapist input
    if (role === 'ai_patient' && content === '[GENERATE_RESPONSE]') {
      // Generate AI patient response based on therapist's last message and patient profile
      const aiResponse = await generateAIPatientResponse(session_id, session as SessionWithPatient, supabase);
      messageData.content = aiResponse.content;
      messageData.emotional_tone = aiResponse.emotional_tone;
      messageData.ai_response_reasoning = aiResponse.reasoning;
    }

    const { data: newMessage, error } = await supabase
      .from('s1_session_messages')
      .insert([messageData])
      .select(`
        id,
        role,
        content,
        message_type,
        timestamp_in_session,
        emotional_tone,
        therapeutic_techniques,
        ai_response_reasoning,
        audio_url,
        audio_duration_seconds,
        created_at
      `)
      .single();

    if (error) {
      console.error('Error saving message:', error);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    return NextResponse.json({ message: newMessage }, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/s1/therapy-sessions/messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function analyzeTherapeuticTechniques(content: string): Record<string, boolean> {
  const techniques: Record<string, boolean> = {};
  const lowerContent = content.toLowerCase();

  // Simple technique detection (would be enhanced with NLP in production)
  if (lowerContent.includes('how did that make you feel') || lowerContent.includes('what emotions')) {
    techniques.emotion_exploration = true;
  }

  if (lowerContent.includes('tell me more about') || lowerContent.includes('can you explain')) {
    techniques.open_ended_questioning = true;
  }

  if (lowerContent.includes('it sounds like') || lowerContent.includes('what i hear you saying')) {
    techniques.reflection = true;
  }

  if (lowerContent.includes('have you considered') || lowerContent.includes('what if you tried')) {
    techniques.suggestion_offering = true;
  }

  if (lowerContent.includes('that must have been difficult') || lowerContent.includes('i can understand')) {
    techniques.empathy_validation = true;
  }

  return techniques;
}

interface AIPatientData {
  primary_concern: string;
  personality_traits: Record<string, unknown>;
  behavioral_patterns: Record<string, unknown>;
  session_config: Record<string, unknown>;
  severity_level: number;
}

interface SessionWithPatient extends Record<string, unknown> {
  s1_ai_patients: AIPatientData[];
}

async function generateAIPatientResponse(sessionId: string, session: SessionWithPatient, supabase: typeof supabaseAdmin) {
  try {
    // Get recent therapist messages for context
    const { data: recentMessages } = await supabase
      .from('s1_session_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(3);

    const lastTherapistMessage = recentMessages?.find((m: { role: string; content: string }) => m.role === 'therapist')?.content || '';
    const aiPatient = session.s1_ai_patients[0];
    
    // Simple response generation based on patient profile and therapist input
    // In production, this would use OpenAI with detailed prompts
    
    let response = '';
    let emotionalTone = 'neutral';
    let reasoning = '';

    if (aiPatient && aiPatient.primary_concern === 'anxiety') {
      if (lastTherapistMessage.toLowerCase().includes('feel')) {
        response = "I feel... worried a lot of the time. Like something bad is going to happen even when everything seems okay.";
        emotionalTone = 'anxious';
        reasoning = 'Anxiety patient responding to emotion-focused question with characteristic worry patterns';
      } else {
        response = "Sometimes I just can't shake this feeling that things are going to go wrong.";
        emotionalTone = 'worried';
        reasoning = 'General anxiety response showing persistent worry';
      }
    } else if (aiPatient && aiPatient.primary_concern === 'depression') {
      if (lastTherapistMessage.toLowerCase().includes('feel')) {
        response = "I feel... empty, I guess. Like nothing really matters anymore.";
        emotionalTone = 'sad';
        reasoning = 'Depression patient responding with characteristic emptiness and anhedonia';
      } else {
        response = "It's hard to find motivation for anything lately.";
        emotionalTone = 'flat';
        reasoning = 'Depression response showing lack of motivation';
      }
    } else {
      response = "That's a good question. I need to think about that.";
      emotionalTone = 'reflective';
      reasoning = 'Generic response while processing therapist input';
    }

    return {
      content: response,
      emotional_tone: emotionalTone,
      reasoning: reasoning
    };

  } catch (error) {
    console.error('Error generating AI patient response:', error);
    return {
      content: "I'm not sure how to respond to that right now.",
      emotional_tone: 'uncertain',
      reasoning: 'Fallback response due to generation error'
    };
  }
}