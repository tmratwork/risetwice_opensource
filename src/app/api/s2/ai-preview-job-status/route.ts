// src/app/api/s2/ai-preview-job-status/route.ts
// Get detailed AI Preview job status including current step

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter required' },
        { status: 400 }
      );
    }

    // Get therapist profile
    const { data: profile } = await supabase
      .from('s2_therapist_profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({
        success: true,
        job: null
      });
    }

    // Get latest job for this therapist
    const { data: jobs } = await supabase
      .from('s2_ai_preview_jobs')
      .select('status, current_step, current_step_number, total_steps, updated_at')
      .eq('therapist_profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        job: null
      });
    }

    return NextResponse.json({
      success: true,
      job: jobs[0]
    });

  } catch (error) {
    console.error('[S2] Error in ai-preview-job-status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
