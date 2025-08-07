import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logTriageEvent, generateCorrelationId } from '@/utils/triage-logger';
import { logTriageHandoffServer, generateHandoffCorrelationId, logUserMemoryServer } from '@/utils/server-logger';
import { enhanceSpecialistPromptWithMemory } from '../utils/memory-prompt';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const correlationId = generateCorrelationId();
  const handoffCorrelationId = generateHandoffCorrelationId();
  
  try {
    const body = await request.json();
    const { userId, specialistType, conversationId, contextSummary } = body;

    logTriageHandoffServer({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'HANDOFF',
      operation: 'step-4-start-specialist-session',
      correlationId: handoffCorrelationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        receivedContextSummary: contextSummary ? contextSummary.substring(0, 100) + '...' : null,
        contextLength: contextSummary?.length || 0
      }
    });

    logTriageEvent({
      level: 'INFO',
      category: 'API',
      operation: 'start-session-request',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        hasContextSummary: !!contextSummary,
        contextLength: contextSummary?.length || 0
      }
    });

    // console.log(`[triage][api] 📡 API: start-session request received`, {
    //   userId: userId || 'anonymous',
    //   specialistType,
    //   conversationId,
    //   hasContextSummary: !!contextSummary,
    //   contextLength: contextSummary?.length || 0,
    //   timestamp: new Date().toISOString(),
    //   correlationId
    // });
    
    // console.log(`[triage][session] Starting session for AI specialist: ${specialistType}, user: ${userId || 'anonymous'}, conversation: ${conversationId || 'new'}`);

    if (!specialistType) {
      logTriageEvent({
        level: 'ERROR',
        category: 'API',
        operation: 'start-session-validation-failed',
        correlationId,
        userId: userId || 'anonymous',
        conversationId,
        error: 'Missing specialist type'
      });
      // console.error(`[triage][api] ❌ API: start-session - missing specialist type`);
      return NextResponse.json(
        { error: 'Specialist type is required' },
        { status: 400 }
      );
    }

    // Retrieve actual context from database if conversation exists and contextSummary is generic
    let actualContextSummary = contextSummary;
    if (conversationId && (!contextSummary || contextSummary.includes('Resuming conversation from'))) {
      logTriageHandoffServer({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        category: 'HANDOFF',
        operation: 'retrieve-actual-context-summary',
        correlationId: handoffCorrelationId,
        userId: userId || 'anonymous',
        conversationId,
        specialistType,
        data: { 
          hasGenericContext: contextSummary?.includes('Resuming conversation from') || false,
          missingContext: !contextSummary
        }
      });

      // Get the most recent context_summary using specialized RPC function
      const { data: contextDataArray, error: contextError } = await supabaseAdmin
        .rpc('get_latest_context_summary_for_conversation', {
          target_conversation_id: conversationId
        });
        
      const contextData = contextDataArray?.[0];

      if (!contextError && contextData?.routing_metadata?.context_summary) {
        actualContextSummary = contextData.routing_metadata.context_summary;
        logTriageHandoffServer({
          timestamp: new Date().toISOString(),
          level: 'INFO',
          category: 'HANDOFF',
          operation: 'actual-context-retrieved',
          correlationId: handoffCorrelationId,
          userId: userId || 'anonymous',
          conversationId,
          specialistType,
          data: {
            retrievedContextLength: actualContextSummary.length,
            retrievedContextPreview: actualContextSummary.substring(0, 100) + '...'
          }
        });
        // console.log(`[triageAI][handoff] ✅ Retrieved actual context summary: ${actualContextSummary.substring(0, 100)}...`);
      } else {
        logTriageHandoffServer({
          timestamp: new Date().toISOString(),
          level: 'WARN',
          category: 'HANDOFF',
          operation: 'context-retrieval-failed',
          correlationId: handoffCorrelationId,
          userId: userId || 'anonymous',
          conversationId,
          specialistType,
          error: contextError?.message || 'No context found'
        });
        // console.log(`[triageAI][handoff] ⚠️ Could not retrieve context: ${contextError?.message || 'No context found'}`);
      }
    }

    // If conversationId is provided, update the specialist tracking
    if (conversationId) {
      logTriageEvent({
        level: 'INFO',
        category: 'DATABASE',
        operation: 'update-conversation-specialist',
        correlationId,
        userId: userId || 'anonymous',
        conversationId,
        specialistType,
        data: { hasContext: !!contextSummary }
      });

      // console.log(`[triage][api] 🔄 API: Updating conversation specialist tracking`, {
      //   conversationId,
      //   newSpecialist: specialistType,
      //   hasContext: !!contextSummary
      // });
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          current_specialist: specialistType,
          specialist_history: supabase.rpc('array_append', {
            arr: 'specialist_history',
            elem: {
              specialist: specialistType,
              started_at: new Date().toISOString(),
              context_summary: actualContextSummary || null
            }
          })
        })
        .eq('id', conversationId);

      if (updateError) {
        logTriageEvent({
          level: 'ERROR',
          category: 'DATABASE',
          operation: 'update-conversation-specialist-failed',
          correlationId,
          userId: userId || 'anonymous',
          conversationId,
          specialistType,
          error: `${updateError.message} (${updateError.code})`
        });
        // console.error('[triage][api] ❌ API: Error updating conversation specialist tracking', {
        //   conversationId,
        //   specialistType,
        //   error: updateError.message,
        //   code: updateError.code
        // });
        return NextResponse.json(
          { error: `Failed to update conversation: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      logTriageEvent({
        level: 'INFO',
        category: 'DATABASE',
        operation: 'update-conversation-specialist-success',
        correlationId,
        userId: userId || 'anonymous',
        conversationId,
        specialistType
      });
      // console.log(`[triage][api] ✅ API: Conversation specialist tracking updated successfully`);
    }

    logTriageEvent({
      level: 'INFO',
      category: 'PROMPT',
      operation: 'load-specialist-prompt',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType
    });

    // First check how many rows exist for this specialist type
    const { data: countData, error: countError } = await supabase
      .from('ai_prompts')
      .select('id, prompt_type, is_active')
      .eq('prompt_type', specialistType);
    
    logTriageEvent({
      level: 'INFO',
      category: 'DATABASE',
      operation: 'specialist-prompt-count',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        totalRows: countData?.length || 0,
        allRowsCount: countData?.length || 0,
        countError: countError?.message || null
      }
    });
    
    // Also check all active prompts to see what's available
    const { data: allActiveData } = await supabase
      .from('ai_prompts')
      .select('id, prompt_type, is_active')
      .eq('is_active', true);
    
    logTriageEvent({
      level: 'INFO',
      category: 'DATABASE',
      operation: 'all-active-prompts',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        totalActivePrompts: allActiveData?.length || 0,
        availableTypes: allActiveData?.length || 0
      }
    });
    
    // Load the specialist prompt
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_type', specialistType)
      .eq('is_active', true)
      .single();
    
    logTriageEvent({
      level: 'INFO',
      category: 'DATABASE',
      operation: 'query-result-details',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        querySuccess: !promptError,
        dataExists: !!promptData,
        errorMessage: promptError?.message || null,
        errorCode: promptError?.code || null,
        errorDetails: promptError?.details || null
      }
    });

    if (promptError || !promptData) {
      logTriageEvent({
        level: 'ERROR',
        category: 'PROMPT',
        operation: 'load-specialist-prompt-failed',
        correlationId,
        userId: userId || 'anonymous',
        conversationId,
        specialistType,
        error: promptError?.message || 'Prompt not found'
      });
      // console.error(`[triage][api] ❌ API: Failed to load specialist prompt`, {
      //   specialistType,
      //   error: promptError?.message || 'Prompt not found',
      //   code: promptError?.code
      // });
      return NextResponse.json(
        { error: `Failed to load specialist prompt: ${promptError?.message || 'Prompt not found'}` },
        { status: 500 }
      );
    }

    logTriageEvent({
      level: 'INFO',
      category: 'PROMPT',
      operation: 'load-specialist-prompt-success',
      correlationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        promptId: promptData.id,
        promptLength: promptData.prompt_content?.length || 0,
        hasVoiceSettings: !!promptData.voice_settings
      }
    });

    // Enhance specialist prompt with context summary and session reset
    let enhancedPromptContent = promptData.prompt_content;
    if (actualContextSummary && actualContextSummary.trim() && !actualContextSummary.includes('Resuming conversation from')) {
      const sessionResetInstruction = `\n\n=== NEW SPECIALIST SESSION ===\nYou are now the ${specialistType} specialist taking over from the triage AI. This is a fresh start for you - introduce yourself as the specialist and acknowledge the handoff.`;
      const contextInstruction = `\n\nIMPORTANT CONTEXT FROM TRIAGE AI:\n${actualContextSummary}\n\nBased on this context, provide focused and relevant support for the user's specific needs. Reference their situation naturally in your responses.`;
      enhancedPromptContent = promptData.prompt_content + sessionResetInstruction + contextInstruction;
      
      logTriageHandoffServer({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        category: 'HANDOFF',
        operation: 'context-added-to-prompt',
        correlationId: handoffCorrelationId,
        userId: userId || 'anonymous',
        conversationId,
        specialistType,
        data: {
          originalPromptLength: promptData.prompt_content?.length || 0,
          enhancedPromptLength: enhancedPromptContent.length,
          contextLength: actualContextSummary.length,
          sessionResetAdded: true
        }
      });
      // console.log(`[triageAI][handoff] ✅ Enhanced specialist prompt with context (${actualContextSummary.length} chars)`);
    }

    // V16: Add user memory context if userId is provided and not anonymous
    if (userId && userId !== 'anonymous') {
      // Helper function for user memory logging
      const logUserMemory = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS === 'true') {
          console.log(`[user_memory] ${message}`, ...args);
        }
      };

      logUserMemory('V16 start-session: Attempting to fetch user AI instructions summary', {
        userId,
        specialistType,
        conversationId,
        source: 'start-session-api'
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
            logUserMemory('V16 start-session: No user profile found', {
              userId,
              specialistType,
              conversationId
            });
            
            // File logging for server-side
            logUserMemoryServer({
              level: 'INFO',
              category: 'PROFILE_FETCH',
              operation: 'no-profile-found-specialist',
              userId,
              conversationId,
              specialistType,
              data: { reason: 'PGRST116' }
            });
          } else {
            logUserMemory('V16 start-session: Error fetching user profile', {
              error: profileError.message,
              errorCode: profileError.code,
              userId,
              specialistType,
              conversationId
            });
            
            // File logging for server-side
            logUserMemoryServer({
              level: 'ERROR',
              category: 'PROFILE_FETCH',
              operation: 'profile-fetch-error-specialist',
              userId,
              conversationId,
              specialistType,
              error: profileError.message,
              data: { 
                errorCode: profileError.code,
                errorDetails: profileError.details 
              }
            });
          }
        } else if (userProfile?.ai_instructions_summary) {
          const aiSummary = userProfile.ai_instructions_summary;
          
          logUserMemory('V16 start-session: User AI summary found, enhancing specialist prompt', {
            userId,
            specialistType,
            conversationId,
            summaryLength: aiSummary.length,
            profileVersion: userProfile.version,
            lastUpdated: userProfile.updated_at,
            summaryPreview: aiSummary.substring(0, 200) + '...'
          });
          
          // File logging for server-side
          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'ai-summary-loaded-specialist',
            userId,
            conversationId,
            specialistType,
            data: {
              summaryLength: aiSummary.length,
              profileVersion: userProfile.version,
              lastUpdated: userProfile.updated_at,
              summaryPreview: aiSummary.substring(0, 100) + '...'
            }
          });

          // Enhance the specialist prompt with user memory context
          enhancedPromptContent = enhanceSpecialistPromptWithMemory(enhancedPromptContent, aiSummary);

          logTriageEvent({
            level: 'INFO',
            category: 'DATABASE',
            operation: 'user-memory-added-to-specialist',
            correlationId,
            userId,
            conversationId,
            specialistType,
            data: {
              memoryAddedLength: aiSummary.length,
              finalPromptLength: enhancedPromptContent.length
            }
          });
          
          logUserMemory('V16 start-session: Successfully enhanced specialist prompt with user memory', {
            userId,
            specialistType,
            conversationId,
            originalPromptLength: promptData.prompt_content?.length || 0,
            memoryAddedLength: aiSummary.length,
            finalPromptLength: enhancedPromptContent.length
          });

          // Log the FULL enhanced prompt when memory logging is enabled
          logUserMemory('V16 start-session: FULL ENHANCED PROMPT WITH USER MEMORY:', {
            userId,
            specialistType,
            conversationId,
            fullEnhancedPrompt: enhancedPromptContent
          });
          
          // File logging for successful enhancement
          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'specialist-prompt-enhanced-with-memory',
            userId,
            conversationId,
            specialistType,
            data: {
              originalPromptLength: promptData.prompt_content?.length || 0,
              memoryAddedLength: aiSummary.length,
              finalPromptLength: enhancedPromptContent.length,
              enhancementRatio: ((enhancedPromptContent.length - (promptData.prompt_content?.length || 0)) / (promptData.prompt_content?.length || 1)).toFixed(2)
            }
          });
        } else {
          logUserMemory('V16 start-session: No AI instructions summary found in user profile', {
            userId,
            specialistType,
            conversationId,
            profileExists: true,
            summaryExists: false
          });
          
          // File logging for missing summary
          logUserMemoryServer({
            level: 'INFO',
            category: 'PROFILE_FETCH',
            operation: 'no-ai-summary-in-profile-specialist',
            userId,
            conversationId,
            specialistType,
            data: { 
              profileExists: true,
              summaryExists: false 
            }
          });
        }
      } catch (memoryError) {
        logUserMemory('V16 start-session: Unexpected error fetching user memory', {
          error: (memoryError as Error).message,
          userId,
          specialistType,
          conversationId
        });
        
        // File logging for unexpected error
        logUserMemoryServer({
          level: 'ERROR',
          category: 'MEMORY_ENHANCEMENT',
          operation: 'unexpected-memory-fetch-error-specialist',
          userId,
          conversationId,
          specialistType,
          error: (memoryError as Error).message,
          data: {
            errorStack: (memoryError as Error).stack
          }
        });
        // Continue without memory enhancement - not a breaking error
      }
    }

    // console.log(`[triage][api] ✅ API: Successfully started session for ${specialistType}`, {
    //   promptId: promptData.id,
    //   promptLength: enhancedPromptContent?.length || 0,
    //   conversationId,
    //   userId: userId || 'anonymous',
    //   hasVoiceSettings: !!promptData.voice_settings,
    //   hasContextSummary: !!actualContextSummary,
    //   correlationId
    // });

    logTriageHandoffServer({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'HANDOFF',
      operation: 'step-4-specialist-session-configured',
      correlationId: handoffCorrelationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        promptConfigured: true,
        contextIncluded: !!actualContextSummary,
        promptLength: enhancedPromptContent?.length || 0
      }
    });

    return NextResponse.json({
      success: true,
      session: {
        specialistType,
        conversationId,
        prompt: {
          id: promptData.id,
          type: promptData.prompt_type,
          content: enhancedPromptContent,
          voice_settings: promptData.voice_settings,
          metadata: promptData.metadata
        },
        contextSummary: actualContextSummary
      }
    });

  } catch (error) {
    logTriageEvent({
      level: 'ERROR',
      category: 'API',
      operation: 'start-session-unexpected-error',
      correlationId,
      error: (error as Error).message
    });
    // console.error('[triage][api] ❌ API: Unexpected error in start-session', {
    //   error: (error as Error).message,
    //   stack: (error as Error).stack,
    //   correlationId
    // });
    return NextResponse.json(
      { error: 'Internal server error starting session' },
      { status: 500 }
    );
  }
}