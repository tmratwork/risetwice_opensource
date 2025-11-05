// src/app/api/provider/trigger-transcription/route.ts
// Manually trigger transcription for an intake (useful for existing intakes)

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { intake_id } = await request.json();

    console.log('[trigger_transcription] 🎯 Manually triggering transcription for intake:', intake_id);

    if (!intake_id) {
      return NextResponse.json(
        { error: 'intake_id is required' },
        { status: 400 }
      );
    }

    // Get intake data
    const { data: intake, error: intakeError } = await supabaseAdmin
      .from('intake_sessions')
      .select('id, conversation_id')
      .eq('id', intake_id)
      .single();

    if (intakeError || !intake) {
      return NextResponse.json(
        { error: 'Intake not found' },
        { status: 404 }
      );
    }

    if (!intake.conversation_id) {
      return NextResponse.json(
        { error: 'No conversation_id found for this intake' },
        { status: 400 }
      );
    }

    // Find combined audio file
    const { data: combinationJob, error: jobError } = await supabaseAdmin
      .from('audio_combination_jobs')
      .select('combined_file_path, status')
      .eq('conversation_id', intake.conversation_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (jobError || !combinationJob || !combinationJob.combined_file_path) {
      return NextResponse.json(
        { error: 'No combined audio file found. Audio must be combined first.' },
        { status: 404 }
      );
    }

    console.log('[trigger_transcription] ✅ Found combined audio:', combinationJob.combined_file_path);

    // Trigger transcription
    const transcriptionResponse = await fetch(`${request.nextUrl.origin}/api/provider/transcribe-intake-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intake_id: intake.id,
        conversation_id: intake.conversation_id,
        combined_audio_path: combinationJob.combined_file_path
      })
    });

    const transcriptionResult = await transcriptionResponse.json();

    if (!transcriptionResponse.ok) {
      console.error('[trigger_transcription] ❌ Transcription failed:', transcriptionResult);
      return NextResponse.json(
        { error: 'Failed to start transcription', details: transcriptionResult },
        { status: 500 }
      );
    }

    console.log('[trigger_transcription] ✅ Transcription triggered successfully');

    return NextResponse.json({
      success: true,
      message: 'Transcription started',
      transcription: transcriptionResult
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[trigger_transcription] ❌ Error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: 'Failed to trigger transcription',
      details: errorMessage
    }, { status: 500 });
  }
}
