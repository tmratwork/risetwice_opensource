import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API endpoint for fetching profile prompts (analysis and merge)
 * This endpoint follows the pattern of other prompt endpoints in the system
 */
export async function GET(request: NextRequest) {
  // Define these at the function scope level to share with the catch block
  let requestUserId: string | null = null;
  let requestPromptType: 'analysis' | 'merge' | undefined = undefined;
  let requestPromptPart: 'system' | 'user' | undefined = undefined;
  let isGlobal = false;
  let requestCategories: string[] = [];

  try {
    const url = new URL(request.url);
    requestUserId = url.searchParams.get('userId');
    requestPromptType = url.searchParams.get('promptType') as 'analysis' | 'merge' | undefined;
    requestPromptPart = url.searchParams.get('promptPart') as 'system' | 'user' | undefined;
    isGlobal = url.searchParams.get('global') === 'true';

    console.log('[API] Fetching profile prompts with:', {
      userId: requestUserId,
      promptType: requestPromptType,
      promptPart: requestPromptPart,
      global: isGlobal,
      timestamp: new Date().toISOString()
    });

    if (!requestUserId && !isGlobal) {
      return NextResponse.json({
        error: 'Either userId or global=true must be specified'
      }, { status: 400 });
    }

    // Map promptType and promptPart to database category
    if (requestPromptType && requestPromptPart) {
      // Single specific prompt (e.g., analysis + system -> profile_analysis_system)
      const category = `profile_${requestPromptType}_${requestPromptPart}`;
      requestCategories = [category];
    } else if (requestPromptType) {
      // Check if promptType already contains the part (e.g., "analysis_system")
      if (requestPromptType.includes('_')) {
        // Single specific prompt (e.g., analysis_system -> profile_analysis_system)
        requestCategories = [`profile_${requestPromptType}`];
      } else {
        // Both system and user for a type (e.g., analysis -> profile_analysis_system, profile_analysis_user)
        requestCategories = [`profile_${requestPromptType}_system`, `profile_${requestPromptType}_user`];
      }
    } else if (requestPromptPart) {
      // System or user for both types
      requestCategories = [`profile_analysis_${requestPromptPart}`, `profile_merge_${requestPromptPart}`];
    } else {
      // All profile prompts
      requestCategories = [
        'profile_analysis_system',
        'profile_analysis_user',
        'profile_merge_system',
        'profile_merge_user'
      ];
    }

    console.log('[API] Profile prompts mapped to categories:', {
      requestedType: requestPromptType,
      requestedPart: requestPromptPart,
      resultingCategories: requestCategories,
      timestamp: new Date().toISOString(),
      note: 'Categories likely need to be allowed in database constraint'
    });

    // Prepare data structure for response - SIMPLIFIED
    const responseData: {
      analysisSystemPrompt?: string;
      analysisSystemSource?: 'user' | 'global' | 'default';
      analysisUserPrompt?: string;
      analysisUserSource?: 'user' | 'global' | 'default';
      mergeSystemPrompt?: string;
      mergeSystemSource?: 'user' | 'global' | 'default';
      mergeUserPrompt?: string;
      mergeUserSource?: 'user' | 'global' | 'default';
    } = {};

    // Fetch each category of prompt - SIMPLIFIED: just get the newest prompt for each category
    for (const category of requestCategories) {
      console.log(`[API] Fetching newest prompt for category: ${category}`);

      // Simply fetch the newest prompt for this category, regardless of global status
      await fetchNewestPrompt(category, responseData);
    }

    // Return the response
    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    const debugId = Date.now().toString().slice(-6);
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[API-PROFILE-PROMPTS:${debugId}] ERROR in profile-prompts endpoint:`, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500) // Limit stack trace size
      } : String(error),
      timestamp: new Date().toISOString(),
      userId: requestUserId,
      promptType: requestPromptType,
      promptPart: requestPromptPart,
      global: isGlobal,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });

    // Special handling for common database errors
    if (errorMessage.includes('violates check constraint')) {
      console.error(`[API-PROFILE-PROMPTS:${debugId}] DATABASE CONSTRAINT VIOLATION:`, {
        errorMessage,
        categories: ['profile_analysis_system', 'profile_analysis_user', 'profile_merge_system', 'profile_merge_user'],
        allowedCategories: ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation'],
        timestamp: new Date().toISOString(),
        recommendation: "Database schema update required to support profile prompt categories",
        detailedNote: "The current database has a check constraint that prevents adding categories that don't match the allowed list."
      });

      return NextResponse.json({
        error: 'Database constraint violation',
        details: 'Profile prompt categories are not supported in the current database schema',
        categories: ['profile_analysis_system', 'profile_analysis_user', 'profile_merge_system', 'profile_merge_user'],
        allowedCategories: ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation'],
        debugId
      }, { status: 400 });
    }

    if (errorMessage.includes('invalid input syntax for type uuid')) {
      console.error(`[API-PROFILE-PROMPTS:${debugId}] UUID FORMAT ERROR:`, {
        errorMessage,
        userId: typeof requestUserId === 'string' ? `${requestUserId.substring(0, 10)}...` : requestUserId,
        timestamp: new Date().toISOString(),
        recommendation: "Check UUID format - must be a valid UUID string"
      });

      return NextResponse.json({
        error: 'Invalid UUID format',
        details: 'One of the provided IDs is not in a valid UUID format',
        debugId
      }, { status: 400 });
    }

    return NextResponse.json({
      error: 'Failed to fetch profile prompts',
      details: errorMessage,
      debugId
    }, { status: 500 });
  }
}

/**
 * SIMPLIFIED: Fetch the newest prompt for a category regardless of who created it or global status
 */
async function fetchNewestPrompt(
  category: string,
  responseData: Record<string, unknown>
): Promise<void> {
  console.log(`[API] Fetching newest prompt for category: ${category}`);

  const response = await supabase
    .from('prompts')
    .select(`
      id,
      category,
      is_global,
      created_by,
      created_at,
      prompt_versions:prompt_versions(
        id,
        content,
        version_number,
        created_at
      )
    `)
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (response.error) {
    console.error(`[API] Error fetching prompts for ${category}:`, response.error);
    return;
  }

  console.log(`[API] Query result for ${category}:`, {
    found: response.data?.length || 0,
    data: response.data?.map(p => ({
      id: p.id,
      is_global: p.is_global,
      created_by: p.created_by,
      created_at: p.created_at,
      versions_count: p.prompt_versions?.length || 0
    }))
  });

  if (response.data && response.data.length > 0) {
    const prompt = response.data[0];
    const versions = prompt.prompt_versions as Array<{
      id: string;
      content: string;
      version_number: string;
      created_at: string;
    }>;

    if (versions && versions.length > 0) {
      // Get the latest version
      const latestVersion = versions.sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0];

      const content = latestVersion.content;
      const source = prompt.is_global ? 'global' : 'user';

      // Assign to response fields
      assignPromptToResponse(responseData, category, content, source);

      console.log(`[API] Successfully assigned newest prompt for ${category}, source: ${source}`);
    }
  } else {
    console.log(`[API] No prompts found for category: ${category}`);
  }
}

/**
 * Helper function to assign a prompt to the right field in the response object
 */
function assignPromptToResponse(
  response: Record<string, unknown>,
  category: string,
  content: string,
  source: 'user' | 'global' | 'default'
): void {
  if (category === 'profile_analysis_system') {
    response.analysisSystemPrompt = content;
    response.analysisSystemSource = source;
  } else if (category === 'profile_analysis_user') {
    response.analysisUserPrompt = content;
    response.analysisUserSource = source;
  } else if (category === 'profile_merge_system') {
    response.mergeSystemPrompt = content;
    response.mergeSystemSource = source;
  } else if (category === 'profile_merge_user') {
    response.mergeUserPrompt = content;
    response.mergeUserSource = source;
  }
}


/**
 * Helper function to get default prompts by category
 */
