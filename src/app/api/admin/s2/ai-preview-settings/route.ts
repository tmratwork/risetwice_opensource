// src/app/api/admin/s2/ai-preview-settings/route.ts
// API route for managing AI Preview settings

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Fetch existing AI Preview prompt
export async function GET() {
  try {
    console.log('[ai_preview_settings] Fetching AI Preview prompt settings');

    const { data: prompts, error } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_type', 'ai_preview')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[ai_preview_settings] Supabase error:', error);
      return NextResponse.json({
        error: 'Failed to fetch AI Preview settings'
      }, { status: 500 });
    }

    const prompt = prompts && prompts.length > 0 ? prompts[0] : null;

    console.log(`[ai_preview_settings] ✅ AI Preview prompt ${prompt ? 'found' : 'not found'}`);

    return NextResponse.json({
      success: true,
      prompt: prompt
    });

  } catch (error) {
    console.error('[ai_preview_settings] Error fetching settings:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create or update AI Preview prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt_content, action } = body;

    if (!prompt_content || !prompt_content.trim()) {
      return NextResponse.json({
        error: 'Prompt content is required'
      }, { status: 400 });
    }

    console.log(`[ai_preview_settings] ${action === 'update' ? 'Updating' : 'Creating'} AI Preview prompt`);

    if (action === 'update') {
      // Update existing prompt
      const { data, error } = await supabase
        .from('ai_prompts')
        .update({
          prompt_content: prompt_content.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('prompt_type', 'ai_preview')
        .select()
        .single();

      if (error) {
        console.error('[ai_preview_settings] Update error:', error);
        return NextResponse.json({
          error: 'Failed to update AI Preview settings'
        }, { status: 500 });
      }

      console.log('[ai_preview_settings] ✅ AI Preview prompt updated successfully');

      return NextResponse.json({
        success: true,
        prompt: data
      });

    } else {
      // Create new prompt
      const { data, error } = await supabase
        .from('ai_prompts')
        .insert({
          prompt_type: 'ai_preview',
          prompt_content: prompt_content.trim(),
          functions: [],
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.1,
            use_speaker_boost: true,
            speed: 1.0
          },
          metadata: {
            purpose: 'AI Preview and Testing',
            usage: 'S2 Admin Panel Therapist Previews',
            created_for: 'Therapist prompt testing and validation'
          },
          is_active: true,
          merge_with_universal_functions: false,
          merge_with_universal_protocols: false
        })
        .select()
        .single();

      if (error) {
        console.error('[ai_preview_settings] Create error:', error);
        return NextResponse.json({
          error: 'Failed to create AI Preview settings'
        }, { status: 500 });
      }

      console.log('[ai_preview_settings] ✅ AI Preview prompt created successfully');

      return NextResponse.json({
        success: true,
        prompt: data
      });
    }

  } catch (error) {
    console.error('[ai_preview_settings] Error saving settings:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}