import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { getClaude35Model } from '@/config/models';
import { logV16MemoryServer } from '@/utils/server-logger';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY environment variable');
  }
  return new Anthropic({ apiKey });
}

/**
 * Fetches the V16 AI summary prompt from the database
 */
async function getV16AISummaryPrompt(): Promise<string> {
  const supabase = getSupabaseClient();
  
  const { data: promptData, error: promptError } = await supabase
    .from('prompts')
    .select('name')
    .eq('category', 'v16_ai_summary_prompt')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (promptError || !promptData?.name) {
    throw new Error(`Could not find active prompt for category: v16_ai_summary_prompt. Error: ${promptError?.message}`);
  }

  return promptData.name;
}

/**
 * Generates AI summary from V16 user profile data
 * Uses Claude to create up to 5-sentence summary for prompt injection
 */
export async function generateAISummaryFromV16Profile(
  userId: string,
  profileData: Record<string, unknown>
): Promise<string> {
  try {
    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_SUMMARY_GENERATION',
      operation: 'starting-summary-generation',
      data: {
        userId,
        profileDataKeys: Object.keys(profileData),
        profileDataSize: JSON.stringify(profileData).length
      }
    });

    // Fetch the V16 AI summary prompt
    const summaryPrompt = await getV16AISummaryPrompt();
    
    // Initialize Claude client
    const anthropic = getAnthropicClient();

    // Prepare the profile data as context for Claude
    const profileContext = JSON.stringify(profileData, null, 2);

    // Generate AI summary using Claude
    const response = await anthropic.messages.create({
      model: getClaude35Model(),
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `${summaryPrompt}

USER PROFILE DATA TO SUMMARIZE:
${profileContext}

Generate an AI instruction summary (up to 5 sentences) based on this user profile data.`
        }
      ]
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    if (!summary) {
      throw new Error('Claude returned empty summary');
    }

    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_SUMMARY_GENERATION',
      operation: 'summary-generated-successfully',
      data: {
        userId,
        summaryLength: summary.length,
        summaryPreview: summary.substring(0, 200) + '...'
      }
    });

    return summary;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logV16MemoryServer({
      level: 'ERROR',
      category: 'AI_SUMMARY_GENERATION',
      operation: 'summary-generation-failed',
      data: {
        userId,
        error: errorMessage,
        profileDataSize: JSON.stringify(profileData).length
      }
    });

    throw new Error(`Failed to generate AI summary for user ${userId}: ${errorMessage}`);
  }
}

/**
 * Updates the user_profiles table with the generated AI summary
 * This bridges V16 memory processing to the V15 prompt injection system
 */
export async function updateUserProfileAISummary(
  userId: string,
  aiSummary: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_SUMMARY_UPDATE',
      operation: 'updating-user-profile-summary',
      data: {
        userId,
        summaryLength: aiSummary.length
      }
    });

    // Check if user profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, version')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch existing user profile: ${fetchError.message}`);
    }

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          ai_instructions_summary: aiSummary,
          version: existingProfile.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        throw new Error(`Failed to update user profile: ${updateError.message}`);
      }

      logV16MemoryServer({
        level: 'INFO',
        category: 'AI_SUMMARY_UPDATE',
        operation: 'profile-updated-successfully',
        data: {
          userId,
          newVersion: existingProfile.version + 1,
          summaryLength: aiSummary.length
        }
      });

    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          ai_instructions_summary: aiSummary,
          profile_data: {},
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to create user profile: ${insertError.message}`);
      }

      logV16MemoryServer({
        level: 'INFO',
        category: 'AI_SUMMARY_UPDATE',
        operation: 'profile-created-successfully',
        data: {
          userId,
          version: 1,
          summaryLength: aiSummary.length
        }
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logV16MemoryServer({
      level: 'ERROR',
      category: 'AI_SUMMARY_UPDATE',
      operation: 'profile-update-failed',
      data: {
        userId,
        error: errorMessage
      }
    });

    throw new Error(`Failed to update user profile AI summary for user ${userId}: ${errorMessage}`);
  }
}