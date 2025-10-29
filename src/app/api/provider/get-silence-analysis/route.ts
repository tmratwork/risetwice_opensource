// src/app/api/provider/get-silence-analysis/route.ts
// Retrieves cached silence analysis results from database

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get('file_path');
    const bucketName = searchParams.get('bucket_name') || 'audio-recordings';

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Query database for existing analysis
    const { data: analysis, error } = await supabaseAdmin
      .from('audio_silence_analysis')
      .select('*')
      .eq('file_path', filePath)
      .eq('bucket_name', bucketName)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('[get_silence_analysis] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to query analysis' },
        { status: 500 }
      );
    }

    if (!analysis) {
      return NextResponse.json({
        success: true,
        exists: false,
        analysis: null
      });
    }

    return NextResponse.json({
      success: true,
      exists: true,
      analysis: {
        silence_segments: analysis.silence_segments,
        duration_seconds: analysis.duration_seconds,
        analyzed_at: analysis.analyzed_at
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get_silence_analysis] Error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve analysis',
      details: errorMessage
    }, { status: 500 });
  }
}
