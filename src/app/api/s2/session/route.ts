// src/app/api/s2/session/route.ts
// Create and manage S2 case simulation sessions

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateSessionRequest {
  userId: string; // Firebase UID
  generatedScenarioId: string; // UUID from s2_generated_scenarios
  aiPersonalityPrompt: string;
  isAdminPreview?: boolean; // Optional flag for admin preview mode
  therapistProfileId?: string; // Required for admin preview mode
}

export async function POST(request: NextRequest) {
  try {
    const data: CreateSessionRequest = await request.json();

    // Validate required fields
    if (!data.userId || !data.aiPersonalityPrompt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For admin preview, generatedScenarioId is optional and therapistProfileId is required
    if (data.isAdminPreview) {
      if (!data.therapistProfileId) {
        return NextResponse.json(
          { error: 'therapistProfileId is required for admin preview mode' },
          { status: 400 }
        );
      }
      console.log('[S2] Creating ADMIN PREVIEW session for therapist:', data.therapistProfileId);
    } else {
      if (!data.generatedScenarioId) {
        return NextResponse.json(
          { error: 'generatedScenarioId is required for normal sessions' },
          { status: 400 }
        );
      }
      console.log('[S2] Creating case simulation session for user:', data.userId);
    }

    // Get therapist profile
    let profile;
    if (data.isAdminPreview) {
      // For admin preview, use the provided therapist profile ID directly
      const { data: adminProfile, error: adminProfileError } = await supabase
        .from('s2_therapist_profiles')
        .select('id')
        .eq('id', data.therapistProfileId)
        .single();

      if (adminProfileError || !adminProfile) {
        return NextResponse.json(
          { error: 'Therapist profile not found for admin preview' },
          { status: 400 }
        );
      }
      profile = adminProfile;
    } else {
      // For normal sessions, look up by user ID
      const { data: userProfile, error: userProfileError } = await supabase
        .from('s2_therapist_profiles')
        .select('id')
        .eq('user_id', data.userId)
        .single();

      if (userProfileError || !userProfile) {
        return NextResponse.json(
          { error: 'Therapist profile not found' },
          { status: 400 }
        );
      }
      profile = userProfile;
    }

    // Handle scenario verification (optional for admin preview)
    let scenario = null;
    let scenarioId = null;

    if (!data.isAdminPreview && data.generatedScenarioId) {
      // For normal sessions, verify scenario exists and belongs to this user
      const { data: verifiedScenario, error: scenarioError } = await supabase
        .from('s2_generated_scenarios')
        .select('id, scenario_text')
        .eq('id', data.generatedScenarioId)
        .eq('therapist_profile_id', profile.id)
        .single();

      if (scenarioError || !verifiedScenario) {
        return NextResponse.json(
          { error: 'Generated scenario not found or access denied' },
          { status: 400 }
        );
      }
      scenario = verifiedScenario;
      scenarioId = verifiedScenario.id;
    } else if (data.isAdminPreview) {
      // For admin preview, create a dummy scenario record
      const { data: dummyScenario, error: dummyScenarioError } = await supabase
        .from('s2_generated_scenarios')
        .insert({
          therapist_profile_id: profile.id,
          scenario_text: 'Admin Preview Session: Testing generated AI therapist prompt with realistic patient simulation.',
          scenario_type: 'admin_preview',
          complexity_level: 3,
          extracted_themes: ['admin-testing', 'prompt-validation'],
          used_in_session: true
        })
        .select('id, scenario_text')
        .single();

      if (dummyScenarioError || !dummyScenario) {
        console.error('[S2] Error creating dummy scenario for admin preview:', dummyScenarioError);
        return NextResponse.json(
          { error: 'Failed to create admin preview scenario' },
          { status: 500 }
        );
      }

      scenario = dummyScenario;
      scenarioId = dummyScenario.id;
    }

    // Get next session number for this therapist
    const { data: sessionCount } = await supabase
      .from('s2_case_simulation_sessions')
      .select('session_number')
      .eq('therapist_profile_id', profile.id)
      .order('session_number', { ascending: false })
      .limit(1)
      .single();

    const nextSessionNumber = (sessionCount?.session_number || 0) + 1;

    // Create new session
    const sessionInsert = {
      therapist_profile_id: profile.id,
      generated_scenario_id: scenarioId || data.generatedScenarioId,
      session_number: nextSessionNumber,
      ai_personality_prompt: data.aiPersonalityPrompt,
      voice_model: 'alloy', // Same as S1
      status: 'created'
    };

    const { data: session, error } = await supabase
      .from('s2_case_simulation_sessions')
      .insert(sessionInsert)
      .select()
      .single();

    if (error) {
      console.error('[S2] Error creating session:', error);
      return NextResponse.json(
        { error: 'Failed to create session', details: error.message },
        { status: 500 }
      );
    }

    // Mark scenario as used (for normal sessions only, admin scenarios are already marked)
    if (!data.isAdminPreview && data.generatedScenarioId) {
      await supabase
        .from('s2_generated_scenarios')
        .update({ used_in_session: true })
        .eq('id', data.generatedScenarioId);
    }

    console.log('[S2] ✅ Case simulation session created:', session.id);

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        sessionNumber: session.session_number,
        status: session.status,
        aiPersonalityPrompt: session.ai_personality_prompt,
        voiceModel: session.voice_model,
        createdAt: session.created_at,
        scenarioText: scenario?.scenario_text || 'Admin Preview Session'
      }
    });

  } catch (error) {
    console.error('[S2] Error in session creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle message saving and session ending
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, sessionId, userId } = data;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'sessionId and userId are required' },
        { status: 400 }
      );
    }

    if (action === 'save_message') {
      const { messageData } = data;
      if (!messageData) {
        return NextResponse.json(
          { error: 'messageData is required for save_message action' },
          { status: 400 }
        );
      }

      console.log('[S2] Saving message for session:', sessionId);
      
      // Save message to database with enhanced S2 fields
      console.log('[S2] [message_persistence] Saving message to s2_session_messages:', {
        sessionId,
        role: messageData.role,
        contentLength: messageData.content?.length || 0,
        messageId: messageData.messageId
      });

      // Get the next sequence number for this session
      const { data: sequenceData } = await supabase
        .from('s2_session_messages')
        .select('message_sequence')
        .eq('session_id', sessionId)
        .order('message_sequence', { ascending: false })
        .limit(1);

      const nextSequence = sequenceData && sequenceData.length > 0 ? sequenceData[0].message_sequence + 1 : 1;

      const { error: messageError } = await supabase
        .from('s2_session_messages')
        .insert({
          session_id: sessionId,
          role: messageData.role,
          content: messageData.content,
          message_type: 'webrtc', // Mark as WebRTC message
          openai_message_id: messageData.messageId || null, // Store OpenAI message ID
          is_final_transcript: true, // Only final messages are saved
          emotional_tone: messageData.emotional_tone || null,
          word_count: messageData.word_count || messageData.content?.split(' ').length || 0,
          sentiment_score: messageData.sentiment_score || null,
          clinical_relevance: messageData.clinical_relevance || null,
          message_sequence: nextSequence, // CRITICAL: Required field
          timestamp_in_session: Math.floor(Date.now() / 1000) // Unix timestamp
        });

      if (messageError) {
        console.error('[S2] Error saving message:', messageError);
        return NextResponse.json(
          { error: 'Failed to save message' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
      
    } else if (action === 'end_session') {
      const { duration } = data;
      
      console.log('[S2] Ending session:', sessionId);
      
      const { error: endError } = await supabase
        .from('s2_case_simulation_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: duration
        })
        .eq('id', sessionId);

      if (endError) {
        console.error('[S2] Error ending session:', endError);
        return NextResponse.json(
          { error: 'Failed to end session' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[S2] Error in PUT request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Start session (mark as active)
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action'); // 'start' or 'end'

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'sessionId and action parameters required' },
        { status: 400 }
      );
    }

    let updateData: {
      status?: string;
      started_at?: string;
      ended_at?: string;
      duration_seconds?: number;
    } = {};

    if (action === 'start') {
      updateData = {
        status: 'active',
        started_at: new Date().toISOString()
      };
    } else if (action === 'end') {
      // Get session to calculate duration
      const { data: session } = await supabase
        .from('s2_case_simulation_sessions')
        .select('started_at')
        .eq('id', sessionId)
        .single();

      const duration = session?.started_at 
        ? Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
        : 0;

      updateData = {
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: duration
      };
    }

    const { data: updatedSession, error } = await supabase
      .from('s2_case_simulation_sessions')
      .update(updateData)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`[S2] Error ${action}ing session:`, error);
      return NextResponse.json(
        { error: `Failed to ${action} session` },
        { status: 500 }
      );
    }

    console.log(`[S2] ✅ Session ${action}ed:`, sessionId);

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession.id,
        status: updatedSession.status,
        startedAt: updatedSession.started_at,
        endedAt: updatedSession.ended_at,
        durationSeconds: updatedSession.duration_seconds
      }
    });

  } catch (error) {
    console.error('[S2] Error in session update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}