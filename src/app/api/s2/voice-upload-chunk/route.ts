// src/app/api/s2/voice-upload-chunk/route.ts
// Individual audio chunk upload for S2 case simulation sessions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[s2_chunk_upload]`;

  console.log(`${logPrefix} Received chunk upload request (${requestId})`);

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('session_id') as string;
    const chunkIndex = parseInt(formData.get('chunk_index') as string);
    const purpose = formData.get('purpose') as string;

    // Validate required fields
    if (!audioFile) {
      console.error(`${logPrefix} No audio file provided`);
      return NextResponse.json({
        error: 'No audio file provided'
      }, { status: 400 });
    }

    if (!sessionId) {
      console.error(`${logPrefix} No session ID provided`);
      return NextResponse.json({
        error: 'Session ID is required'
      }, { status: 400 });
    }

    if (isNaN(chunkIndex) || chunkIndex < 0) {
      console.error(`${logPrefix} Invalid chunk index: ${chunkIndex}`);
      return NextResponse.json({
        error: 'Valid chunk index is required'
      }, { status: 400 });
    }

    console.log(`${logPrefix} Processing chunk:`, {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      sessionId: sessionId,
      chunkIndex: chunkIndex,
      purpose: purpose || 'voice_chunk'
    });

    // Convert file to buffer for Supabase Storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Create unique filename for chunk
    const chunkFileName = `chunk-${String(chunkIndex).padStart(3, '0')}.webm`;
    const storagePath = `s2-therapist-voice/${sessionId}/${chunkFileName}`;

    console.log(`${logPrefix} Uploading chunk to Supabase Storage: ${storagePath}`);

    // Check if chunk already exists (prevent duplicates)
    const { data: existingChunk } = await supabaseAdmin
      .from('s2_audio_chunks')
      .select('id')
      .eq('session_id', sessionId)
      .eq('chunk_index', chunkIndex)
      .single();

    if (existingChunk) {
      console.log(`${logPrefix} Chunk ${chunkIndex} already exists for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        message: 'Chunk already uploaded',
        chunk_index: chunkIndex,
        session_id: sessionId,
        duplicate: true
      });
    }

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .upload(storagePath, fileBuffer, {
        contentType: audioFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error(`${logPrefix} Supabase Storage upload failed:`, uploadError);

      // Record failed chunk in database for retry tracking
      await supabaseAdmin.from('s2_audio_chunks').insert({
        session_id: sessionId,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        file_size: audioFile.size,
        mime_type: audioFile.type,
        status: 'failed',
        retry_count: 1
      });

      return NextResponse.json({
        success: false,
        error: 'Failed to upload audio chunk',
        details: uploadError.message,
        chunk_index: chunkIndex
      }, { status: 500 });
    }

    console.log(`${logPrefix} Chunk upload successful:`, uploadData);

    // Record successful chunk in database
    const { data: chunkRecord, error: dbError } = await supabaseAdmin
      .from('s2_audio_chunks')
      .insert({
        session_id: sessionId,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        file_size: audioFile.size,
        mime_type: audioFile.type,
        status: 'uploaded'
      })
      .select()
      .single();

    if (dbError) {
      console.error(`${logPrefix} ❌ Failed to record chunk in database:`, {
        error: dbError.message,
        code: dbError.code,
        sessionId: sessionId,
        chunkIndex: chunkIndex
      });
      // Don't fail the request - the chunk is already uploaded to storage
    } else {
      console.log(`${logPrefix} ✅ Chunk recorded in database:`, chunkRecord);
    }

    console.log(`${logPrefix} ✅ Chunk upload completed successfully:`, {
      storagePath: storagePath,
      fileSize: audioFile.size,
      sessionId: sessionId,
      chunkIndex: chunkIndex
    });

    return NextResponse.json({
      success: true,
      message: 'Chunk uploaded successfully',
      chunk_index: chunkIndex,
      storage_path: storagePath,
      file_size: audioFile.size,
      session_id: sessionId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Chunk upload failed:`, errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to upload audio chunk',
      details: errorMessage
    }, { status: 500 });
  }
}