// src/app/api/provider/intake-transcript/route.ts
// Fetches transcript for patient intake

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const intakeId = searchParams.get('intake_id');

    if (!intakeId) {
      return NextResponse.json(
        { error: 'Intake ID is required' },
        { status: 400 }
      );
    }

    // Fetch transcript from database
    const { data: transcriptData, error: transcriptError } = await supabaseAdmin
      .from('patient_intake_transcripts')
      .select('*')
      .eq('intake_id', intakeId)
      .single();

    if (transcriptError) {
      // No transcript found yet
      return NextResponse.json({
        success: true,
        status: 'not_found',
        message: 'Transcript not yet available'
      });
    }

    return NextResponse.json({
      success: true,
      status: transcriptData.status,
      transcript: transcriptData.transcript_text,
      duration: transcriptData.audio_duration_seconds,
      model: transcriptData.model_used,
      completedAt: transcriptData.transcription_completed_at
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch transcript',
      details: errorMessage
    }, { status: 500 });
  }
}
