import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// V16 AI Prompt types based on V16.md
const V16_PROMPT_TYPES = [
  'triage',
  'crisis_specialist',
  'anxiety_specialist', 
  'depression_specialist',
  'trauma_specialist',
  'substance_use_specialist',
  'practical_support_specialist',
  'cbt_specialist',
  'dbt_specialist',
  'universal',
  'universal_functions'
] as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptType = searchParams.get('type');

    // console.log(`[V16] 📡 ADMIN-API: GET ai-prompts request`, {
    //   promptType,
    //   timestamp: new Date().toISOString()
    // });

    if (promptType) {
      // Get specific prompt type
      if (!V16_PROMPT_TYPES.includes(promptType as typeof V16_PROMPT_TYPES[number])) {
    // console.error(`[V16] ❌ ADMIN-API: Invalid prompt type: ${promptType}`);
        return NextResponse.json(
          { error: `Invalid prompt type. Must be one of: ${V16_PROMPT_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      // Use RLS-compliant RPC function for admin access
      const { data: promptArray, error } = await supabaseAdmin
        .rpc('get_ai_prompt_by_type', {
          target_prompt_type: promptType,
          requesting_user_id: 'admin'
        });
      
      const data = promptArray?.[0] || null;

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
    // console.error(`[V16] ❌ ADMIN-API: Database error fetching prompt ${promptType}:`, error);
        return NextResponse.json(
          { error: `Failed to fetch prompt: ${error.message}` },
          { status: 500 }
        );
      }

      if (!data) {
    // console.log(`[V16] 📭 ADMIN-API: No prompt found for type: ${promptType}`);
        return NextResponse.json({
          success: true,
          prompt: null,
          message: `No prompt found for type: ${promptType}`
        });
      }

    // console.log(`[V16] ✅ ADMIN-API: Retrieved prompt for ${promptType}`, {
    //     promptId: data.id,
    //     contentLength: data.prompt_content?.length || 0
    //   });

      return NextResponse.json({
        success: true,
        prompt: data
      });
    } else {
      // Get all V16 prompts
      const { data, error } = await supabaseAdmin
        .from('ai_prompts')
        .select('*')
        .in('prompt_type', V16_PROMPT_TYPES)
        .eq('is_active', true)
        .order('prompt_type');

      if (error) {
    // console.error(`[V16] ❌ ADMIN-API: Database error fetching all prompts:`, error);
        return NextResponse.json(
          { error: `Failed to fetch prompts: ${error.message}` },
          { status: 500 }
        );
      }

    // console.log(`[V16] ✅ ADMIN-API: Retrieved ${data?.length || 0} V16 prompts`);

      return NextResponse.json({
        success: true,
        prompts: data || [],
        promptTypes: V16_PROMPT_TYPES
      });
    }

  } catch (error) {
    // console.error('[V16] ❌ ADMIN-API: Unexpected error in GET ai-prompts', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack
    // });
    void error;
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { promptType, content, voiceSettings, metadata, functions, mergeWithUniversalFunctions, mergeWithUniversalProtocols } = body;

    // console.log(`[V16] 📡 ADMIN-API: POST ai-prompts request`, {
    //   promptType,
    //   contentLength: content?.length || 0,
    //   hasVoiceSettings: !!voiceSettings,
    //   hasMetadata: !!metadata,
    //   hasFunctions: !!functions,
    //   functionsCount: Array.isArray(functions) ? functions.length : 0,
    //   userId: userId || 'unknown',
    //   timestamp: new Date().toISOString()
    // });

    // Validation
    if (!promptType || !content) {
    // console.error(`[V16] ❌ ADMIN-API: Missing required fields`, {
    //     hasPromptType: !!promptType,
    //     hasContent: !!content
    //   });
      return NextResponse.json(
        { error: 'promptType and content are required' },
        { status: 400 }
      );
    }

    if (!V16_PROMPT_TYPES.includes(promptType)) {
    // console.error(`[V16] ❌ ADMIN-API: Invalid prompt type: ${promptType}`);
      return NextResponse.json(
        { error: `Invalid prompt type. Must be one of: ${V16_PROMPT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if prompt already exists
    const { data: existingPrompt } = await supabaseAdmin
      .from('ai_prompts')
      .select('id')
      .eq('prompt_type', promptType)
      .eq('is_active', true)
      .single();

    if (existingPrompt) {
      // Update existing prompt
    // console.log(`[V16] 🔄 ADMIN-API: Updating existing prompt for ${promptType}`, {
    //     existingId: existingPrompt.id
    //   });

      const { data, error } = await supabaseAdmin
        .from('ai_prompts')
        .update({
          prompt_content: content,
          voice_settings: voiceSettings || null,
          metadata: metadata || null,
          functions: functions || [],
          merge_with_universal_functions: mergeWithUniversalFunctions ?? true,
          merge_with_universal_protocols: mergeWithUniversalProtocols ?? true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPrompt.id)
        .select()
        .single();

      if (error) {
    // console.error(`[V16] ❌ ADMIN-API: Error updating prompt ${promptType}:`, error);
        return NextResponse.json(
          { error: `Failed to update prompt: ${error.message}` },
          { status: 500 }
        );
      }

    // console.log(`[V16] ✅ ADMIN-API: Successfully updated prompt for ${promptType}`, {
    //     promptId: data.id,
    //     contentLength: data.prompt_content?.length || 0
    //   });

      return NextResponse.json({
        success: true,
        prompt: data,
        action: 'updated'
      });
    } else {
      // Create new prompt
    // console.log(`[V16] 🆕 ADMIN-API: Creating new prompt for ${promptType}`);

      const { data, error } = await supabaseAdmin
        .from('ai_prompts')
        .insert({
          prompt_type: promptType,
          prompt_content: content,
          voice_settings: voiceSettings || null,
          metadata: metadata || null,
          functions: functions || [],
          merge_with_universal_functions: mergeWithUniversalFunctions ?? true,
          merge_with_universal_protocols: mergeWithUniversalProtocols ?? true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
    // console.error(`[V16] ❌ ADMIN-API: Error creating prompt ${promptType}:`, error);
        return NextResponse.json(
          { error: `Failed to create prompt: ${error.message}` },
          { status: 500 }
        );
      }

    // console.log(`[V16] ✅ ADMIN-API: Successfully created prompt for ${promptType}`, {
    //     promptId: data.id,
    //     contentLength: data.prompt_content?.length || 0
    //   });

      return NextResponse.json({
        success: true,
        prompt: data,
        action: 'created'
      });
    }

  } catch (error) {
    // console.error('[V16] ❌ ADMIN-API: Unexpected error in POST ai-prompts', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack
    // });
    void error;
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}