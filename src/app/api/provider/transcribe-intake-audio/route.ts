// src/app/api/provider/transcribe-intake-audio/route.ts
// Transcribes combined audio using OpenAI Whisper API

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTranscriptionModel } from '@/config/models';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for transcription

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { intake_id, conversation_id, combined_audio_path } = await request.json();

    console.log('[audio_transcription] 🎯 Starting transcription:', {
      intake_id,
      conversation_id,
      combined_audio_path
    });

    if (!intake_id || !conversation_id || !combined_audio_path) {
      return NextResponse.json(
        { error: 'intake_id, conversation_id, and combined_audio_path are required' },
        { status: 400 }
      );
    }

    // Check if transcription already exists
    const { data: existingTranscript, error: transcriptCheckError } = await supabaseAdmin
      .from('patient_intake_transcripts')
      .select('*')
      .eq('intake_id', intake_id)
      .single();

    if (!transcriptCheckError && existingTranscript) {
      console.log('[audio_transcription] 📋 Transcript already exists:', existingTranscript.status);

      if (existingTranscript.status === 'processing') {
        return NextResponse.json({
          success: true,
          status: 'processing',
          message: 'Transcription already in progress'
        });
      }

      if (existingTranscript.status === 'completed') {
        console.log('[audio_transcription] ✅ Transcript already completed');
        return NextResponse.json({
          success: true,
          status: 'completed',
          transcript: existingTranscript.transcript_text
        });
      }
    }

    // Create transcription job
    const transcriptionModel = getTranscriptionModel();
    const { data: transcriptJob, error: jobError } = await supabaseAdmin
      .from('patient_intake_transcripts')
      .insert({
        intake_id,
        conversation_id,
        combined_audio_path,
        model_used: transcriptionModel,
        status: 'processing',
        transcription_started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !transcriptJob) {
      console.error('[audio_transcription] ❌ Failed to create transcription job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create transcription job' },
        { status: 500 }
      );
    }

    console.log(`[audio_transcription] 📝 Created transcription job: ${transcriptJob.id} - ${Date.now() - startTime}ms elapsed`);

    // Download combined audio file from Supabase Storage
    console.log(`[audio_transcription] 📥 Downloading combined audio - ${Date.now() - startTime}ms elapsed`);

    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .download(combined_audio_path);

    if (downloadError || !audioData) {
      console.error('[audio_transcription] ❌ Failed to download audio:', downloadError);

      await supabaseAdmin
        .from('patient_intake_transcripts')
        .update({
          status: 'failed',
          error_message: `Failed to download audio: ${downloadError?.message}`,
          transcription_completed_at: new Date().toISOString()
        })
        .eq('id', transcriptJob.id);

      return NextResponse.json(
        { error: 'Failed to download audio file' },
        { status: 500 }
      );
    }

    console.log(`[audio_transcription] ✅ Audio downloaded: ${audioData.size} bytes - ${Date.now() - startTime}ms elapsed`);

    // Convert blob to file for OpenAI API
    const audioFile = new File([audioData], 'audio.webm', { type: 'audio/webm' });

    // Call OpenAI Whisper API
    console.log(`[audio_transcription] 🎤 Calling OpenAI Whisper API - ${Date.now() - startTime}ms elapsed`);

    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', transcriptionModel);
    formData.append('response_format', 'verbose_json'); // Get detailed response with timestamps

    const transcriptionStartTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[audio_transcription] ❌ OpenAI API error:', errorText);

      await supabaseAdmin
        .from('patient_intake_transcripts')
        .update({
          status: 'failed',
          error_message: `OpenAI API error: ${response.statusText}`,
          transcription_completed_at: new Date().toISOString()
        })
        .eq('id', transcriptJob.id);

      return NextResponse.json(
        { error: `OpenAI API error: ${response.statusText}` },
        { status: 500 }
      );
    }

    const transcriptionResult = await response.json();
    const transcriptionTime = Date.now() - transcriptionStartTime;

    console.log(`[audio_transcription] ✅ Transcription completed: ${transcriptionTime}ms - ${Date.now() - startTime}ms total elapsed`);
    console.log(`[audio_transcription] 📊 Transcript length: ${transcriptionResult.text.length} characters`);

    // Update database with completed transcription
    const { error: updateError } = await supabaseAdmin
      .from('patient_intake_transcripts')
      .update({
        status: 'completed',
        transcript_text: transcriptionResult.text,
        audio_duration_seconds: transcriptionResult.duration || null,
        transcription_completed_at: new Date().toISOString()
      })
      .eq('id', transcriptJob.id);

    if (updateError) {
      console.error('[audio_transcription] ❌ Failed to update transcript status:', updateError);
      // Don't fail the request - transcription succeeded
    } else {
      console.log('[audio_transcription] ✅ Transcript saved to database');
    }

    const totalTime = Date.now() - startTime;
    console.log(`[audio_transcription] ✅ Transcription job completed - Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

    return NextResponse.json({
      success: true,
      status: 'completed',
      transcript: transcriptionResult.text,
      duration: transcriptionResult.duration,
      durationMs: totalTime
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[audio_transcription] ❌ API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to transcribe audio',
      details: errorMessage
    }, { status: 500 });
  }
}
