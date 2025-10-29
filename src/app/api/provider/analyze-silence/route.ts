// src/app/api/provider/analyze-silence/route.ts
// Analyzes audio file for silent segments using FFmpeg silencedetect filter

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for analysis

interface SilenceSegment {
  start: number;
  end: number;
}

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const body = await request.json();
    const { filePath, bucketName = 'audio-recordings' } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    console.log('[silence_analysis] 🎯 Starting analysis for:', filePath);

    // Check if analysis already exists
    const { data: existing } = await supabaseAdmin
      .from('audio_silence_analysis')
      .select('*')
      .eq('file_path', filePath)
      .eq('bucket_name', bucketName)
      .single();

    if (existing) {
      console.log('[silence_analysis] ✅ Analysis already exists, returning cached result');
      return NextResponse.json({
        success: true,
        cached: true,
        silenceSegments: existing.silence_segments,
        durationSeconds: existing.duration_seconds
      });
    }

    // Download audio file from Supabase Storage to temp location
    console.log('[silence_analysis] 📥 Downloading audio from bucket:', bucketName);
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('[silence_analysis] ❌ Download failed:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download audio file', details: downloadError?.message },
        { status: 500 }
      );
    }

    // Create temporary file
    const tempDir = os.tmpdir();
    const fileExtension = path.extname(filePath) || '.webm';
    tempFilePath = path.join(tempDir, `audio-analysis-${Date.now()}${fileExtension}`);

    console.log('[silence_analysis] 💾 Writing to temp file:', tempFilePath);
    const arrayBuffer = await fileData.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(arrayBuffer));

    // Analyze audio with FFmpeg
    console.log('[silence_analysis] 🔍 Running FFmpeg silence detection...');
    const { silenceSegments, duration } = await analyzeSilence(tempFilePath);

    console.log('[silence_analysis] 📊 Analysis complete:', {
      segments: silenceSegments.length,
      duration: duration.toFixed(2) + 's'
    });

    // Store results in database (upsert to handle race conditions)
    const { error: upsertError } = await supabaseAdmin
      .from('audio_silence_analysis')
      .upsert({
        file_path: filePath,
        bucket_name: bucketName,
        silence_segments: silenceSegments,
        duration_seconds: duration,
        threshold_db: -50,
        min_silence_duration: 0.5,
        analyzed_at: new Date().toISOString()
      }, {
        onConflict: 'file_path',
        ignoreDuplicates: false  // Update if exists
      });

    if (upsertError) {
      console.error('[silence_analysis] ❌ Failed to store analysis:', upsertError);
      // Don't fail the request - return the analysis anyway
    } else {
      console.log('[silence_analysis] ✅ Analysis stored in database');
    }

    return NextResponse.json({
      success: true,
      cached: false,
      silenceSegments,
      durationSeconds: duration,
      segmentCount: silenceSegments.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[silence_analysis] ❌ Analysis failed:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to analyze audio',
      details: errorMessage
    }, { status: 500 });

  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log('[silence_analysis] 🧹 Temp file cleaned up');
      } catch (cleanupError) {
        console.error('[silence_analysis] ⚠️ Failed to cleanup temp file:', cleanupError);
      }
    }
  }
}

/**
 * Analyzes audio file using FFmpeg silencedetect filter
 * Returns array of silence segments and total duration
 */
function analyzeSilence(filePath: string): Promise<{ silenceSegments: SilenceSegment[]; duration: number }> {
  return new Promise((resolve, reject) => {
    const segments: SilenceSegment[] = [];
    let currentSegment: Partial<SilenceSegment> | null = null;
    let duration = 0;

    ffmpeg(filePath)
      .audioFilters('silencedetect=noise=-50dB:d=0.5')
      .format('null')
      .on('stderr', (stderrLine: string) => {
        // Parse FFmpeg stderr output for silence detection
        // Example lines:
        // [silencedetect @ 0x...] silence_start: 12.5
        // [silencedetect @ 0x...] silence_end: 15.2 | silence_duration: 2.7

        const silenceStartMatch = stderrLine.match(/silence_start:\s*([\d.]+)/);
        const silenceEndMatch = stderrLine.match(/silence_end:\s*([\d.]+)/);
        const durationMatch = stderrLine.match(/Duration:\s*(\d{2}):(\d{2}):([\d.]+)/);

        if (durationMatch) {
          const hours = parseInt(durationMatch[1], 10);
          const minutes = parseInt(durationMatch[2], 10);
          const seconds = parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }

        if (silenceStartMatch) {
          const start = parseFloat(silenceStartMatch[1]);
          currentSegment = { start };
        }

        if (silenceEndMatch && currentSegment) {
          const end = parseFloat(silenceEndMatch[1]);
          currentSegment.end = end;

          // Only add complete segments where end > start
          if (currentSegment.start !== undefined && currentSegment.end > currentSegment.start) {
            segments.push({
              start: currentSegment.start,
              end: currentSegment.end
            });
          }

          currentSegment = null;
        }
      })
      .on('end', () => {
        resolve({ silenceSegments: segments, duration });
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .save('-'); // Output to null (we only care about stderr analysis)
  });
}
