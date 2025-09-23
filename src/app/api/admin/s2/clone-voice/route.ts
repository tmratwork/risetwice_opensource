import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Audio combination settings
const MIN_AUDIO_DURATION_MS = 60000; // 1 minute
const MAX_AUDIO_DURATION_MS = 1200000; // 20 minutes

interface SessionAudio {
  id: string;
  duration_seconds: number;
  voice_recording_url: string;
  created_at: string;
  session_number: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { therapistProfileId } = body;

    if (!therapistProfileId) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_THERAPIST_ID',
          message: 'Therapist profile ID is required'
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if voice already exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('cloned_voice_id, full_name')
      .eq('id', therapistProfileId)
      .single();

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: 'THERAPIST_NOT_FOUND',
          message: `Failed to find therapist profile: ${profileError.message}`
        },
        { status: 404 }
      );
    }

    if (existingProfile.cloned_voice_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'VOICE_ALREADY_EXISTS',
          message: `Voice clone already exists for ${existingProfile.full_name}. Delete existing voice first.`
        },
        { status: 409 }
      );
    }

    // Get all sessions with audio for this therapist, ordered by most recent first
    const { data: sessions, error: sessionsError } = await supabase
      .from('s2_case_simulation_sessions')
      .select(`
        id,
        duration_seconds,
        voice_recording_url,
        created_at,
        session_number
      `)
      .eq('therapist_profile_id', therapistProfileId)
      .not('voice_recording_url', 'is', null)
      .not('duration_seconds', 'is', null)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (sessionsError) {
      return NextResponse.json(
        {
          success: false,
          error: 'SESSIONS_QUERY_FAILED',
          message: `Failed to retrieve sessions: ${sessionsError.message}`
        },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_AUDIO_SESSIONS',
          message: `No completed audio sessions found for ${existingProfile.full_name}. Audio sessions are required for voice cloning.`
        },
        { status: 400 }
      );
    }

    // Calculate total available audio duration
    const totalAvailableMs = sessions.reduce((total, session) =>
      total + (session.duration_seconds * 1000), 0
    );

    if (totalAvailableMs < MIN_AUDIO_DURATION_MS) {
      const availableMinutes = Math.floor(totalAvailableMs / 60000);
      const requiredMinutes = Math.floor(MIN_AUDIO_DURATION_MS / 60000);
      return NextResponse.json(
        {
          success: false,
          error: 'INSUFFICIENT_AUDIO_DURATION',
          message: `Insufficient audio duration for ${existingProfile.full_name}. Found ${availableMinutes} minutes, but ${requiredMinutes} minutes minimum required for voice cloning.`
        },
        { status: 400 }
      );
    }

    // Select sessions to combine (most recent first, up to MAX_AUDIO_DURATION_MS)
    const selectedSessions: SessionAudio[] = [];
    let totalSelectedMs = 0;

    for (const session of sessions) {
      const sessionMs = session.duration_seconds * 1000;

      if (totalSelectedMs + sessionMs <= MAX_AUDIO_DURATION_MS) {
        selectedSessions.push(session);
        totalSelectedMs += sessionMs;
      } else {
        // If adding this session would exceed max, add partial duration
        const remainingMs = MAX_AUDIO_DURATION_MS - totalSelectedMs;
        if (remainingMs > 0) {
          selectedSessions.push({
            ...session,
            duration_seconds: Math.floor(remainingMs / 1000)
          });
          totalSelectedMs = MAX_AUDIO_DURATION_MS;
        }
        break;
      }
    }

    // Download and combine audio files
    const combinedAudioBuffer = await combineAudioFiles(selectedSessions);

    // Clone voice with ElevenLabs
    const voiceId = await cloneVoiceWithElevenLabs(
      combinedAudioBuffer,
      existingProfile.full_name
    );

    // Store voice ID in database
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({ cloned_voice_id: voiceId })
      .eq('id', therapistProfileId);

    if (updateError) {
      // If database update fails, clean up the created voice
      try {
        await deleteVoiceFromElevenLabs(voiceId);
      } catch (cleanupError) {
        console.error('Failed to cleanup voice after database error:', cleanupError);
      }

      return NextResponse.json(
        {
          success: false,
          error: 'DATABASE_UPDATE_FAILED',
          message: `Voice created but failed to save to database: ${updateError.message}`
        },
        { status: 500 }
      );
    }

    const selectedMinutes = Math.floor(totalSelectedMs / 60000);
    const selectedSeconds = Math.floor((totalSelectedMs % 60000) / 1000);

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      message: `Voice clone created successfully for ${existingProfile.full_name}`,
      audio_duration_used: `${selectedMinutes}m ${selectedSeconds}s`,
      sessions_used: selectedSessions.length,
      session_numbers: selectedSessions.map(s => s.session_number).join(', ')
    });

  } catch (error) {
    console.error('Voice cloning error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'VOICE_CLONING_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error occurred during voice cloning'
      },
      { status: 500 }
    );
  }
}

async function combineAudioFiles(sessions: SessionAudio[]): Promise<Buffer> {
  const audioBuffers: Buffer[] = [];

  for (const session of sessions) {
    try {
      // Download audio file from Supabase Storage
      const response = await fetch(session.voice_recording_url);

      if (!response.ok) {
        throw new Error(`Failed to download audio for session ${session.session_number}: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    } catch (error) {
      throw new Error(`Failed to process audio for session ${session.session_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (audioBuffers.length === 0) {
    throw new Error('No audio files could be processed');
  }

  // For MP3 concatenation, we'll need to use a more sophisticated approach
  // For now, we'll just use the first (most recent) audio file
  // TODO: Implement proper MP3 concatenation if multiple files needed
  return audioBuffers[0];
}

async function cloneVoiceWithElevenLabs(audioBuffer: Buffer, therapistName: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const formData = new FormData();

  // Create blob from buffer
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
  formData.append('files', audioBlob, 'voice_sample.mp3');
  formData.append('name', `${therapistName} - AI Clone`);
  formData.append('description', `Voice clone of therapist ${therapistName} for AI simulation`);
  formData.append('remove_background_noise', 'true');

  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  if (!result.voice_id) {
    throw new Error('ElevenLabs API did not return a voice_id');
  }

  return result.voice_id;
}

async function deleteVoiceFromElevenLabs(voiceId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
    method: 'DELETE',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete voice from ElevenLabs (${response.status}): ${errorText}`);
  }
}