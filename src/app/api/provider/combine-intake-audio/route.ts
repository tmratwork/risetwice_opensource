// src/app/api/provider/combine-intake-audio/route.ts
// Combines audio chunks into a single playable file for provider playback

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';

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

    // STEP 1: Concatenate blobs (simple and reliable)
    const combinedBlob = new Blob(allBlobs, { type: 'audio/webm;codecs=opus' });
    console.log(`[audio_combination] 🔗 Combined blob size: ${combinedBlob.size} bytes (${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB) - ${Date.now() - startTime}ms elapsed`);

    // Create temp directory for FFmpeg processing
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'audio-combination-'));
    console.log(`[audio_combination] 📁 Created temp directory: ${tempDir}`);

    let combinedPath = '';
    let finalBlob: Blob;

    try {
      // STEP 2: Write combined blob to temp file
      const tempInputPath = path.join(tempDir, 'input.webm');
      const inputBuffer = Buffer.from(await combinedBlob.arrayBuffer());
      await fs.promises.writeFile(tempInputPath, inputBuffer);
      console.log(`[audio_combination] 💾 Wrote combined blob to temp file - ${Date.now() - startTime}ms elapsed`);

      // STEP 3: Re-encode to ensure proper format (NO keyframes option - that's for video only)
      const outputPath = path.join(tempDir, 'output.webm');
      console.log(`[audio_combination] 🔧 Starting FFmpeg re-encoding...`);

      await new Promise<void>((resolve, reject) => {
        const ffmpegStartTime = Date.now();

        ffmpeg(tempInputPath)
          .audioCodec('libopus')
          .audioBitrate('64k')
          .outputOptions([
            '-vn' // No video (audio only)
          ])
          .output(outputPath)
          .on('start', (commandLine) => {
            console.log(`[audio_combination] 🎬 FFmpeg command: ${commandLine}`);
          })
          .on('progress', (progress) => {
            if (progress.percent) {
              console.log(`[audio_combination] 📊 FFmpeg progress: ${progress.percent.toFixed(1)}%`);
            }
          })
          .on('end', () => {
            const ffmpegTime = Date.now() - ffmpegStartTime;
            console.log(`[audio_combination] ✅ FFmpeg re-encoding complete - ${ffmpegTime}ms (${(ffmpegTime / 1000).toFixed(1)}s)`);
            resolve();
          })
          .on('error', (err) => {
            console.error('[audio_combination] ❌ FFmpeg error:', err.message);
            reject(err);
          })
          .run();
      });

      // STEP 4: Read the re-encoded file
      console.log(`[audio_combination] 📖 Reading re-encoded file...`);
      const finalBuffer = await fs.promises.readFile(outputPath);
      finalBlob = new Blob([finalBuffer], { type: 'audio/webm;codecs=opus' });
      console.log(`[audio_combination] 🔗 Final file size: ${finalBlob.size} bytes (${(finalBlob.size / 1024 / 1024).toFixed(2)} MB) - ${Date.now() - startTime}ms elapsed`);

      // STEP 5: Upload the re-encoded file
      const combinedFileName = `combined-${Date.now()}.webm`;
      combinedPath = `v18-voice-recordings/${conversation_id}/${combinedFileName}`;

      console.log(`[audio_combination] 📤 Starting upload: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB - ${Date.now() - startTime}ms elapsed`);

      const uploadStartTime = Date.now();
      const { error: uploadError } = await supabaseAdmin.storage
        .from('audio-recordings')
        .upload(combinedPath, finalBlob, {
          contentType: 'audio/webm;codecs=opus',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      console.log(`[audio_combination] ✅ Upload successful: ${Date.now() - uploadStartTime}ms upload time - ${Date.now() - startTime}ms total elapsed`);

      // Clean up temp files
      console.log(`[audio_combination] 🧹 Cleaning up temp directory...`);
      await fs.promises.rm(tempDir, { recursive: true, force: true });
      console.log(`[audio_combination] ✅ Temp directory cleaned up`);

    } catch (error) {
      // Clean up temp files on error
      console.error('[audio_combination] ❌ Error during FFmpeg processing:', error);
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('[audio_combination] ⚠️ Failed to cleanup temp directory:', cleanupError);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      await supabaseAdmin
        .from('audio_combination_jobs')
        .update({
          status: 'failed',
          error_message: `FFmpeg processing failed: ${errorMsg}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json(
        { error: 'Failed to combine audio with FFmpeg', details: errorMsg },
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
      fileSizeMB: parseFloat((finalBlob.size / 1024 / 1024).toFixed(2))
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
