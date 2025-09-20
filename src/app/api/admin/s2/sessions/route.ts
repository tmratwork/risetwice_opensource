// src/app/api/admin/s2/sessions/route.ts
// API endpoint to fetch session data and transcripts for a specific therapist

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const therapistProfileId = searchParams.get('therapistProfileId');

    if (!therapistProfileId) {
      return NextResponse.json(
        { error: 'therapistProfileId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[S2 Admin] Fetching sessions for therapist profile: ${therapistProfileId}`);

    // Fetch all sessions for this therapist with scenario information and audio recording data
    const { data: sessions, error: sessionsError } = await supabase
      .from('s2_case_simulation_sessions')
      .select(`
        *,
        s2_generated_scenarios (
          id,
          scenario_text,
          ai_personality_prompt,
          generation_model,
          scenario_rating,
          used_in_session,
          created_at
        )
      `)
      .eq('therapist_profile_id', therapistProfileId)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.error('[S2 Admin] Error fetching sessions:', sessionsError);
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: sessionsError.message },
        { status: 500 }
      );
    }

    console.log(`[S2 Admin] Found ${sessions?.length || 0} sessions`);

    // Log first session to check if audio fields are present
    if (sessions && sessions.length > 0) {
      console.log('[S2 Admin] First session data (checking for audio fields):', {
        id: sessions[0].id,
        session_number: sessions[0].session_number,
        status: sessions[0].status,
        voice_recording_url: sessions[0].voice_recording_url,
        voice_recording_uploaded: sessions[0].voice_recording_uploaded,
        voice_recording_size: sessions[0].voice_recording_size
      });
    }

    // For each session, fetch the conversation messages
    const sessionsWithMessages = await Promise.all(
      (sessions || []).map(async (session) => {
        const { data: messages, error: messagesError } = await supabase
          .from('s2_session_messages')
          .select('*')
          .eq('session_id', session.id)
          .order('message_sequence', { ascending: true });

        if (messagesError) {
          console.error(`[S2 Admin] Error fetching messages for session ${session.id}:`, messagesError);
          return {
            ...session,
            messages: [],
            message_count: 0
          };
        }

        return {
          ...session,
          messages: messages || [],
          message_count: messages?.length || 0
        };
      })
    );

    console.log(`[S2 Admin] ✅ Successfully fetched sessions with message data`);

    return NextResponse.json({
      success: true,
      sessions: sessionsWithMessages,
      total: sessionsWithMessages.length
    });

  } catch (error) {
    console.error('[S2 Admin] Error in sessions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}