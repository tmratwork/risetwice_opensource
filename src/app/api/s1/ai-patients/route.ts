// src/app/api/s1/ai-patients/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    // For testing - skip auth validation
    const searchParams = request.nextUrl.searchParams;
    const difficulty = searchParams.get('difficulty');
    const primaryConcern = searchParams.get('primary_concern');
    const isActive = searchParams.get('is_active') !== 'false';

    let query = supabaseAdmin
      .from('s1_ai_patients')
      .select(`
        id,
        name,
        age,
        gender,
        primary_concern,
        secondary_concerns,
        severity_level,
        personality_traits,
        background_story,
        therapeutic_goals,
        difficulty_level,
        created_at
      `)
      .eq('is_active', isActive)
      .order('created_at', { ascending: false });

    if (difficulty) {
      query = query.eq('difficulty_level', difficulty);
    }

    if (primaryConcern) {
      query = query.eq('primary_concern', primaryConcern);
    }

    const { data: aiPatients, error } = await query;

    if (error) {
      console.error('Error fetching AI patients:', error);
      return NextResponse.json({ error: 'Failed to fetch AI patients' }, { status: 500 });
    }

    return NextResponse.json({ aiPatients });

  } catch (error) {
    console.error('Error in GET /api/s1/ai-patients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}