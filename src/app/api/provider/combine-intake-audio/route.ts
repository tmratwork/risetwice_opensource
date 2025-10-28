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

    // Download all chunks
    const chunkBlobs: Blob[] = [];
    for (const chunk of chunks) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from('audio-recordings')
          .download(chunk.storage_path);

        if (error || !data) {
          throw new Error(`Failed to download chunk ${chunk.chunk_index}: ${error?.message}`);
        }

        chunkBlobs.push(data);
      } catch (error) {
        console.error(`[audio_combination] ❌ Error downloading chunk ${chunk.chunk_index}:`, error);

        await supabaseAdmin
          .from('audio_combination_jobs')
          .update({
            status: 'failed',
            error_message: `Failed to download chunk ${chunk.chunk_index}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        return NextResponse.json(
          { error: `Failed to download audio chunks` },
          { status: 500 }
        );
      }
    }

    console.log('[audio_combination] ✅ Downloaded all chunks');

    // Combine chunks into single blob
    const combinedBlob = new Blob(chunkBlobs, { type: 'audio/webm;codecs=opus' });
    console.log('[audio_combination] 🔗 Combined blob size:', combinedBlob.size);

    // Upload combined file
    const combinedFileName = `combined-${Date.now()}.webm`;
    const combinedPath = `v18-voice-recordings/${conversation_id}/${combinedFileName}`;

    console.log('[audio_combination] 📤 Starting upload:', {
      path: combinedPath,
      size: combinedBlob.size,
      sizeMB: (combinedBlob.size / 1024 / 1024).toFixed(2)
    });

    try {
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .upload(combinedPath, combinedBlob, {
          contentType: 'audio/webm;codecs=opus',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      console.log('[audio_combination] ✅ Upload successful:', uploadData);
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

    console.log('[audio_combination] ✅ Job completed successfully');

    return NextResponse.json({
      success: true,
      status: 'completed',
      jobId: job.id,
      filePath: combinedPath,
      chunkCount: chunks.length
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
