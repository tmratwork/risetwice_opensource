// src/app/api/v18/voice-upload-chunk/route.ts
// Individual audio chunk upload for V18 chatbot sessions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[v18_chunk_upload]`;

  console.log(`${logPrefix} Received chunk upload request (${requestId})`);

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const conversationId = formData.get('conversation_id') as string;
    const chunkIndex = parseInt(formData.get('chunk_index') as string);
    const purpose = formData.get('purpose') as string;
    const speaker = (formData.get('speaker') as string) || 'patient'; // NEW: Default to 'patient' for backward compatibility
    const userId = formData.get('user_id') as string | null;
    const intakeId = formData.get('intake_id') as string | null;

    // Validate required fields
    if (!audioFile) {
      console.error(`${logPrefix} No audio file provided`);
      return NextResponse.json({
        error: 'No audio file provided'
      }, { status: 400 });
    }

    if (!conversationId) {
      console.error(`${logPrefix} No conversation ID provided`);
      return NextResponse.json({
        error: 'Conversation ID is required'
      }, { status: 400 });
    }

    if (isNaN(chunkIndex) || chunkIndex < 0) {
      console.error(`${logPrefix} Invalid chunk index: ${chunkIndex}`);
      return NextResponse.json({
        error: 'Valid chunk index is required'
      }, { status: 400 });
    }

    // Validate speaker value
    if (speaker !== 'patient' && speaker !== 'ai') {
      console.error(`${logPrefix} Invalid speaker value: ${speaker}`);
      return NextResponse.json({
        error: 'Invalid speaker value. Must be "patient" or "ai"'
      }, { status: 400 });
    }

    console.log(`${logPrefix} Processing chunk:`, {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      conversationId: conversationId,
      chunkIndex: chunkIndex,
      speaker: speaker, // NEW: Log speaker type
      purpose: purpose || 'voice_chunk'
    });

    // Convert file to buffer for Supabase Storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Create unique filename for chunk with speaker subdirectory
    const chunkFileName = `chunk-${String(chunkIndex).padStart(3, '0')}.webm`;
    const storagePath = `v18-voice-recordings/${conversationId}/${speaker}/${chunkFileName}`; // NEW: Separate by speaker

    console.log(`${logPrefix} Uploading chunk to Supabase Storage: ${storagePath}`);

    // Check if chunk already exists (prevent duplicates) - check by conversation, chunk index, AND speaker
    const { data: existingChunk } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('chunk_index', chunkIndex)
      .eq('speaker', speaker) // NEW: Also check speaker to allow same chunk index for different speakers
      .single();

    if (existingChunk) {
      console.log(`${logPrefix} Chunk ${chunkIndex} already exists for conversation ${conversationId}`);
      return NextResponse.json({
        success: true,
        message: 'Chunk already uploaded',
        chunk_index: chunkIndex,
        conversation_id: conversationId,
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
      await supabaseAdmin.from('v18_audio_chunks').insert({
        conversation_id: conversationId,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        file_size: audioFile.size,
        mime_type: audioFile.type,
        speaker: speaker, // NEW: Include speaker type
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

    // Record successful chunk in database with user linking and speaker identification
    const { data: chunkRecord, error: dbError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .insert({
        conversation_id: conversationId,
        chunk_index: chunkIndex,
        storage_path: storagePath,
        file_size: audioFile.size,
        mime_type: audioFile.type,
        speaker: speaker, // NEW: Include speaker type
        status: 'uploaded',
        user_id: userId || null,
        intake_id: intakeId || null
      })
      .select()
      .single();

    if (dbError) {
      console.error(`${logPrefix} ❌ Failed to record chunk in database:`, {
        error: dbError.message,
        code: dbError.code,
        conversationId: conversationId,
        chunkIndex: chunkIndex
      });
      // Don't fail the request - the chunk is already uploaded to storage
    } else {
      console.log(`${logPrefix} ✅ Chunk recorded in database:`, chunkRecord);
    }

    console.log(`${logPrefix} ✅ Chunk upload completed successfully:`, {
      storagePath: storagePath,
      fileSize: audioFile.size,
      conversationId: conversationId,
      chunkIndex: chunkIndex
    });

    return NextResponse.json({
      success: true,
      message: 'Chunk uploaded successfully',
      chunk_index: chunkIndex,
      storage_path: storagePath,
      file_size: audioFile.size,
      conversation_id: conversationId
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
