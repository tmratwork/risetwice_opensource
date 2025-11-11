import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// BEST PRACTICE: Direct API route import for server-to-server calls
// Benefits: No HTTP overhead, no port conflicts, works in all environments
import { POST as voiceCombineAPI } from '@/app/api/s2/voice-combine/route';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Audio combination settings
const MIN_AUDIO_DURATION_MS = 10000; // 10 seconds (ElevenLabs minimum)
const MAX_AUDIO_DURATION_MS = 1200000; // 20 minutes

interface SessionAudio {
  id: string;
  duration_seconds: number;
  voice_recording_url: string;
  created_at: string;
  session_number: number;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { therapistProfileId } = body;

  try {
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

    // CRITICAL: Atomic database-level lock to prevent race condition
    // Uses unique partial index: idx_unique_voice_cloning_processing
    // This ensures only ONE voice cloning operation can run per therapist at a time
    console.log(`[voice_cloning] 🔒 Attempting to acquire voice cloning lock (atomic operation)...`);

    // First, check current status
    const { data: currentStatus } = await supabase
      .from('s2_therapist_profiles')
      .select('voice_cloning_status, cloned_voice_id, full_name')
      .eq('id', therapistProfileId)
      .single();

    // Only proceed if status is null, completed, or failed
    if (currentStatus?.voice_cloning_status === 'processing') {
      console.log(`[voice_cloning] 🛑 Voice cloning already in progress for therapist: ${therapistProfileId}`);
      console.log(`[voice_cloning] ⏭️ Skipping duplicate request (already processing)`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Voice cloning already in progress',
        voice_id: currentStatus.cloned_voice_id || null
      });
    }

    // Try to acquire lock by updating to 'processing'
    const { data: lockResult, error: lockError } = await supabase
      .from('s2_therapist_profiles')
      .update({
        voice_cloning_status: 'processing',
        voice_cloning_started_at: new Date().toISOString()
      })
      .eq('id', therapistProfileId)
      .select('cloned_voice_id, full_name')
      .single();

    // Check for unique constraint violation (23505 = duplicate key error)
    if (lockError) {
      console.log(`[voice_cloning] 🔍 Lock error details:`, {
        code: lockError.code,
        message: lockError.message,
        details: lockError.details
      });

      // If constraint violation, another operation is already in progress
      if (lockError.code === '23505' || lockError.message?.includes('unique constraint')) {
        console.log(`[voice_cloning] 🛑 Voice cloning already in progress for therapist: ${therapistProfileId}`);
        console.log(`[voice_cloning] ⏭️ Skipping duplicate request (blocked by database constraint)`);

        // Fetch current voice ID to return
        const { data: currentProfile } = await supabase
          .from('s2_therapist_profiles')
          .select('cloned_voice_id')
          .eq('id', therapistProfileId)
          .single();

        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Voice cloning already in progress',
          voice_id: currentProfile?.cloned_voice_id || null
        });
      }

      // Other database errors
      console.log(`[voice_cloning] ❌ Failed to acquire lock: ${lockError.message}`);
      return NextResponse.json(
        {
          success: false,
          error: 'LOCK_FAILED',
          message: `Failed to start voice cloning: ${lockError.message}`
        },
        { status: 500 }
      );
    }

    // Lock acquired successfully - we already have the profile data from lockResult
    console.log(`[voice_cloning] ✅ Lock acquired successfully for therapist: ${lockResult?.full_name || therapistProfileId}`);

    // Get full profile details including session count
    console.log(`[voice_cloning] 🔍 Fetching profile details...`);
    const { data: existingProfile, error: profileError } = await supabase
      .from('s2_therapist_profiles')
      .select('cloned_voice_id, full_name, voice_cloning_session_count')
      .eq('id', therapistProfileId)
      .single();

    if (profileError) {
      console.log(`[voice_cloning] ❌ Therapist profile not found: ${profileError.message}`);
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
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

    // Get all sessions with audio for this therapist, ordered by most recent first
    console.log(`[voice_cloning] 🎧 Searching for audio sessions...`);
    const { data: allSessions, error: sessionsError } = await supabase
      .from('s2_case_simulation_sessions')
      .select(`
        id,
        duration_seconds,
        voice_recording_url,
        created_at,
        session_number,
        total_chunks,
        uploaded_chunks,
        voice_recording_uploaded
      `)
      .eq('therapist_profile_id', therapistProfileId)
      .not('duration_seconds', 'is', null)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (sessionsError) {
      console.log(`[voice_cloning] ❌ Failed to query sessions: ${sessionsError.message}`);
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
      return NextResponse.json(
        {
          success: false,
          error: 'SESSIONS_QUERY_FAILED',
          message: `Failed to retrieve sessions: ${sessionsError.message}`
        },
        { status: 500 }
      );
    }

    console.log(`[voice_cloning] 📊 Found ${allSessions?.length || 0} completed sessions`);

    // Filter sessions that have either:
    // 1. A combined voice_recording_url (already processed)
    // 2. All chunks uploaded (ready to be combined)
    const sessionsWithAudio = allSessions?.filter(session => {
      // Has combined audio file
      if (session.voice_recording_url) {
        console.log(`[voice_cloning] ✅ Session #${session.session_number}: has combined audio`);
        return true;
      }
      // Has all chunks uploaded but not yet combined
      if (session.total_chunks && session.uploaded_chunks &&
          session.total_chunks === session.uploaded_chunks) {
        console.log(`[voice_cloning] ⚠️ Session #${session.session_number}: has ${session.uploaded_chunks}/${session.total_chunks} chunks but not combined yet`);
        return true;
      }
      console.log(`[voice_cloning] ❌ Session #${session.session_number}: no audio available (${session.uploaded_chunks || 0}/${session.total_chunks || 0} chunks)`);
      return false;
    }) || [];

    console.log(`[voice_cloning] 📊 Found ${sessionsWithAudio.length} sessions with audio (combined or chunks)`);

    if (sessionsWithAudio.length === 0) {
      console.log(`[voice_cloning] ❌ No audio sessions found for voice cloning`);
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
      return NextResponse.json(
        {
          success: false,
          error: 'NO_AUDIO_SESSIONS',
          message: `No completed audio sessions found for ${existingProfile.full_name}. Audio sessions are required for voice cloning.`
        },
        { status: 400 }
      );
    }

    // Separate sessions into those with combined audio and those needing combination
    const sessionsNeedingCombination = sessionsWithAudio.filter(s =>
      !s.voice_recording_url && s.total_chunks === s.uploaded_chunks
    );

    if (sessionsNeedingCombination.length > 0) {
      console.log(`[voice_cloning] 🔄 Found ${sessionsNeedingCombination.length} sessions that need chunk combining`);
      console.log(`[voice_cloning] 🔧 Triggering automatic chunk combination...`);

      // Track successfully combined session IDs
      const successfullyCombinedIds: string[] = [];

      // Combine chunks for sessions that need it
      for (const session of sessionsNeedingCombination) {
        try {
          console.log(`[voice_cloning] 🔗 Combining chunks for session #${session.session_number} (${session.id})`);

          // BEST PRACTICE: Direct server-side function call (no HTTP overhead, no port issues)
          // Create a mock Request object for the API route handler
          const mockRequest = new NextRequest(
            new URL('http://localhost/api/s2/voice-combine'),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId: session.id })
            }
          );

          console.log(`[voice_cloning] 📍 Calling voice-combine API directly (server-to-server)`);

          // Call the API route handler directly
          const combineResponse = await voiceCombineAPI(mockRequest);
          const combineResult = await combineResponse.json();

          console.log(`[voice_cloning] 📡 Voice-combine API response: ${combineResponse.status}`);

          if (!combineResponse.ok || combineResponse.status >= 400) {
            const errorMessage = combineResult.error || combineResult.details || `HTTP ${combineResponse.status}`;
            console.log(`[voice_cloning] ❌ Failed to combine chunks for session #${session.session_number}: ${errorMessage}`);
            continue;
          }

          console.log(`[voice_cloning] ✅ Chunks combined for session #${session.session_number}: ${combineResult.combined_audio_url}`);

          // Update session with combined audio URL
          session.voice_recording_url = combineResult.combined_audio_url;
          session.voice_recording_uploaded = true;

          // Track this session as successfully combined
          successfullyCombinedIds.push(session.id);

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(`[voice_cloning] ❌ Error combining chunks for session #${session.session_number}: ${errorMsg}`);
          if (error instanceof Error && error.stack) {
            console.log(`[voice_cloning] 📚 Error stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
          }
          continue;
        }
      }

      // Log chunk combining results
      console.log(`[voice_cloning] 📊 Chunk combining complete: ${successfullyCombinedIds.length}/${sessionsNeedingCombination.length} successful`);
      if (successfullyCombinedIds.length > 0) {
        console.log(`[voice_cloning] ✅ Successfully combined session IDs: ${successfullyCombinedIds.join(', ')}`);
      }
    }

    // CRITICAL FIX: Re-query database to get fresh data with updated voice_recording_url values
    // The in-memory updates above don't persist to the original query result
    console.log(`[voice_cloning] 🔄 Re-querying database to get updated session data...`);
    const { data: refreshedSessions, error: refreshError } = await supabase
      .from('s2_case_simulation_sessions')
      .select('id, duration_seconds, voice_recording_url, created_at, session_number')
      .eq('therapist_profile_id', therapistProfileId)
      .not('duration_seconds', 'is', null)
      .eq('status', 'completed')
      .not('voice_recording_url', 'is', null)
      .order('created_at', { ascending: false });

    if (refreshError) {
      console.log(`[voice_cloning] ❌ Failed to refresh session data: ${refreshError.message}`);
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
      return NextResponse.json(
        {
          success: false,
          error: 'SESSION_REFRESH_FAILED',
          message: `Failed to refresh session data: ${refreshError.message}`
        },
        { status: 500 }
      );
    }

    // Now get all sessions with combined audio (from fresh database query)
    const sessions = refreshedSessions || [];

    console.log(`[voice_cloning] 📊 Using ${sessions.length} sessions with combined audio`);

    // Log session details for debugging
    if (sessions.length > 0) {
      console.log(`[voice_cloning] 📋 Session breakdown:`);
      sessions.forEach((s, idx) => {
        const durationMin = Math.floor(s.duration_seconds / 60);
        const durationSec = s.duration_seconds % 60;
        console.log(`[voice_cloning]   ${idx + 1}. Session #${s.session_number}: ${durationMin}m ${durationSec}s - ${new Date(s.created_at).toLocaleDateString()}`);
      });
    }

    if (sessions.length === 0) {
      console.log(`[voice_cloning] ❌ No sessions with combined audio available after database refresh`);
      console.log(`[voice_cloning] 🔍 Debug: sessionsNeedingCombination had ${sessionsNeedingCombination.length} sessions`);
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
      return NextResponse.json(
        {
          success: false,
          error: 'NO_COMBINED_AUDIO',
          message: `No sessions with combined audio found after refresh. Audio combination may have failed.`
        },
        { status: 400 }
      );
    }

    // Check if re-cloning is needed
    const previousSessionCount = existingProfile.voice_cloning_session_count || 0;
    const currentSessionCount = sessions.length;

    console.log(`[voice_cloning] 🔍 Re-cloning decision check:`);
    console.log(`[voice_cloning]   - Has existing voice: ${!!existingProfile.cloned_voice_id ? 'YES' : 'NO'}`);
    console.log(`[voice_cloning]   - Existing voice ID: ${existingProfile.cloned_voice_id || 'none'}`);
    console.log(`[voice_cloning]   - Previous session count: ${previousSessionCount}`);
    console.log(`[voice_cloning]   - Current session count: ${currentSessionCount}`);
    console.log(`[voice_cloning]   - New sessions available: ${currentSessionCount - previousSessionCount}`);
    console.log(`[voice_cloning]   - Should re-clone: ${existingProfile.cloned_voice_id && currentSessionCount > previousSessionCount ? 'YES ✅' : 'NO ❌'}`);

    if (existingProfile.cloned_voice_id && currentSessionCount <= previousSessionCount) {
      console.log(`[voice_cloning] ⏭️ Voice cloning skipped: voice already exists and no new audio material`);
      console.log(`[voice_cloning] 📊 Current sessions: ${currentSessionCount}, Last clone used: ${previousSessionCount}`);
      return NextResponse.json({
        success: true,
        skipped: true,
        voice_id: existingProfile.cloned_voice_id,
        message: `Voice already exists and no new audio material available`,
        sessions_available: currentSessionCount,
        sessions_in_last_clone: previousSessionCount
      });
    }

    // If voice exists and we have new material, delete old voice first
    if (existingProfile.cloned_voice_id) {
      const newSessionCount = currentSessionCount - previousSessionCount;
      console.log(`[voice_cloning] 🔄 Re-cloning detected: ${newSessionCount} new sessions available`);
      console.log(`[voice_cloning] 🗑️ Deleting existing voice from ElevenLabs: ${existingProfile.cloned_voice_id}`);

      try {
        await deleteVoiceFromElevenLabs(existingProfile.cloned_voice_id);
        console.log(`[voice_cloning] ✅ Existing voice deleted successfully`);
      } catch (deleteError) {
        console.error(`[voice_cloning] ⚠️ Failed to delete existing voice (will proceed anyway):`, deleteError);
        // Continue with cloning even if delete fails
      }
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
      // Reset status before returning error
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);
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

    // Store voice ID and tracking info in database + reset status
    console.log(`[voice_cloning] 💾 Saving voice ID and tracking data to database...`);
    const { error: updateError } = await supabase
      .from('s2_therapist_profiles')
      .update({
        cloned_voice_id: voiceId,
        voice_last_cloned_at: new Date().toISOString(),
        voice_cloning_session_count: selectedSessions.length,
        voice_cloning_status: 'completed' // Reset status to allow future operations
      })
      .eq('id', therapistProfileId);

    if (updateError) {
      console.log(`[voice_cloning] ❌ Database update failed: ${updateError.message}`);
      // If database update fails, clean up the created voice and reset status
      try {
        console.log(`[voice_cloning] 🧹 Cleaning up created voice from ElevenLabs...`);
        await deleteVoiceFromElevenLabs(voiceId);
        console.log(`[voice_cloning] ✅ Voice cleanup successful`);
      } catch (cleanupError) {
        console.error(`[voice_cloning] ❌ Failed to cleanup voice after database error:`, cleanupError);
      }

      // Reset status to allow retry
      await supabase
        .from('s2_therapist_profiles')
        .update({
          voice_cloning_status: 'failed',
          voice_cloning_started_at: null
        })
        .eq('id', therapistProfileId);

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

    // Reset status to allow retry
    if (therapistProfileId) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        console.log(`[voice_cloning] 🔓 Resetting voice_cloning_status to 'failed' to allow retry`);
        await supabase
          .from('s2_therapist_profiles')
          .update({
            voice_cloning_status: 'failed',
            voice_cloning_started_at: null
          })
          .eq('id', therapistProfileId);
      } catch (resetError) {
        console.error(`[voice_cloning] ❌ Failed to reset status:`, resetError);
      }
    }

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

  // Create blob from buffer (convert Buffer to Uint8Array for compatibility)
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mp3' });
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