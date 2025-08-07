import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface SavePromptRequest {
  userId: string;
  category: string;
  content: string;
  title?: string;
  notes?: string;
}

/**
 * V15 Save Prompt Endpoint
 * Saves prompts to database for V15 admin interface
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as SavePromptRequest;
    const { userId, category, content, title, notes } = body;

    if (!userId || !category || !content) {
      return NextResponse.json(
        { error: 'userId, category, and content are required' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = [
      'profile_merge_system', 
      'profile_merge_user', 
      'ai_summary_prompt',
      'insights_system',
      'insights_user',
      // V16 Memory System categories
      'v16_what_ai_remembers_extraction_system',
      'v16_what_ai_remembers_extraction_user',
      'v16_what_ai_remembers_profile_merge_system',
      'v16_what_ai_remembers_profile_merge_user',
      'v16_ai_summary_prompt',
      // V16 Warm Handoff categories (V16-specific)
      'v16_warm_handoff_system',
      'v16_warm_handoff_user',
      // Existing warm handoff categories (V15)
      'warm_handoff_system',
      'warm_handoff_user'
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category. Must be one of: ' + validCategories.join(', ') },
        { status: 400 }
      );
    }

    // Create prompt record
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .insert({
        name: title || `${category} prompt updated ${new Date().toLocaleString()}`,
        description: `V15 ${category} prompt`,
        category,
        created_by: userId,
        is_active: true,
        is_global: false, // V15 doesn't use global flag
      })
      .select('id')
      .single();

    if (promptError) {
      console.error('Error creating prompt:', promptError);
      return NextResponse.json(
        { error: 'Failed to create prompt', details: promptError },
        { status: 500 }
      );
    }

    // Create prompt version
    const { data: versionData, error: versionError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: promptData.id,
        content,
        version_number: 1,
        created_by: userId,
        notes: notes || 'Created via V15 admin interface',
      })
      .select('id')
      .single();

    if (versionError) {
      console.error('Error creating prompt version:', versionError);
      return NextResponse.json(
        { error: 'Failed to create prompt version', details: versionError },
        { status: 500 }
      );
    }

    // Fetch the complete prompt data for response
    const { data: completePrompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', promptData.id)
      .single();

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${category} prompt`,
      prompt: completePrompt,
      promptId: promptData.id,
      versionId: versionData.id,
    });

  } catch (error) {
    console.error('Error in save-prompt:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}