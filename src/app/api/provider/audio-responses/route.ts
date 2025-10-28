// src/app/api/provider/audio-responses/route.ts
// API route to fetch provider audio responses for an intake

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intakeId = searchParams.get('intake_id');

    if (!intakeId) {
      return NextResponse.json(
        { success: false, error: 'Missing intake_id parameter' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all audio messages for this intake
    const { data: recordings, error } = await supabase
      .from('provider_patient_audio_messages')
      .select('id, audio_url, created_at, duration_seconds')
      .eq('intake_id', intakeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching audio responses:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recordings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordings: recordings?.map(r => ({
        id: r.id,
        audioUrl: r.audio_url,
        createdAt: r.created_at,
        durationSeconds: r.duration_seconds
      })) || []
    });
  } catch (error) {
    console.error('Error in audio-responses:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
