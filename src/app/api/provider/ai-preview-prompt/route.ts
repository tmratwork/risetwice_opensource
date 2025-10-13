// src/app/api/provider/ai-preview-prompt/route.ts
// API route for provider-specific AI preview prompt customization

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET: Fetch provider's custom prompt or global default
export async function GET(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-user-id');

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    // Try to get provider-specific prompt (will fail gracefully if UUID mismatch)
    const { data: providerPrompt, error: providerError } = await supabase
      .from('s2_provider_ai_preview_prompts')
      .select('*')
      .eq('user_id', firebaseUid)
      .eq('is_active', true)
      .single();

    // If error is NOT "no rows found", log it but continue to fallback
    if (providerError && providerError.code !== 'PGRST116' && providerError.code !== '22P02') {
      console.error('[provider_ai_preview_prompt] Error fetching provider prompt:', providerError);
    }

    // If provider has custom prompt, return it
    if (providerPrompt) {
      return NextResponse.json({
        hasCustomPrompt: true,
        prompt: providerPrompt,
        isUsingDefault: false
      });
    }

    // Otherwise, get global default
    const { data: globalPrompt, error: globalError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_type', 'ai_preview')
      .eq('is_active', true)
      .single();

    if (globalError) {
      console.error('[provider_ai_preview_prompt] Error fetching global prompt:', globalError);
      return NextResponse.json(
        { error: 'Failed to fetch default prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasCustomPrompt: false,
      prompt: {
        id: globalPrompt.id,
        prompt_content: globalPrompt.prompt_content,
        created_at: globalPrompt.created_at,
        updated_at: globalPrompt.updated_at
      },
      isUsingDefault: true
    });

  } catch (error) {
    console.error('[provider_ai_preview_prompt] Error in GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Save or update provider's custom prompt
export async function POST(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-user-id');

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt_content } = body;

    if (!prompt_content || !prompt_content.trim()) {
      return NextResponse.json(
        { error: 'Prompt content is required' },
        { status: 400 }
      );
    }

    // Check if provider already has a custom prompt
    const { data: existingPrompt } = await supabase
      .from('s2_provider_ai_preview_prompts')
      .select('id')
      .eq('user_id', firebaseUid)
      .eq('is_active', true)
      .single();

    let result;

    if (existingPrompt) {
      // Update existing prompt
      const { data, error } = await supabase
        .from('s2_provider_ai_preview_prompts')
        .update({
          prompt_content: prompt_content.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPrompt.id)
        .select()
        .single();

      if (error) {
        console.error('[provider_ai_preview_prompt] Error updating prompt:', error);
        return NextResponse.json(
          { error: 'Failed to update prompt' },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // Create new prompt
      const { data, error } = await supabase
        .from('s2_provider_ai_preview_prompts')
        .insert({
          user_id: firebaseUid,
          prompt_content: prompt_content.trim(),
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('[provider_ai_preview_prompt] Error creating prompt:', error);
        return NextResponse.json(
          { error: 'Failed to create prompt' },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      prompt: result,
      action: existingPrompt ? 'updated' : 'created'
    });

  } catch (error) {
    console.error('[provider_ai_preview_prompt] Error in POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Reset to global default by removing custom prompt
export async function DELETE(request: NextRequest) {
  try {
    const firebaseUid = request.headers.get('x-user-id');

    if (!firebaseUid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    // Delete provider's custom prompt
    const { error } = await supabase
      .from('s2_provider_ai_preview_prompts')
      .delete()
      .eq('user_id', firebaseUid)
      .eq('is_active', true);

    if (error) {
      console.error('[provider_ai_preview_prompt] Error deleting prompt:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom prompt' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Custom prompt deleted, now using global default'
    });

  } catch (error) {
    console.error('[provider_ai_preview_prompt] Error in DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
