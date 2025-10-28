// src/app/api/provider/combine-intake-audio/route.ts
// Combines audio chunks into a single playable file for provider playback

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large audio files

export async function POST(request: NextRequest) {
  try {
    const { intake_id, conversation_id } = await request.json();

    console.log('[audio_combination] 🎯 Starting combination for:', { intake_id, conversation_id });

    if (!intake_id || !conversation_id) {
      return NextResponse.json(
        { error: 'intake_id and conversation_id are required' },
        { status: 400 }
      );
    }

    // Check if combination already in progress
    const { data: existingJob, error: jobCheckError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!jobCheckError && existingJob) {
      console.log('[audio_combination] 📋 Existing job found:', existingJob.status);

      if (existingJob.status === 'processing') {
        return NextResponse.json({
          success: true,
          status: 'processing',
          jobId: existingJob.id,
          message: 'Audio combination already in progress'
        });
      }

      if (existingJob.status === 'completed' && existingJob.combined_file_path) {
        console.log('[audio_combination] ✅ Job already completed');
        return NextResponse.json({
          success: true,
          status: 'completed',
          jobId: existingJob.id,
          filePath: existingJob.combined_file_path
        });
      }
    }

    // Create new combination job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .insert({
        conversation_id,
        intake_id,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[audio_combination] ❌ Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create combination job' },
        { status: 500 }
      );
    }

    console.log('[audio_combination] 📝 Created job:', job.id);

    // Fetch all audio chunks
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('chunk_index', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      console.error('[audio_combination] ❌ No chunks found:', chunksError);

      await supabaseAdmin
        .from('audio_combination_jobs')
        .update({
          status: 'failed',
          error_message: 'No audio chunks found',
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: 'No audio chunks found' },
        { status: 404 }
      );
    }

    console.log('[audio_combination] 📦 Found chunks:', chunks.length);

    // Download all chunks in parallel with batching
    const startTime = Date.now();
    const batchSize = 50; // Download 50 chunks at a time
    const allBlobs: Blob[] = new Array(chunks.length);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(chunks.length / batchSize);

      console.log(`[audio_combination] 📥 Downloading batch ${batchNumber}/${totalBatches} (${batch.length} chunks) - ${Date.now() - startTime}ms elapsed`);

      try {
        // Download this batch in parallel
        const batchResults = await Promise.all(
          batch.map(async (chunk) => {
            const { data, error } = await supabaseAdmin.storage
              .from('audio-recordings')
              .download(chunk.storage_path);

            if (error || !data) {
              throw new Error(`Failed to download chunk ${chunk.chunk_index}: ${error?.message || 'No data'}`);
            }

            return {
              index: chunk.chunk_index,
              blob: data
            };
          })
        );

        // Store blobs in correct order
        batchResults.forEach(result => {
          allBlobs[result.index] = result.blob;
        });

        console.log(`[audio_combination] ✅ Batch ${batchNumber}/${totalBatches} complete - ${Date.now() - startTime}ms elapsed`);
      } catch (error) {
        console.error(`[audio_combination] ❌ Error downloading batch ${batchNumber}:`, error);

        await supabaseAdmin
          .from('audio_combination_jobs')
          .update({
            status: 'failed',
            error_message: `Failed to download chunks: ${error instanceof Error ? error.message : 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        return NextResponse.json(
          { error: `Failed to download audio chunks` },
          { status: 500 }
        );
      }
    }

    console.log(`[audio_combination] ✅ All chunks downloaded - ${Date.now() - startTime}ms total`);

    // Combine chunks into single blob
    const combinedBlob = new Blob(allBlobs, { type: 'audio/webm;codecs=opus' });
    console.log(`[audio_combination] 🔗 Combined blob size: ${combinedBlob.size} bytes (${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB) - ${Date.now() - startTime}ms elapsed`);

    // Upload combined file
    const combinedFileName = `combined-${Date.now()}.webm`;
    const combinedPath = `v18-voice-recordings/${conversation_id}/${combinedFileName}`;

    console.log(`[audio_combination] 📤 Starting upload: ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB - ${Date.now() - startTime}ms elapsed`);

    try {
      const uploadStartTime = Date.now();
      const { error: uploadError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .upload(combinedPath, combinedBlob, {
          contentType: 'audio/webm;codecs=opus',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      console.log(`[audio_combination] ✅ Upload successful: ${Date.now() - uploadStartTime}ms upload time - ${Date.now() - startTime}ms total elapsed`);
    } catch (uploadError) {
      const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
      console.error('[audio_combination] ❌ Upload failed:', errorMsg);

      await supabaseAdmin
        .from('audio_combination_jobs')
        .update({
          status: 'failed',
          error_message: `Upload failed: ${errorMsg}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: 'Failed to upload combined audio', details: errorMsg },
        { status: 500 }
      );
    }

    console.log('[audio_combination] ✅ Uploaded combined file:', combinedPath);

    // Update job status to completed
    console.log('[audio_combination] 📝 Updating job status to completed...');

    const { error: updateError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .update({
        status: 'completed',
        combined_file_path: combinedPath,
        total_chunks: chunks.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('[audio_combination] ❌ Failed to update job status:', updateError);
    } else {
      console.log('[audio_combination] ✅ Job status updated to completed');
    }

    const totalTime = Date.now() - startTime;
    console.log(`[audio_combination] ✅ Job completed successfully - Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);

    // Trigger transcription in background (don't wait for completion)
    console.log('[audio_combination] 🎤 Triggering audio transcription in background...');
    fetch(`${request.nextUrl.origin}/api/provider/transcribe-intake-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intake_id,
        conversation_id,
        combined_audio_path: combinedPath
      })
    }).catch(err => {
      console.error('[audio_combination] ❌ Failed to trigger transcription:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'completed',
      jobId: job.id,
      filePath: combinedPath,
      chunkCount: chunks.length,
      durationMs: totalTime,
      fileSizeMB: parseFloat((combinedBlob.size / 1024 / 1024).toFixed(2))
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[audio_combination] ❌ API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to combine audio',
      details: errorMessage
    }, { status: 500 });
  }
}
