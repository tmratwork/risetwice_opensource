import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logTriageHandoffServer, logUserMemoryServer } from '@/utils/server-logger';
import { enhancePromptWithMemory } from '../utils/memory-prompt';
import { enhancePromptWithLanguage, getLanguagePreferenceFromRequest } from '../utils/language-prompt';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promptType = searchParams.get('type');
    const userId = searchParams.get('userId');
    const languagePreference = getLanguagePreferenceFromRequest(searchParams);

    // Add comprehensive triage handoff logging
    const logTriageHandoff = (message: string, ...args: unknown[]) => {
      if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
        console.log(`[triage_handoff] ${message}`, ...args);
      }
    };

    logTriageHandoff('API: load-prompt request received', {
      promptType,
      userId: userId || 'anonymous',
      url: request.url,
      timestamp: new Date().toISOString(),
      source: 'api-load-prompt'
    });

    // Also log to file
    logTriageHandoffServer({
      level: 'INFO',
      category: 'API_REQUEST',
      operation: 'load-prompt-request',
      data: { promptType, url: request.url }
    });

    if (!promptType) {
      logTriageHandoff('❌ API: load-prompt - missing prompt type parameter');
      return NextResponse.json(
        { error: 'Prompt type is required' },
        { status: 400 }
      );
    }

    // console.log(`[triage][api] 🔍 API: Querying Supabase for prompt type: ${promptType}`);

    // Load AI prompt from Supabase ai_prompts table
    logTriageHandoff('API: Querying Supabase for prompt', {
      promptType,
      table: 'ai_prompts',
      source: 'api-load-prompt-db-query'
    });

    // Also log to file
    logTriageHandoffServer({
      level: 'INFO',
      category: 'DATABASE_QUERY',
      operation: 'query-ai-prompts',
      data: { promptType, table: 'ai_prompts' }
    });

    // Use RLS-compliant RPC function to get AI prompt
    const { data: promptArray, error } = await supabaseAdmin
      .rpc('get_ai_prompt_by_type', {
        target_prompt_type: promptType,
        requesting_user_id: userId
      });
    
    const data = promptArray?.[0] || null;

    if (error) {
      logTriageHandoff('❌ API: Database error loading prompt', {
        promptType,
        error: error.message,
        code: error.code,
        details: error.details
      });
      return NextResponse.json(
        { error: `Failed to load AI prompt: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      logTriageHandoff('❌ API: No active prompt found', {
        promptType,
        source: 'api-load-prompt-no-data'
      });
      return NextResponse.json(
        { error: `No active prompt found for type: ${promptType}` },
        { status: 404 }
      );
    }

    logTriageHandoff('✅ API: Successfully loaded prompt from database', {
      promptType,
      promptId: data.id,
      contentLength: data.prompt_content?.length || 0,
      contentPreview: data.prompt_content?.substring(0, 200) || 'EMPTY',
      hasVoiceSettings: !!data.voice_settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      source: 'api-load-prompt-success'
    });

    // Log FULL AI prompt content to understand why transition is failing
    logTriageHandoff('🔍 FULL AI PROMPT CONTENT FROM DATABASE:', {
      promptType,
      promptId: data.id,
      fullContent: data.prompt_content || 'EMPTY',
      source: 'api-load-prompt-full-content'
    });

    // Also log to file
    logTriageHandoffServer({
      level: 'INFO',
      category: 'DATABASE_SUCCESS',
      operation: 'prompt-loaded-successfully',
      data: {
        promptType,
        promptId: data.id,
        contentLength: data.prompt_content?.length || 0,
        contentPreview: data.prompt_content?.substring(0, 200) || 'EMPTY',
        hasVoiceSettings: !!data.voice_settings,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    });

    // console.log(`[triage][api] ✅ API: Successfully loaded prompt for ${promptType}`, {
    //   promptId: data.id,
    //     contentLength: data.prompt_content?.length || 0,
    //       hasVoiceSettings: !!data.voice_settings,
    //         hasMetadata: !!data.metadata,
    //           createdAt: data.created_at,
    //             updatedAt: data.updated_at
    // });

    // console.log(`[triage] Successfully loaded prompt for AI type: ${promptType}, ID: ${data.id}, content length: ${data.prompt_content?.length || 0}`);

    // Auto-merge with universal protocols based on database setting
    let finalContent = data.prompt_content;
    const mergeEnabled = data.merge_with_universal_protocols ?? true;
    const shouldMerge = promptType !== 'universal' && mergeEnabled;

    if (shouldMerge) {
      // console.log(`[triage][api] 🔄 API: Attempting to merge with universal protocols for ${promptType}`);

      // Load universal protocols
      const { data: universalData, error: universalError } = await supabase
        .from('ai_prompts')
        .select('prompt_content')
        .eq('prompt_type', 'universal')
        .eq('is_active', true)
        .single();

      if (universalError) {
        // console.warn(`[triage][api] ⚠️ API: Could not load universal protocols for merging`, {
        //   error: universalError.message,
        //     code: universalError.code
        // });
        // Continue without merging - not a breaking error
      } else if (universalData?.prompt_content) {
        finalContent = `${data.prompt_content}\n\n--- UNIVERSAL SPECIALIST PROTOCOLS ---\n\n${universalData.prompt_content}`;
        // console.log(`[triage][api] ✅ API: Successfully merged with universal protocols`, {
        //   originalLength: data.prompt_content?.length || 0,
        //     universalLength: universalData.prompt_content?.length || 0,
        //       finalLength: finalContent.length
        // });
      } else {
        // console.log(`[triage][api] 📭 API: No universal protocols found for merging`);
      }
    }

    // V16: Add user memory context if userId is provided and not anonymous
    if (userId && userId !== 'anonymous') {
      // Helper function for user memory logging
      const logUserMemory = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS === 'true') {
          console.log(`[user_memory] ${message}`, ...args);
        }
      };

      logUserMemory('V16 load-prompt: Attempting to fetch user AI instructions summary', {
        userId,
        promptType,
        source: 'load-prompt-api'
      });

      try {
        // Fetch user's AI instructions summary from user_profiles
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('ai_instructions_summary, version, last_analyzed_timestamp, updated_at')
          .eq('user_id', userId)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') { // No rows found
            logUserMemory('V16 load-prompt: No user profile found', {
              userId,
              promptType
            });

            // File logging for server-side
            logUserMemoryServer({
              level: 'INFO',
              category: 'PROFILE_FETCH',
              operation: 'no-profile-found',
              userId,
              data: { promptType, reason: 'PGRST116' }
            });
          } else {
            logUserMemory('V16 load-prompt: Error fetching user profile', {
              error: profileError.message,
              errorCode: profileError.code,
              userId,
              promptType
            });

            // File logging for server-side
            logUserMemoryServer({
              level: 'ERROR',
              category: 'PROFILE_FETCH',
              operation: 'profile-fetch-error',
              userId,
              error: profileError.message,
              data: {
                promptType,
                errorCode: profileError.code,
                errorDetails: profileError.details
              }
            });
          }
        } else if (userProfile?.ai_instructions_summary) {
          const aiSummary = userProfile.ai_instructions_summary;

          logUserMemory('V16 load-prompt: User AI summary found, enhancing prompt', {
            userId,
            promptType,
            summaryLength: aiSummary.length,
            profileVersion: userProfile.version,
            lastUpdated: userProfile.updated_at,
            summaryPreview: aiSummary.substring(0, 200) + '...'
          });

          // File logging for server-side
          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'ai-summary-loaded',
            userId,
            data: {
              promptType,
              summaryLength: aiSummary.length,
              profileVersion: userProfile.version,
              lastUpdated: userProfile.updated_at,
              summaryPreview: aiSummary.substring(0, 100) + '...'
            }
          });

          // Enhance the prompt with user memory context
          finalContent = enhancePromptWithMemory(finalContent, aiSummary);

          logTriageHandoff('✅ API: Enhanced prompt with user memory context', {
            promptType,
            userId,
            memoryAddedLength: aiSummary.length,
            finalContentLength: finalContent.length
          });

          logUserMemory('V16 load-prompt: Successfully enhanced prompt with user memory', {
            userId,
            promptType,
            originalPromptLength: data.prompt_content?.length || 0,
            memoryAddedLength: aiSummary.length,
            finalPromptLength: finalContent.length
          });

          // Log the FULL enhanced prompt when memory logging is enabled
          logUserMemory('V16 load-prompt: FULL ENHANCED PROMPT WITH USER MEMORY:', {
            userId,
            promptType,
            fullEnhancedPrompt: finalContent
          });

          // File logging for successful enhancement
          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'prompt-enhanced-with-memory',
            userId,
            data: {
              promptType,
              originalPromptLength: data.prompt_content?.length || 0,
              memoryAddedLength: aiSummary.length,
              finalPromptLength: finalContent.length,
              enhancementRatio: ((finalContent.length - (data.prompt_content?.length || 0)) / (data.prompt_content?.length || 1)).toFixed(2)
            }
          });
        } else {
          logUserMemory('V16 load-prompt: No AI instructions summary found in user profile', {
            userId,
            promptType,
            profileExists: true,
            summaryExists: false
          });

          // File logging for missing summary
          logUserMemoryServer({
            level: 'INFO',
            category: 'PROFILE_FETCH',
            operation: 'no-ai-summary-in-profile',
            userId,
            data: {
              promptType,
              profileExists: true,
              summaryExists: false
            }
          });
        }
      } catch (memoryError) {
        logUserMemory('V16 load-prompt: Unexpected error fetching user memory', {
          error: (memoryError as Error).message,
          userId,
          promptType
        });

        // File logging for unexpected error
        logUserMemoryServer({
          level: 'ERROR',
          category: 'MEMORY_ENHANCEMENT',
          operation: 'unexpected-memory-fetch-error',
          userId,
          error: (memoryError as Error).message,
          data: {
            promptType,
            errorStack: (memoryError as Error).stack
          }
        });
        // Continue without memory enhancement - not a breaking error
      }
    }

    // V16: Add language preference injection (applied after all other enhancements)
    // ALWAYS inject language instructions, even for English, to prevent AI language switching
    if (languagePreference) {
      const beforeLanguageLength = finalContent?.length || 0;
      finalContent = enhancePromptWithLanguage(finalContent, languagePreference);
      
      logTriageHandoff('✅ API: Enhanced prompt with language preference', {
        promptType,
        languagePreference,
        beforeLength: beforeLanguageLength,
        afterLength: finalContent.length,
        source: 'api-load-prompt-language-enhancement',
        alwaysInject: 'Language instructions now injected for ALL languages including English'
      });
    }

    logTriageHandoff('✅ API: Returning final prompt content', {
      promptType,
      userId: userId || 'anonymous',
      languagePreference,
      finalContentLength: finalContent?.length || 0,
      finalContentPreview: finalContent?.substring(0, 200) || 'EMPTY',
      wasMerged: finalContent !== data.prompt_content,
      hasUserMemory: finalContent.includes('IMPORTANT USER MEMORY CONTEXT'),
      hasLanguagePreference: finalContent.includes('Always communicate in'),
      source: 'api-load-prompt-return'
    });

    // Log FULL FINAL PROMPT CONTENT that will be sent to AI
    logTriageHandoff('🔍 FULL FINAL PROMPT CONTENT BEING RETURNED:', {
      promptType,
      finalContent: finalContent || 'EMPTY',
      source: 'api-load-prompt-final-content'
    });

    // Also log to file
    logTriageHandoffServer({
      level: 'INFO',
      category: 'API_RESPONSE',
      operation: 'returning-final-prompt',
      data: {
        promptType,
        finalContentLength: finalContent?.length || 0,
        finalContentPreview: finalContent?.substring(0, 200) || 'EMPTY',
        wasMerged: finalContent !== data.prompt_content
      }
    });

    return NextResponse.json({
      success: true,
      prompt: {
        id: data.id,
        type: data.prompt_type,
        content: finalContent,
        voice_settings: data.voice_settings,
        metadata: data.metadata
      }
    });

  } catch (error) {
    // console.error('[triage][api] ❌ API: Unexpected error in load-prompt', {
    //   error: (error as Error).message,
    //     stack: (error as Error).stack
    // });
    void error;
    return NextResponse.json(
      { error: 'Internal server error loading AI prompt' },
      { status: 500 }
    );
  }
}