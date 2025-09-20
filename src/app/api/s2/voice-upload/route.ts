// src/app/api/s2/voice-upload/route.ts
// Voice recording upload for S2 case simulation sessions

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[s2_voice_upload]`;

  console.log(`${logPrefix} Received voice upload request (${requestId})`);

  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('session_id') as string;
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

    console.log(`${logPrefix} Processing audio file:`, {
      fileName: audioFile.name,
      fileSize: audioFile.size,
      fileType: audioFile.type,
      sessionId: sessionId,
      purpose: purpose || 'voice_recording'
    });

    // Convert file to buffer for Supabase Storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Create unique filename (matching S1 pattern)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `s2-therapist-voice/${sessionId}/${timestamp}-${audioFile.name}`;

    console.log(`${logPrefix} Uploading to Supabase Storage: ${fileName}`);

    // Upload to Supabase Storage (using same bucket as S1)
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .upload(fileName, fileBuffer, {
        contentType: audioFile.type,
        upsert: false
      });

    if (uploadError) {
      console.error(`${logPrefix} Supabase Storage upload failed:`, uploadError);
      return NextResponse.json({ 
        success: false,
        error: 'Failed to upload audio file',
        details: uploadError.message 
      }, { status: 500 });
    }

    console.log(`${logPrefix} Upload successful:`, uploadData);

    // Get the public URL for the uploaded file
    const { data: urlData } = supabaseAdmin.storage
      .from('audio-recordings')
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;

    // Update session record with voice recording info
    console.log(`${logPrefix} Attempting to update session with audio info:`, {
      sessionId: sessionId,
      audioUrl: audioUrl,
      fileSize: audioFile.size
    });

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from('s2_case_simulation_sessions')
      .update({
        voice_recording_url: audioUrl,
        voice_recording_uploaded: true,
        voice_recording_size: audioFile.size
      })
      .eq('id', sessionId)
      .select();

    if (updateError) {
      console.error(`${logPrefix} ❌ Failed to update session record:`, {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        sessionId: sessionId
      });
      // Don't fail the request - the audio is already uploaded
    } else {
      console.log(`${logPrefix} ✅ Session updated with audio info:`, updateData);
    }

    console.log(`${logPrefix} ✅ Voice upload completed successfully:`, {
      fileName: fileName,
      audioUrl: audioUrl,
      fileSize: audioFile.size,
      sessionId: sessionId
    });

    return NextResponse.json({ 
      success: true,
      message: 'Voice uploaded successfully',
      audio_url: audioUrl,
      file_name: fileName,
      file_size: audioFile.size,
      session_id: sessionId
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`${logPrefix} Voice upload failed:`, errorMessage);
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to upload voice file',
      details: errorMessage
    }, { status: 500 });
  }
}