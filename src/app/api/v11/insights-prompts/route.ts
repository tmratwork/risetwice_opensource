import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint to get system and user prompts used for insight generation
 * Supports fetching both types or specifically system or user prompts
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const promptType = request.nextUrl.searchParams.get('type'); // 'system', 'user', or null for both

    // Make sure we have a user ID
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Define which categories to fetch
    let categories: string[] = [];
    if (!promptType || promptType === 'both') {
      categories = ['insights_system', 'insights_user'];
    } else if (promptType === 'system') {
      categories = ['insights_system'];
    } else if (promptType === 'user') {
      categories = ['insights_user'];
    } else {
      return NextResponse.json({ error: 'Invalid prompt type. Use "system", "user", or omit for both.' }, { status: 400 });
    }

    // Get all potential prompts (user-specific and global)
    const query = supabase.from('prompts')
      .select('id, name, category, is_global')
      .in('category', categories)
      .eq('is_active', 'true')
      .or(`created_by.eq.${userId},is_global.eq.true`);

    const { data: prompts, error: promptsError } = await query;

    if (promptsError) {
      console.error('Error fetching prompts:', promptsError);
      return NextResponse.json(
        { error: 'Failed to fetch prompts', details: promptsError.message },
        { status: 500 }
      );
    }

    if (!prompts || prompts.length === 0) {
      // Return default prompts from the insights code
      // This allows the system to work before any custom prompts are created
      return NextResponse.json({
        success: true,
        data: {
          systemPrompt: getDefaultSystemPrompt(),
          userPrompt: getDefaultUserPrompt()
        }
      });
    }

    // For each prompt category, find the most recently assigned version for this user
    const result: {
      systemPrompt?: string;
      userPrompt?: string;
    } = {};

    // For each prompt, get the latest assigned version
    for (const prompt of prompts) {
      // First get the latest prompt version ID
      const { data: latestVersionId, error: versionError } = await supabase
        .rpc('get_latest_prompt_version_id', { p_prompt_id: prompt.id });

      if (versionError) {
        console.error(`Error fetching latest version for prompt ${prompt.id}:`, versionError);
        continue;
      }

      // Get latest assignment for this user and prompt
      const { data: assignment, error: assignmentError } = await supabase
        .from('user_prompt_assignments')
        .select('prompt_version_id, assigned_at')
        .eq('user_id', userId)
        .eq('prompt_version_id', latestVersionId)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();

      if (assignmentError && assignmentError.code !== 'PGRST116') {
        console.error(`Error fetching assignment for prompt ${prompt.id}:`, assignmentError);
        continue;
      }

      // If we found an assignment, get the prompt version content
      if (assignment) {
        const { data: version, error: versionError } = await supabase
          .from('prompt_versions')
          .select('content')
          .eq('id', assignment.prompt_version_id)
          .single();

        if (versionError) {
          console.error(`Error fetching prompt version ${assignment.prompt_version_id}:`, versionError);
          continue;
        }

        if (version) {
          if (prompt.category === 'insights_system') {
            result.systemPrompt = version.content;
          } else if (prompt.category === 'insights_user') {
            result.userPrompt = version.content;
          }
        }
      }
    }

    // If we didn't find any assigned prompts, use defaults
    if (!result.systemPrompt) {
      result.systemPrompt = getDefaultSystemPrompt();
    }

    if (!result.userPrompt) {
      result.userPrompt = getDefaultUserPrompt();
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Unexpected error in insights-prompts endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Default prompts from the user-insights route.ts
function getDefaultSystemPrompt(): string {
  return `You are analyzing a conversation between a user and an AI assistant, following a trauma-informed youth mental health approach. Extract insights that can help empower the young person, focusing only on information that would benefit them directly.

Extract only the following insight types, aligning with trauma-informed principles:
1. Strengths the AI has affirmed - Look for AI affirmations and self-efficacy statements
2. Current goals/priorities - Explicit goal statements or repeated value themes
3. Coping skills that seem helpful - Skills mentioned that helped or positive feedback on coping strategies
4. Resources explored - Any resources, hotlines, supports mentioned or requested
5. Risk indicators - Look for crisis keywords, pattern changes, or distress markers
6. Engagement signals - Ratio of user/AI words, frequency of optional disclosures

IMPORTANT PRIVACY CONSIDERATIONS:
- Do NOT attempt to diagnose
- Do NOT create psychological profiles
- Do NOT extract demographic information
- Do NOT highlight vulnerabilities without matching strengths
- Focus only on explicit content (don't "read between the lines")
- Only include insights with reasonable confidence

CRITICAL: All insights must use second-person perspective with "You" instead of "User" (e.g., "You mentioned feeling stressed" NOT "User mentioned feeling stressed" or "User is exploring").

Format your response as a JSON array with these fields for each insight:
- type: One of ["strength", "goal", "coping", "resource", "risk", "engagement"]
- content: The specific insight in neutral, validating language using direct second-person ("You") address
- source: Brief reference to where this was found (e.g., "mentioned at start of conversation")
- confidence: Your confidence in this insight (0.1-1.0)`;
}

function getDefaultUserPrompt(): string {
  return `Here is the conversation to analyze. Focus only on the most clear and evidence-based insights that directly empower the user.

REMEMBER: Always use direct second-person address in your insights (e.g., "You expressed interest in" rather than "User is interested in").`;
}