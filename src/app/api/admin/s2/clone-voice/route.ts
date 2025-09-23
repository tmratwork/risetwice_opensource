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

    console.log(`[voice_cloning] 🚀 Starting voice cloning process for therapist: ${therapistProfileId}`);

    if (!therapistProfileId) {
      console.log(`[voice_cloning] ❌ Missing therapist profile ID`);
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
    console.log(`[voice_cloning] 🔍 Checking for existing voice clone...`);
    const { data: existingProfile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('cloned_voice_id, full_name')
      .eq('id', therapistProfileId)
      .single();

    if (profileError) {
      console.log(`[voice_cloning] ❌ Therapist profile not found: ${profileError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'THERAPIST_NOT_FOUND',
          message: `Failed to find therapist profile: ${profileError.message}`
        },
        { status: 404 }
      );
    }

    console.log(`[voice_cloning] 👩‍⚕️ Found therapist: ${existingProfile.full_name}`);

    if (existingProfile.cloned_voice_id) {
      console.log(`[voice_cloning] ⚠️ Voice already exists: ${existingProfile.cloned_voice_id}`);
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
    console.log(`[voice_cloning] 🎧 Searching for audio sessions...`);
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
      console.log(`[voice_cloning] ❌ Failed to query sessions: ${sessionsError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'SESSIONS_QUERY_FAILED',
          message: `Failed to retrieve sessions: ${sessionsError.message}`
        },
        { status: 500 }
      );
    }

    console.log(`[voice_cloning] 📊 Found ${sessions?.length || 0} completed sessions with audio`);

    if (!sessions || sessions.length === 0) {
      console.log(`[voice_cloning] ❌ No audio sessions found for voice cloning`);
      return NextResponse.json(
        {
          success: false,
          error: 'NO_AUDIO_SESSIONS',
          message: `No completed audio sessions found for ${existingProfile.full_name}. Audio sessions are required for voice cloning.`
        },
        { status: 400 }
      );
    }

    // Log session details
    sessions.forEach((session, index) => {
      const durationMin = Math.floor(session.duration_seconds / 60);
      const durationSec = session.duration_seconds % 60;
      console.log(`[voice_cloning] 📝 Session #${session.session_number} (${index + 1}/${sessions.length}): ${durationMin}m ${durationSec}s - ${new Date(session.created_at).toLocaleDateString()}`);
    });

    // Calculate total available audio duration
    const totalAvailableMs = sessions.reduce((total, session) =>
      total + (session.duration_seconds * 1000), 0
    );

    const totalAvailableMinutes = Math.floor(totalAvailableMs / 60000);
    const totalAvailableSeconds = Math.floor((totalAvailableMs % 60000) / 1000);
    console.log(`[voice_cloning] ⏱️ Total available audio: ${totalAvailableMinutes}m ${totalAvailableSeconds}s`);

    if (totalAvailableMs < MIN_AUDIO_DURATION_MS) {
      const availableMinutes = Math.floor(totalAvailableMs / 60000);
      const requiredMinutes = Math.floor(MIN_AUDIO_DURATION_MS / 60000);
      console.log(`[voice_cloning] ❌ Insufficient audio: ${availableMinutes}m available, ${requiredMinutes}m required`);
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
    console.log(`[voice_cloning] 🎯 Selecting sessions for voice cloning (max ${Math.floor(MAX_AUDIO_DURATION_MS / 60000)}m)...`);
    const selectedSessions: SessionAudio[] = [];
    let totalSelectedMs = 0;

    for (const session of sessions) {
      const sessionMs = session.duration_seconds * 1000;

      if (totalSelectedMs + sessionMs <= MAX_AUDIO_DURATION_MS) {
        selectedSessions.push(session);
        totalSelectedMs += sessionMs;
        console.log(`[voice_cloning] ✅ Selected session #${session.session_number}: ${Math.floor(sessionMs / 60000)}m ${Math.floor((sessionMs % 60000) / 1000)}s`);
      } else {
        // If adding this session would exceed max, check if we should truncate it
        const remainingMs = MAX_AUDIO_DURATION_MS - totalSelectedMs;
        if (remainingMs > 30000) { // Only truncate if remaining time is > 30 seconds
          selectedSessions.push({
            ...session,
            duration_seconds: Math.floor(remainingMs / 1000)
          });
          totalSelectedMs = MAX_AUDIO_DURATION_MS;
          console.log(`[voice_cloning] ✂️ Partially selected session #${session.session_number}: ${Math.floor(remainingMs / 60000)}m ${Math.floor((remainingMs % 60000) / 1000)}s (truncated from ${Math.floor(sessionMs / 60000)}m ${Math.floor((sessionMs % 60000) / 1000)}s)`);
        } else {
          console.log(`[voice_cloning] ⏭️ Skipped session #${session.session_number}: would exceed max duration (only ${Math.floor(remainingMs / 1000)}s remaining)`);
        }
        break;
      }
    }

    // Show any skipped sessions
    if (selectedSessions.length < sessions.length) {
      const skippedCount = sessions.length - selectedSessions.length;
      const skippedSessions = sessions.slice(selectedSessions.length).map(s => s.session_number);
      console.log(`[voice_cloning] ⏭️ Skipped ${skippedCount} older sessions: #${skippedSessions.join(', #')} (exceeded ${Math.floor(MAX_AUDIO_DURATION_MS / 60000)}m limit)`);
    }

    const selectedMinutes = Math.floor(totalSelectedMs / 60000);
    const selectedSeconds = Math.floor((totalSelectedMs % 60000) / 1000);
    console.log(`[voice_cloning] 📋 Final selection: ${selectedSessions.length} sessions, ${selectedMinutes}m ${selectedSeconds}s total (most recent audio prioritized)`);

    // Download and combine audio files
    console.log(`[voice_cloning] 📥 Downloading and combining audio files...`);
    const combinedAudioBuffer = await combineAudioFiles(selectedSessions);

    // Clone voice with ElevenLabs
    console.log(`[voice_cloning] 🚀 Sending audio to ElevenLabs for voice cloning...`);
    const voiceId = await cloneVoiceWithElevenLabs(
      combinedAudioBuffer,
      existingProfile.full_name
    );
    console.log(`[voice_cloning] ✅ Voice successfully cloned with ID: ${voiceId}`);

    // Store voice ID in database
    console.log(`[voice_cloning] 💾 Saving voice ID to database...`);
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({ cloned_voice_id: voiceId })
      .eq('id', therapistProfileId);

    if (updateError) {
      console.log(`[voice_cloning] ❌ Database update failed: ${updateError.message}`);
      // If database update fails, clean up the created voice
      try {
        console.log(`[voice_cloning] 🧹 Cleaning up created voice from ElevenLabs...`);
        await deleteVoiceFromElevenLabs(voiceId);
        console.log(`[voice_cloning] ✅ Voice cleanup successful`);
      } catch (cleanupError) {
        console.error(`[voice_cloning] ❌ Failed to cleanup voice after database error:`, cleanupError);
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

    console.log(`[voice_cloning] 🎉 Voice cloning completed successfully!`);
    console.log(`[voice_cloning] 📊 Final stats: ${selectedSessions.length} sessions, ${selectedMinutes}m ${selectedSeconds}s audio, voice ID: ${voiceId}`);

    return NextResponse.json({
      success: true,
      voice_id: voiceId,
      message: `Voice clone created successfully for ${existingProfile.full_name}`,
      audio_duration_used: `${selectedMinutes}m ${selectedSeconds}s`,
      sessions_used: selectedSessions.length,
      session_numbers: selectedSessions.map(s => s.session_number).join(', ')
    });

  } catch (error) {
    console.error(`[voice_cloning] ❌ Voice cloning process failed:`, error);
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

  console.log(`[voice_cloning] 🔄 Processing ${sessions.length} audio files...`);

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    try {
      console.log(`[voice_cloning] 📥 Downloading session #${session.session_number} audio (${i + 1}/${sessions.length})...`);

      // Download audio file from Supabase Storage
      const response = await fetch(session.voice_recording_url);

      if (!response.ok) {
        console.log(`[voice_cloning] ❌ Download failed for session #${session.session_number}: HTTP ${response.status}`);
        throw new Error(`Failed to download audio for session ${session.session_number}: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      audioBuffers.push(audioBuffer);

      const sizeKB = Math.round(audioBuffer.length / 1024);
      console.log(`[voice_cloning] ✅ Downloaded session #${session.session_number}: ${sizeKB}KB`);

    } catch (error) {
      console.log(`[voice_cloning] ❌ Failed to process session #${session.session_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to process audio for session ${session.session_number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (audioBuffers.length === 0) {
    console.log(`[voice_cloning] ❌ No audio files could be processed`);
    throw new Error('No audio files could be processed');
  }

  const totalSizeKB = Math.round(audioBuffers.reduce((total, buffer) => total + buffer.length, 0) / 1024);
  console.log(`[voice_cloning] 📊 Successfully downloaded ${audioBuffers.length} audio files, total size: ${totalSizeKB}KB`);

  if (audioBuffers.length === 1) {
    console.log(`[voice_cloning] 📁 Single audio file - using session #${sessions[0].session_number}`);
    return audioBuffers[0];
  }

  // Concatenate multiple MP3 files (simple concatenation works for most MP3 files)
  console.log(`[voice_cloning] 🔗 Concatenating ${audioBuffers.length} audio files (most recent first)...`);

  // Calculate target buffer size and combine buffers
  const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const combinedBuffer = Buffer.alloc(totalLength);

  let offset = 0;
  for (let i = 0; i < audioBuffers.length; i++) {
    const buffer = audioBuffers[i];
    const sessionNum = sessions[i].session_number;

    buffer.copy(combinedBuffer, offset);
    offset += buffer.length;

    const bufferKB = Math.round(buffer.length / 1024);
    console.log(`[voice_cloning] ✅ Added session #${sessionNum} to combined audio (${bufferKB}KB)`);
  }

  const combinedSizeKB = Math.round(combinedBuffer.length / 1024);
  console.log(`[voice_cloning] 🎵 Created combined audio file: ${combinedSizeKB}KB from ${audioBuffers.length} sessions`);

  return combinedBuffer;
}

async function cloneVoiceWithElevenLabs(audioBuffer: Buffer, therapistName: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.log(`[voice_cloning] ❌ Missing ElevenLabs API key`);
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }

  console.log(`[voice_cloning] 🎤 Preparing voice clone for "${therapistName}"...`);

  const formData = new FormData();

  // Create blob from buffer
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
  const sizeKB = Math.round(audioBuffer.length / 1024);
  console.log(`[voice_cloning] 📦 Audio file size: ${sizeKB}KB`);

  formData.append('files', audioBlob, 'voice_sample.mp3');
  formData.append('name', `${therapistName} - AI Clone`);
  formData.append('description', `Voice clone of therapist ${therapistName} for AI simulation`);
  formData.append('remove_background_noise', 'true');

  console.log(`[voice_cloning] 🌐 Sending request to ElevenLabs API...`);
  const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  console.log(`[voice_cloning] 📡 ElevenLabs API response: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.log(`[voice_cloning] ❌ ElevenLabs API error: ${errorText}`);
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log(`[voice_cloning] 📋 ElevenLabs response:`, {
    voice_id: result.voice_id,
    requires_verification: result.requires_verification
  });

  if (!result.voice_id) {
    console.log(`[voice_cloning] ❌ No voice_id in ElevenLabs response`);
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