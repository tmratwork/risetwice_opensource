// src/app/api/admin/s2/therapist-prompts/route.ts
// Get existing prompts for a specific therapist

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const therapistId = searchParams.get('therapistId');

    if (!therapistId) {
      return NextResponse.json(
        { error: 'therapistId parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[s2_prompts] Fetching prompts for therapist: ${therapistId}`);

    // Get prompts for this therapist, sorted by creation date (latest first)
    const { data: prompts, error } = await supabase
      .from('s2_ai_therapist_prompts')
      .select('id, prompt_title, prompt_version, prompt_text, created_at, status, completeness_score, confidence_score')
      .eq('therapist_profile_id', therapistId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[s2_prompts] Error fetching prompts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prompts', details: error.message },
        { status: 500 }
      );
    }

    console.log(`[s2_prompts] ✅ Found ${prompts?.length || 0} prompts for therapist`);

    return NextResponse.json({
      success: true,
      prompts: prompts || [],
      count: prompts?.length || 0
    });

  } catch (error) {
    console.error('[s2_prompts] Error in GET request:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}