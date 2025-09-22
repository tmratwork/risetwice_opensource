// src/app/api/s2/voice-combine/route.ts
// Combine individual audio chunks into final recording for S2 sessions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface AudioChunk {
  id: string;
  chunk_index: number;
  storage_path: string;
  file_size: number;
  status: string;
}

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[s2_voice_combine]`;

  console.log(`${logPrefix} Received combine request (${requestId})`);

  try {
    const { sessionId, combineAll = true } = await request.json();

    if (!sessionId) {
      console.error(`${logPrefix} No session ID provided`);
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    console.log(`${logPrefix} Combining chunks for session:`, {
      sessionId,
      combineAll
    });

    // Get all uploaded chunks for this session, ordered by chunk_index
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('s2_audio_chunks')
      .select('id, chunk_index, storage_path, file_size, status')
      .eq('session_id', sessionId)
      .eq('status', 'uploaded')
      .order('chunk_index');

    if (chunksError) {
      console.error(`${logPrefix} Failed to fetch chunks:`, chunksError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch audio chunks',
        details: chunksError.message
      }, { status: 500 });
    }

    if (!chunks || chunks.length === 0) {
      console.log(`${logPrefix} No uploaded chunks found for session ${sessionId}`);
      return NextResponse.json({
        success: false,
        error: 'No uploaded audio chunks found for this session'
      }, { status: 404 });
    }

    console.log(`${logPrefix} Found ${chunks.length} chunks to combine:`, {
      chunkCount: chunks.length,
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.file_size, 0),
      chunkIndexes: chunks.map(c => c.chunk_index)
    });

    // Download and combine all chunks
    const audioBuffers: Buffer[] = [];
    let totalCombinedSize = 0;

    for (const chunk of chunks as AudioChunk[]) {
      try {
        console.log(`${logPrefix} Downloading chunk ${chunk.chunk_index} from ${chunk.storage_path}`);

        const { data: chunkData, error: downloadError } = await supabaseAdmin.storage
          .from('audio-recordings')
          .download(chunk.storage_path);

        if (downloadError) {
          console.error(`${logPrefix} Failed to download chunk ${chunk.chunk_index}:`, downloadError);
          continue; // Skip failed chunk but continue with others
        }

        if (chunkData) {
          const chunkBuffer = Buffer.from(await chunkData.arrayBuffer());
          audioBuffers.push(chunkBuffer);
          totalCombinedSize += chunkBuffer.length;
          console.log(`${logPrefix} ✅ Chunk ${chunk.chunk_index} downloaded: ${chunkBuffer.length} bytes`);
        }
      } catch (error) {
        console.error(`${logPrefix} Error downloading chunk ${chunk.chunk_index}:`, error);
        continue; // Skip failed chunk
      }
    }

    if (audioBuffers.length === 0) {
      console.error(`${logPrefix} No chunks could be downloaded`);
      return NextResponse.json({
        success: false,
        error: 'Failed to download any audio chunks'
      }, { status: 500 });
    }

    // Combine all audio buffers
    const combinedBuffer = Buffer.concat(audioBuffers);
    console.log(`${logPrefix} Combined ${audioBuffers.length} chunks into ${combinedBuffer.length} bytes`);

    // Create filename for combined audio
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const combinedFileName = `s2-therapist-voice/${sessionId}/combined-${timestamp}.webm`;

    console.log(`${logPrefix} Uploading combined audio to: ${combinedFileName}`);

    // Upload combined audio to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .upload(combinedFileName, combinedBuffer, {
        contentType: 'audio/webm',
        upsert: true // Replace if exists
      });

    if (uploadError) {
      console.error(`${logPrefix} Failed to upload combined audio:`, uploadError);
      return NextResponse.json({
        success: false,
        error: 'Failed to upload combined audio',
        details: uploadError.message
      }, { status: 500 });
    }

    console.log(`${logPrefix} ✅ Combined audio uploaded:`, uploadData);

    // Get public URL for combined audio
    const { data: urlData } = supabaseAdmin.storage
      .from('audio-recordings')
      .getPublicUrl(combinedFileName);

    const combinedAudioUrl = urlData.publicUrl;

    // Update session record with combined audio info
    const { data: sessionUpdateData, error: sessionUpdateError } = await supabaseAdmin
      .from('s2_case_simulation_sessions')
      .update({
        voice_recording_url: combinedAudioUrl,
        voice_recording_uploaded: true,
        voice_recording_size: combinedBuffer.length,
        chunks_combined_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select();

    if (sessionUpdateError) {
      console.error(`${logPrefix} Failed to update session with combined audio:`, sessionUpdateError);
      // Don't fail the request - the combination was successful
    } else {
      console.log(`${logPrefix} ✅ Session updated with combined audio:`, sessionUpdateData);
    }

    // Mark chunks as combined
    const { error: chunksUpdateError } = await supabaseAdmin
      .from('s2_audio_chunks')
      .update({ status: 'combined' })
      .eq('session_id', sessionId)
      .eq('status', 'uploaded');

    if (chunksUpdateError) {
      console.error(`${logPrefix} Failed to mark chunks as combined:`, chunksUpdateError);
      // Don't fail the request
    }

    console.log(`${logPrefix} ✅ Audio combination completed successfully:`, {
      combinedFileName,
      combinedAudioUrl,
      originalChunks: chunks.length,
      combinedChunks: audioBuffers.length,
      totalSize: combinedBuffer.length
    });

    return NextResponse.json({
      success: true,
      message: 'Audio chunks combined successfully',
      combined_audio_url: combinedAudioUrl,
      combined_file_name: combinedFileName,
      combined_file_size: combinedBuffer.length,
      chunks_combined: audioBuffers.length,
      total_chunks: chunks.length,
      session_id: sessionId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Audio combination failed:`, errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to combine audio chunks',
      details: errorMessage
    }, { status: 500 });
  }
}

// GET endpoint to check combination status
export async function GET(request: NextRequest) {
  const logPrefix = `[s2_voice_combine]`;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({
      error: 'Session ID is required'
    }, { status: 400 });
  }

  try {
    console.log(`${logPrefix} Checking combination status for session: ${sessionId}`);

    // Get session info
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('s2_case_simulation_sessions')
      .select('id, voice_recording_url, voice_recording_uploaded, chunks_combined_at, total_chunks, uploaded_chunks')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error(`${logPrefix} Session not found:`, sessionError);
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    // Get chunk status
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('s2_audio_chunks')
      .select('id, chunk_index, status, file_size')
      .eq('session_id', sessionId)
      .order('chunk_index');

    if (chunksError) {
      console.error(`${logPrefix} Failed to fetch chunk status:`, chunksError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch chunk status'
      }, { status: 500 });
    }

    const chunkStats = {
      total: chunks?.length || 0,
      uploaded: chunks?.filter(c => c.status === 'uploaded').length || 0,
      combined: chunks?.filter(c => c.status === 'combined').length || 0,
      failed: chunks?.filter(c => c.status === 'failed').length || 0
    };

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      voice_recording_url: session.voice_recording_url,
      voice_recording_uploaded: session.voice_recording_uploaded,
      chunks_combined_at: session.chunks_combined_at,
      is_combined: !!session.chunks_combined_at,
      chunk_stats: chunkStats
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Status check failed:`, errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to check combination status',
      details: errorMessage
    }, { status: 500 });
  }
}