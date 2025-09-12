// src/app/api/s1/voice-upload/route.ts
// S1 Voice Upload API for Voice Cloning

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[s1_voice_upload]`;

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
      purpose: purpose || 'voice_cloning'
    });

    // Convert file to buffer for Supabase Storage
    const arrayBuffer = await audioFile.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Create unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `therapist-voice/${sessionId}/${timestamp}-${audioFile.name}`;

    console.log(`${logPrefix} Uploading to Supabase Storage: ${fileName}`);

    // Upload to Supabase Storage
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

    // Update the session messages table with audio URL (optional - for record keeping)
    if (purpose === 'voice_cloning') {
      console.log(`${logPrefix} Saving audio URL to session record`);
      
      // Create a record of this voice upload for tracking
      const { error: insertError } = await supabaseAdmin
        .from('s1_session_messages')
        .insert({
          session_id: sessionId,
          role: 'therapist',
          content: 'Voice recording uploaded for cloning',
          message_type: 'audio_upload',
          audio_url: audioUrl,
          audio_duration_seconds: null, // Could be calculated if needed
          timestamp_in_session: '00:00:00',
          is_final: true
        });

      if (insertError) {
        console.warn(`${logPrefix} Failed to save audio record (non-critical):`, insertError);
        // Don't fail the request if this fails - the audio is already uploaded
      }
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