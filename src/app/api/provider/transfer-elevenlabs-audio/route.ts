// src/app/api/provider/transfer-elevenlabs-audio/route.ts
// Transfer audio from ElevenLabs API to Supabase Storage for V17 intakes

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { conversation_id, elevenlabs_conversation_id } = await request.json();

    console.log('[transfer_audio] 📦 Transfer request received:', {
      conversation_id,
      elevenlabs_conversation_id
    });

    if (!elevenlabs_conversation_id) {
      return NextResponse.json(
        { error: 'elevenlabs_conversation_id is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if audio already exists in Supabase Storage
    const storagePath = `v17-ai-audio/${conversation_id}/elevenlabs-audio.mp3`;

    console.log('[transfer_audio] 🔍 Checking if audio already exists at:', storagePath);

    const { data: existingFile, error: checkError } = await supabase
      .storage
      .from('audio-recordings')
      .list(`v17-ai-audio/${conversation_id}`, {
        limit: 1,
        search: 'elevenlabs-audio.mp3'
      });

    if (!checkError && existingFile && existingFile.length > 0) {
      console.log('[transfer_audio] ✅ Audio already exists in Supabase Storage');

      // Get public URL
      const { data: urlData } = supabase
        .storage
        .from('audio-recordings')
        .getPublicUrl(storagePath);

      return NextResponse.json({
        success: true,
        cached: true,
        audioUrl: urlData.publicUrl,
        storagePath
      });
    }

    console.log('[transfer_audio] 📥 Audio not cached, fetching from ElevenLabs...');

    // Fetch audio from ElevenLabs
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const endpoint = `https://api.elevenlabs.io/v1/convai/conversations/${elevenlabs_conversation_id}/audio`;
    console.log('[transfer_audio] 🌐 Fetching from ElevenLabs:', endpoint);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'xi-api-key': elevenLabsApiKey,
        'Accept': 'audio/*'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[transfer_audio] ❌ ElevenLabs API error:', response.status, errorText);
      return NextResponse.json(
        {
          error: 'Failed to fetch audio from ElevenLabs',
          details: errorText
        },
        { status: response.status }
      );
    }

    // Get audio blob
    const audioBlob = await response.blob();
    const audioBuffer = await audioBlob.arrayBuffer();

    console.log('[transfer_audio] ✅ Audio fetched from ElevenLabs:', {
      size: audioBlob.size,
      sizeMB: (audioBlob.size / 1024 / 1024).toFixed(2),
      type: audioBlob.type
    });

    // Upload to Supabase Storage
    console.log('[transfer_audio] ⬆️ Uploading to Supabase Storage:', storagePath);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('audio-recordings')
      .upload(storagePath, audioBuffer, {
        contentType: audioBlob.type || 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('[transfer_audio] ❌ Upload error:', uploadError);
      return NextResponse.json(
        {
          error: 'Failed to upload audio to Supabase Storage',
          details: uploadError.message
        },
        { status: 500 }
      );
    }

    console.log('[transfer_audio] ✅ Upload successful:', uploadData);

    // Get public URL
    const { data: urlData } = supabase
      .storage
      .from('audio-recordings')
      .getPublicUrl(storagePath);

    console.log('[transfer_audio] 🎉 Transfer complete, public URL:', urlData.publicUrl);

    return NextResponse.json({
      success: true,
      cached: false,
      audioUrl: urlData.publicUrl,
      storagePath,
      audioSize: audioBlob.size,
      audioSizeMB: parseFloat((audioBlob.size / 1024 / 1024).toFixed(2))
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[transfer_audio] ❌ API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to transfer audio',
      details: errorMessage
    }, { status: 500 });
  }
}
