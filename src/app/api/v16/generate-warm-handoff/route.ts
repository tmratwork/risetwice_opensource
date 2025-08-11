import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getPrompt(category: string): Promise<string> {
  // First get the prompt ID from the prompts table
  const { data: promptData, error: promptError } = await supabase
    .from('prompts')
    .select('id')
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (promptError || !promptData?.id) {
    throw new Error(`Could not find active prompt for category: ${category}`);
  }

  // Then get the latest version content from prompt_versions table
  const { data: versionData, error: versionError } = await supabase
    .from('prompt_versions')
    .select('content')
    .eq('prompt_id', promptData.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (versionError || !versionData?.content) {
    throw new Error(`Could not find version content for prompt category: ${category}`);
  }

  return versionData.content;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get the unified user profile data
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profileData) {
      console.error('Error fetching user profile data:', profileError);
      return NextResponse.json({ error: 'User profile data not found' }, { status: 404 });
    }

    // Get prompts from database
    const systemPrompt = await getPrompt('warm_handoff_system');
    const userPromptTemplate = await getPrompt('warm_handoff_user');

    // Replace placeholder with actual profile data
    const userPrompt = userPromptTemplate.replace(
      '{PROFILE_DATA}',
      JSON.stringify(profileData.profile_data, null, 2)
    );

    // Debug logging to diagnose profile data injection
    const logWarmHandoff = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS === 'true') {
        console.log(`[warm_handoff] ${message}`, ...args);
      }
    };

    logWarmHandoff('=== WARM HANDOFF DEBUG START ===');
    logWarmHandoff('1. Database query results:');
    logWarmHandoff('   - System prompt from DB:', systemPrompt);
    logWarmHandoff('   - User template from DB:', userPromptTemplate);
    logWarmHandoff('   - Profile data exists:', !!profileData.profile_data);
    logWarmHandoff('   - Profile data keys:', Object.keys(profileData.profile_data || {}));
    
    logWarmHandoff('2. Template processing:');
    logWarmHandoff('   - Template has {PROFILE_DATA}:', userPromptTemplate.includes('{PROFILE_DATA}'));
    logWarmHandoff('   - Template before replace:', userPromptTemplate);
    logWarmHandoff('   - Template after replace:', userPrompt);
    logWarmHandoff('   - Did replacement occur:', userPrompt !== userPromptTemplate);
    
    logWarmHandoff('3. Profile data sample (first 200 chars):');
    const profileSample = JSON.stringify(profileData.profile_data, null, 2).substring(0, 200);
    logWarmHandoff('   - Profile snippet:', profileSample + '...');
    
    logWarmHandoff('4. What gets sent to OpenAI:');
    logWarmHandoff('   - System message length:', systemPrompt.length);
    logWarmHandoff('   - User message length:', userPrompt.length);
    logWarmHandoff('   - System message content:', systemPrompt);
    logWarmHandoff('   - User message content:', userPrompt);
    
    logWarmHandoff('5. Expected vs Actual:');
    logWarmHandoff('   - Expected: User prompt should contain profile data');
    logWarmHandoff('   - Actual: User prompt length =', userPrompt.length, 'chars');
    logWarmHandoff('   - Problem: Template lacks {PROFILE_DATA} placeholder');
    logWarmHandoff('=== WARM HANDOFF DEBUG END ===');

    // Generate the warm handoff using OpenAI
    const handoffResponse = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
      // GPT-5 models only support default temperature (1.0)
      // temperature: 0.3,  // Removed - not supported by GPT-5
    });

    const handoffContent = handoffResponse.choices[0]?.message?.content;
    if (!handoffContent) {
      throw new Error('Failed to generate warm handoff content');
    }

    // Save the warm handoff data
    const { data: savedHandoff, error: saveError } = await supabase
      .from('v16_warm_handoffs')
      .insert({
        user_id: userId,
        source_memory_id: profileData.id, // Reference the user profile instead of memory batch
        handoff_content: handoffContent,
        generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving warm handoff data:', saveError);
      return NextResponse.json({ error: 'Failed to save warm handoff data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      handoff: savedHandoff
    });

  } catch (error) {
    console.error('Error in generate-warm-handoff API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}