// src/app/api/provider/intake-audio/route.ts
// Fetches voice recordings for patient intake (returns combined audio URL or triggers combination)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  // Disable Next.js caching to prevent stale database reads
  const { unstable_noStore } = await import('next/cache');
  unstable_noStore();
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

    // STEP 1: Check database for existing combination job FIRST (source of truth)
    // Always get the MOST RECENT job to handle any duplicate race conditions
    console.log('[provider_audio] 📋 Checking database for MOST RECENT combination job...');
    const { data: existingJob, error: jobCheckError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .select('id, status, combined_file_path, created_at, completed_at')
      .eq('conversation_id', conversationId)
      .eq('speaker', speaker)
      .order('created_at', { ascending: false }) // Most recent first
      .limit(1)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no rows

    console.log('[provider_audio] 📋 Job check result:', {
      found: !!existingJob,
      status: existingJob?.status,
      jobId: existingJob?.id,
      combinedFilePath: existingJob?.combined_file_path,
      createdAt: existingJob?.created_at,
      completedAt: existingJob?.completed_at,
      error: jobCheckError
    });

    // If job exists and is completed, return the URL immediately
    if (existingJob && existingJob.status === 'completed' && existingJob.combined_file_path) {
      console.log('[provider_audio] ✅ Found completed job - generating signed URL');

      const { data: urlData, error: urlError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .createSignedUrl(existingJob.combined_file_path, 3600);

      if (urlError) {
        console.error('[provider_audio] ❌ Failed to generate signed URL:', urlError);
        return NextResponse.json(
          { error: 'Failed to generate audio URL' },
          { status: 500 }
        );
      }

      const fileName = existingJob.combined_file_path.split('/').pop() || 'combined-audio';
      console.log('[provider_audio] ✅ Returning completed audio URL from database');
      return NextResponse.json({
        success: true,
        hasRecording: true,
        audioUrl: urlData.signedUrl,
        conversationId: conversationId,
        fileName: fileName
      });
    }

    // If job exists but is still processing, check if it's stale
    if (existingJob && existingJob.status === 'processing') {
      // Check if job is stale (processing for more than 2 minutes)
      const now = new Date();
      const jobCreated = new Date(existingJob.created_at);
      const jobAge = now.getTime() - jobCreated.getTime();
      const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes (combination should complete in seconds)

      console.log('[provider_audio] ⏱️ Job age check:', {
        now: now.toISOString(),
        jobCreated: jobCreated.toISOString(),
        ageMs: jobAge,
        ageSeconds: Math.floor(jobAge / 1000),
        ageMinutes: Math.floor(jobAge / 60000),
        thresholdMs: STALE_THRESHOLD,
        isStale: jobAge > STALE_THRESHOLD
      });

      if (jobAge > STALE_THRESHOLD) {
        console.log('[provider_audio] ⚠️ Job is STALE (processing for', Math.floor(jobAge / 60000), 'minutes) - marking as failed and will retry');

        // Mark stale job as failed
        await supabaseAdmin
          .from('audio_combination_jobs')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', existingJob.id);

        console.log('[provider_audio] ✅ Marked stale job as failed, continuing to trigger new combination...');
        // Fall through to trigger new combination below
      } else {
        console.log('[provider_audio] ⏳ Job still processing (age:', Math.floor(jobAge / 1000), 'seconds)');
        return NextResponse.json({
          success: true,
          hasRecording: true,
          needsCombination: true,
          jobId: existingJob.id,
          jobStatus: existingJob.status,
          conversationId: conversationId,
          message: 'Audio combination in progress'
        });
      }
    }

    // If job failed, we'll trigger a new one below

    // STEP 2: No completed job found - check if we have chunks to combine
    console.log(`[provider_audio] 📦 No completed job - checking for ${speaker} chunks...`);

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

    // STEP 3: No existing job - trigger new combination in background
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
