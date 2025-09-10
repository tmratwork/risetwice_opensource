// src/app/api/s1/ai-prompts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required parameter: type' },
        { status: 400 }
      );
    }

    console.log('[S1] Fetching AI prompt for type:', type);

    // Fetch from s1_ai_prompts table (separate from V16's ai_prompts)
    const { data: prompt, error } = await supabaseAdmin
      .from('s1_ai_prompts')
      .select('*')
      .eq('prompt_type', type)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        console.log('[S1] No active prompt found for type:', type);
        return NextResponse.json({ prompt: null }, { status: 200 });
      }
      
      console.error('[S1] Error fetching prompt:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[S1] Prompt fetched successfully:', {
      id: prompt.id,
      type: prompt.prompt_type,
      promptLength: prompt.prompt_content?.length || 0
    });

    return NextResponse.json({ prompt }, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/s1/ai-prompts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}