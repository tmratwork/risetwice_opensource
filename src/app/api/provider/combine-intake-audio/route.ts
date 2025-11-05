// src/app/api/provider/combine-intake-audio/route.ts
// Combines audio chunks into a single playable file for provider playback

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large audio files

// Helper function to create WAV file from PCM data
function createWavBlob(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const fileSize = 44 + dataSize; // WAV header is 44 bytes

  // Create WAV header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // Helper to write string to DataView
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true); // File size minus RIFF header
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Combine header and PCM data
  const wavData = new Uint8Array(fileSize);
  wavData.set(new Uint8Array(header), 0);
  wavData.set(pcmData, 44);

  return new Blob([wavData], { type: 'audio/wav' });
}

export async function POST(request: NextRequest) {
  try {
    const { intake_id, conversation_id, speaker = 'patient' } = await request.json();

    console.log('[audio_combination] 🎯 Starting combination for:', { intake_id, conversation_id, speaker });

    if (!intake_id || !conversation_id) {
      return NextResponse.json(
        { error: 'intake_id and conversation_id are required' },
        { status: 400 }
      );
    }

    // Try to create a new job atomically FIRST
    // The unique constraint will prevent duplicates if multiple requests arrive simultaneously
    const { data: job, error: jobError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .insert({
        conversation_id,
        intake_id,
        speaker,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    // If insert failed due to unique constraint violation, fetch the existing job
    if (jobError) {
      if (jobError.code === '23505') { // Unique constraint violation
        console.log('[audio_combination] 🔄 Job already exists (race condition detected), fetching existing job...');

        const { data: racedJob } = await supabaseAdmin
          .from('audio_combination_jobs')
          .select('id, status, combined_file_path')
          .eq('conversation_id', conversation_id)
          .eq('speaker', speaker)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (racedJob) {
          if (racedJob.status === 'completed' && racedJob.combined_file_path) {
            return NextResponse.json({
              success: true,
              status: 'completed',
              jobId: racedJob.id,
              filePath: racedJob.combined_file_path
            });
          }

          return NextResponse.json({
            success: true,
            status: 'processing',
            jobId: racedJob.id,
            message: 'Audio combination already in progress'
          });
        }
      }

      console.error('[audio_combination] ❌ Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create combination job' },
        { status: 500 }
      );
    }

    console.log('[audio_combination] 📝 Created new job:', job.id);

    // Fetch audio chunks for the specified speaker
    let { data: chunks, error: chunksError } = await supabaseAdmin
      .from('v18_audio_chunks')
      .select('*')
      .eq('conversation_id', conversation_id)
      .eq('speaker', speaker)
      .order('chunk_index', { ascending: true });

    // If no chunks found for patient speaker, fallback to any chunks (for backwards compatibility)
    if (speaker === 'patient' && (!chunks || chunks.length === 0)) {
      console.log('[audio_combination] ⚠️ No patient chunks found, falling back to any chunks...');
      const result = await supabaseAdmin
        .from('v18_audio_chunks')
        .select('*')
        .eq('conversation_id', conversation_id)
        .order('chunk_index', { ascending: true });

      chunks = result.data;
      chunksError = result.error;
    }

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

    // Combine audio chunks - determine format from actual chunk MIME type
    const firstChunkMimeType = chunks[0]?.mime_type || 'audio/webm;codecs=opus';
    const isWav = firstChunkMimeType.includes('wav');
    const mimeType = isWav ? 'audio/wav' : 'audio/webm;codecs=opus';
    const fileExtension = isWav ? 'wav' : 'webm';

    console.log(`[audio_combination] 🎵 Detected format: ${isWav ? 'WAV' : 'WebM'} (from MIME type: ${firstChunkMimeType})`);

    let combinedBlob: Blob;

    if (isWav) {
      // For WAV files, we need to strip headers and recombine with a single header
      console.log('[audio_combination] 🔧 Processing WAV chunks - stripping headers');

      const pcmDataChunks: Uint8Array[] = [];
      let totalPcmBytes = 0;

      // Extract PCM data from each WAV chunk by parsing the header properly
      for (let i = 0; i < allBlobs.length; i++) {
        const wavBlob = allBlobs[i];
        const arrayBuffer = await wavBlob.arrayBuffer();
        const wavData = new Uint8Array(arrayBuffer);

        // Parse WAV header to find data chunk offset
        // WAV format: RIFF header (12 bytes) + fmt chunk + data chunk
        let dataOffset = 12; // Start after RIFF header
        let dataChunkSize = 0;
        let foundDataChunk = false;

        console.log(`[audio_combination] Chunk ${i}: Total file size ${wavData.length} bytes`);

        // Search for the "data" chunk
        while (dataOffset < wavData.length - 8) {
          const chunkId = String.fromCharCode(
            wavData[dataOffset],
            wavData[dataOffset + 1],
            wavData[dataOffset + 2],
            wavData[dataOffset + 3]
          );
          const chunkSize =
            wavData[dataOffset + 4] |
            (wavData[dataOffset + 5] << 8) |
            (wavData[dataOffset + 6] << 16) |
            (wavData[dataOffset + 7] << 24);

          console.log(`[audio_combination] Chunk ${i}: Found chunk "${chunkId}" at offset ${dataOffset}, size ${chunkSize} bytes`);

          if (chunkId === 'data') {
            // Found data chunk - skip 8 bytes (chunk ID + size) to get to actual data
            dataOffset += 8;
            dataChunkSize = chunkSize;
            foundDataChunk = true;
            console.log(`[audio_combination] Chunk ${i}: ✅ Found data chunk at offset ${dataOffset - 8}, data size ${dataChunkSize} bytes`);
            break;
          }

          // Move to next chunk (skip chunk ID, size field, and chunk data)
          dataOffset += 8 + chunkSize;
        }

        if (!foundDataChunk) {
          console.error(`[audio_combination] ❌ Chunk ${i}: Failed to find data chunk! File may be corrupted.`);
          throw new Error(`WAV chunk ${i} missing data chunk`);
        }

        // Extract PCM data using the data chunk size (not just slice to end)
        const pcmData = wavData.slice(dataOffset, dataOffset + dataChunkSize);

        // Verify sample alignment (16-bit mono = 2 bytes per sample)
        if (pcmData.length % 2 !== 0) {
          console.warn(`[audio_combination] ⚠️ Chunk ${i}: Odd number of bytes (${pcmData.length}), trimming 1 byte for alignment`);
          // Trim last byte to maintain sample alignment
          pcmDataChunks.push(pcmData.slice(0, -1));
          totalPcmBytes += pcmData.length - 1;
        } else {
          pcmDataChunks.push(pcmData);
          totalPcmBytes += pcmData.length;
        }

        console.log(`[audio_combination] Chunk ${i}: ✅ Extracted ${pcmData.length} bytes of PCM data`);
      }

      console.log(`[audio_combination] 📊 Summary: ${pcmDataChunks.length} chunks, total ${totalPcmBytes} PCM bytes`);
      console.log(`[audio_combination] 📊 Chunk sizes: ${pcmDataChunks.map(c => c.length).join(', ')} bytes`);

      // Concatenate all PCM data
      const combinedPcm = new Uint8Array(totalPcmBytes);
      let offset = 0;
      for (let i = 0; i < pcmDataChunks.length; i++) {
        const pcmChunk = pcmDataChunks[i];
        console.log(`[audio_combination] Concatenating chunk ${i}: ${pcmChunk.length} bytes at offset ${offset}`);
        combinedPcm.set(pcmChunk, offset);
        offset += pcmChunk.length;
      }

      console.log(`[audio_combination] ✅ All PCM data concatenated: ${combinedPcm.length} bytes`);

      // Create new WAV file with single header
      // ElevenLabs audio: 48kHz, mono, 16-bit PCM
      combinedBlob = createWavBlob(combinedPcm, 48000, 1, 16);

      console.log(`[audio_combination] 🔗 Combined WAV: ${allBlobs.length} chunks, ${totalPcmBytes} PCM bytes, ${combinedBlob.size} total bytes (header + data) - ${Date.now() - startTime}ms elapsed`);
    } else {
      // For WebM, simple concatenation works
      combinedBlob = new Blob(allBlobs, { type: mimeType });
      console.log(`[audio_combination] 🔗 Combined ${speaker} blob (${fileExtension}): ${combinedBlob.size} bytes (${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB) - ${Date.now() - startTime}ms elapsed`);
    }

    // Upload combined file
    let combinedPath = '';

    try {
      const filePrefix = speaker === 'ai' ? 'combined-ai-' : 'combined-';
      const combinedFileName = `${filePrefix}${Date.now()}.${fileExtension}`;
      combinedPath = `v18-voice-recordings/${conversation_id}/${combinedFileName}`;

      console.log(`[audio_combination] 📤 Starting upload: ${(combinedBlob.size / 1024 / 1024).toFixed(2)} MB - ${Date.now() - startTime}ms elapsed`);

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

    } catch (error) {
      console.error('[audio_combination] ❌ Error during upload:', error);

      const errorMsg = error instanceof Error ? error.message : String(error);
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
