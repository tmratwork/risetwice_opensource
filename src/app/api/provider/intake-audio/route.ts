// src/app/api/provider/intake-audio/route.ts
// Fetches voice recordings for patient intake (returns combined audio URL or triggers combination)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intakeId = searchParams.get('intake_id');
    const speaker = searchParams.get('speaker') || 'patient'; // Default to patient for backwards compatibility

    console.log('[provider_audio] 🎯 API called with intake_id:', intakeId, 'speaker:', speaker);

    if (!intakeId) {
      console.log('[provider_audio] ❌ No intake_id provided');
      return NextResponse.json(
        { error: 'Intake ID is required' },
        { status: 400 }
      );
    }

    // Get patient intake to find conversation_id
    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('patient_intake')
      .select('id, user_id, conversation_id')
      .eq('id', intakeId)
      .single();

    console.log('[provider_audio] 📋 Intake record:', {
      found: !!intake,
      id: intake?.id,
      user_id: intake?.user_id,
      conversation_id: intake?.conversation_id,
      error: intakeError
    });

    if (intakeError || !intake) {
      console.error('[provider_audio] ❌ Intake not found:', intakeError);
      return NextResponse.json(
        { error: 'Intake not found' },
        { status: 404 }
      );
    }

    // Find conversation_id from audio chunks if not set in intake
    let conversationId = intake.conversation_id;

    if (!conversationId && intake.user_id) {
      console.log('[provider_audio] 🔍 No conversation_id in intake, searching by user_id:', intake.user_id);

      // Try to find conversation by user_id (not intake_id, since old recordings don't have intake_id)
      const { data: chunks, error: chunksError } = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('conversation_id')
        .eq('user_id', intake.user_id)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('[provider_audio] 📦 User chunks search result:', {
        found: chunks?.length,
        conversation_id: chunks?.[0]?.conversation_id,
        error: chunksError
      });

      if (!chunksError && chunks && chunks.length > 0) {
        conversationId = chunks[0].conversation_id;

        // Update intake with found conversation_id
        await supabaseAdmin
          .from('patient_intake')
          .update({ conversation_id: conversationId })
          .eq('id', intakeId);

        console.log(`[provider_audio] ✅ Linked intake ${intakeId} to conversation ${conversationId}`);
      }
    }

    if (!conversationId) {
      console.log('[provider_audio] ❌ No conversation_id found - returning no recording');
      return NextResponse.json({
        success: true,
        hasRecording: false,
        message: 'No voice recording found for this intake'
      });
    }

    console.log('[provider_audio] 🎤 Using conversation_id:', conversationId);

    // Check for combined audio file
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from('audio-recordings')
      .list(`v18-voice-recordings/${conversationId}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    console.log('[provider_audio] 📁 Storage list result:', {
      fileCount: files?.length,
      files: files?.map(f => f.name),
      error: listError
    });

    if (listError) {
      console.error('[provider_audio] ❌ Failed to list audio files:', listError);
      return NextResponse.json(
        { error: 'Failed to fetch audio files' },
        { status: 500 }
      );
    }

    // Find combined audio file for the specified speaker
    const combinedFilePrefix = speaker === 'ai' ? 'combined-ai-' : 'combined-';
    const combinedFile = files?.find(file => file.name.startsWith(combinedFilePrefix));

    console.log('[provider_audio] 🔍 Combined file search:', {
      found: !!combinedFile,
      fileName: combinedFile?.name
    });

    if (combinedFile) {
      const combinedPath = `v18-voice-recordings/${conversationId}/${combinedFile.name}`;

      console.log('[provider_audio] 📥 Generating signed URL for:', combinedPath);

      // Generate signed URL for combined audio (valid for 1 hour)
      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .createSignedUrl(combinedPath, 3600);

      if (urlError) {
        console.error('[provider_audio] ❌ Failed to generate signed URL:', urlError);
        return NextResponse.json(
          { error: 'Failed to generate audio URL' },
          { status: 500 }
        );
      }

      console.log('[provider_audio] ✅ Returning combined audio URL');
      return NextResponse.json({
        success: true,
        hasRecording: true,
        audioUrl: urlData.signedUrl,
        conversationId: conversationId,
        fileName: combinedFile.name
      });
    }

    // No combined file exists - check if we have chunks to combine
    console.log(`[provider_audio] 📦 No combined file - checking for ${speaker} chunks...`);

    // Fetch chunks for the specified speaker
    let { data: chunks, error: chunksError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('speaker', speaker)
      .order('chunk_index', { ascending: true });

    // If no chunks found for the requested speaker and it's patient, fallback to any chunks (for backwards compatibility)
    if (speaker === 'patient' && (!chunks || chunks.length === 0)) {
      console.log('[provider_audio] ⚠️ No patient chunks found, checking for any chunks...');
      const result = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('chunk_index', { ascending: true });

      chunks = result.data;
      chunksError = result.error;
    }

    console.log('[provider_audio] 📦 Chunks query result:', {
      chunkCount: chunks?.length,
      error: chunksError,
      firstChunk: chunks?.[0],
      lastChunk: chunks?.[chunks?.length - 1]
    });

    if (chunksError || !chunks || chunks.length === 0) {
      console.log('[provider_audio] ❌ No chunks found - returning no recording');
      return NextResponse.json({
        success: true,
        hasRecording: false,
        message: 'No audio chunks found for this intake'
      });
    }

    // Check if combination job already exists for this speaker
    const { data: existingJob, error: jobCheckError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('speaker', speaker)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('[provider_audio] 📋 Existing job check:', {
      found: !!existingJob,
      status: existingJob?.status,
      jobId: existingJob?.id,
      error: jobCheckError
    });

    if (!jobCheckError && existingJob) {
      // Job exists - return its status
      return NextResponse.json({
        success: true,
        hasRecording: true,
        needsCombination: true,
        jobId: existingJob.id,
        jobStatus: existingJob.status,
        chunkCount: chunks.length,
        conversationId: conversationId,
        combinedFilePath: existingJob.combined_file_path,
        message: existingJob.status === 'completed'
          ? 'Audio is ready'
          : existingJob.status === 'failed'
          ? 'Audio combination failed'
          : 'Audio combination in progress'
      });
    }

    // No job exists - trigger combination in background (don't wait for completion)
    console.log(`[provider_audio] 🚀 Triggering ${speaker} audio combination in background...`);

    // Fire and forget - don't await
    fetch(`${request.nextUrl.origin}/api/provider/combine-intake-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intake_id: intakeId,
        conversation_id: conversationId,
        speaker: speaker
      })
    }).catch(err => {
      console.error('[provider_audio] ❌ Failed to trigger combination:', err);
    });

    console.log('[provider_audio] ✅ Returning needs combination:', chunks.length, 'chunks');
    return NextResponse.json({
      success: true,
      hasRecording: true,
      needsCombination: true,
      jobStatus: 'processing',
      chunkCount: chunks.length,
      conversationId: conversationId,
      message: 'Audio combination started. Please check back in a few moments.'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch intake audio',
      details: errorMessage
    }, { status: 500 });
  }
}
