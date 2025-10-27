// src/app/api/v18/voice-combine/route.ts
// Combine individual audio chunks into final recording for V18 sessions

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
  const logPrefix = `[v18_voice_combine]`;

  console.log(`${logPrefix} Received combine request (${requestId})`);

  try {
    const { conversationId } = await request.json();

    if (!conversationId) {
      console.error(`${logPrefix} No conversation ID provided`);
      return NextResponse.json({
        error: 'Conversation ID is required'
      }, { status: 400 });
    }

    console.log(`${logPrefix} Combining chunks for conversation:`, {
      conversationId
    });

    // Get all uploaded chunks for this conversation, ordered by chunk_index
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('id, chunk_index, storage_path, file_size, status')
      .eq('conversation_id', conversationId)
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
      console.log(`${logPrefix} No uploaded chunks found for conversation ${conversationId}`);
      return NextResponse.json({
        success: false,
        error: 'No uploaded audio chunks found for this conversation'
      }, { status: 404 });
    }

    console.log(`${logPrefix} Found ${chunks.length} chunks to combine:`, {
      chunkCount: chunks.length,
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.file_size, 0),
      chunkIndexes: chunks.map(c => c.chunk_index)
    });

    // Download and combine all chunks
    const audioBuffers: Buffer[] = [];

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
    const combinedFileName = `v18-voice-recordings/${conversationId}/combined-${timestamp}.webm`;

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

    // Mark chunks as combined
    const { error: chunksUpdateError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .update({ status: 'combined' })
      .eq('conversation_id', conversationId)
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
      conversation_id: conversationId
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
