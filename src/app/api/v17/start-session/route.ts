// src/app/api/v17/start-session/route.ts  
// V17 Eleven Labs Session Management - Adapted from V16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { logTriageHandoffServer, generateHandoffCorrelationId, logUserMemoryServer } from '@/utils/server-logger';
import { enhanceSpecialistPromptWithMemory } from '../utils/memory-prompt';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const handoffCorrelationId = generateHandoffCorrelationId();
  
  try {
    const body = await request.json();
    const { userId, specialistType, conversationId, contextSummary, agentId } = body;

    logV17('🚀 V17 start-session request', {
      userId: userId || 'anonymous',
      specialistType,
      conversationId,
      agentId,
      hasContextSummary: !!contextSummary
    });

    logTriageHandoffServer({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      category: 'HANDOFF',
      operation: 'v17-step-4-start-specialist-session',
      correlationId: handoffCorrelationId,
      userId: userId || 'anonymous',
      conversationId,
      specialistType,
      data: {
        version: 'V17',
        provider: 'eleven-labs',
        agentId,
        receivedContextSummary: contextSummary ? contextSummary.substring(0, 100) + '...' : null,
        contextLength: contextSummary?.length || 0
      }
    });

    if (!specialistType) {
      logV17('❌ Missing specialist type');
      return NextResponse.json(
        { error: 'Specialist type is required' },
        { status: 400 }
      );
    }

    if (!agentId) {
      logV17('❌ Missing agent ID for Eleven Labs');
      return NextResponse.json(
        { error: 'Agent ID is required for Eleven Labs session' },
        { status: 400 }
      );
    }

    // Retrieve actual context from database if conversation exists and contextSummary is generic
    let actualContextSummary = contextSummary;
    if (conversationId && (!contextSummary || contextSummary.includes('Resuming conversation from'))) {
      logV17('🔍 Retrieving actual context summary from database');
      
      const { data: contextDataArray, error: contextError } = await supabaseAdmin
        .rpc('get_latest_context_summary_for_conversation', {
          target_conversation_id: conversationId
        });
        
      const contextData = contextDataArray?.[0];

      if (!contextError && contextData?.routing_metadata?.context_summary) {
        actualContextSummary = contextData.routing_metadata.context_summary;
        logV17('✅ Retrieved actual context summary', {
          length: actualContextSummary.length,
          preview: actualContextSummary.substring(0, 100) + '...'
        });
      }
    }

    // Update conversation specialist tracking if conversationId provided
    if (conversationId) {
      logV17('🔄 Updating conversation specialist tracking');
      
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          current_specialist: specialistType,
          specialist_history: supabase.rpc('array_append', {
            arr: 'specialist_history',
            elem: {
              specialist: specialistType,
              started_at: new Date().toISOString(),
              context_summary: actualContextSummary || null,
              version: 'V17',
              provider: 'eleven-labs'
            }
          }),
          metadata: supabase.rpc('jsonb_set', {
            target: 'metadata',
            path: '{version}',
            new_value: '"V17"'
          })
        })
        .eq('id', conversationId);

      if (updateError) {
        logV17('❌ Failed to update conversation specialist tracking', updateError);
        return NextResponse.json(
          { error: `Failed to update conversation: ${updateError.message}` },
          { status: 500 }
        );
      }
      
      logV17('✅ Conversation specialist tracking updated');
    }

    // Load the specialist prompt from database
    logV17('📖 Loading specialist prompt from database');
    
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('prompt_type', specialistType)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) {
      logV17('❌ Failed to load specialist prompt', {
        specialistType,
        error: promptError?.message || 'Prompt not found'
      });
      return NextResponse.json(
        { error: `Failed to load specialist prompt: ${promptError?.message || 'Prompt not found'}` },
        { status: 500 }
      );
    }

    logV17('✅ Specialist prompt loaded', {
      promptId: promptData.id,
      promptLength: promptData.prompt_content?.length || 0,
      hasVoiceSettings: !!promptData.voice_settings
    });

    // Enhance specialist prompt with context summary and session reset
    let enhancedPromptContent = promptData.prompt_content;
    if (actualContextSummary && actualContextSummary.trim() && !actualContextSummary.includes('Resuming conversation from')) {
      const sessionResetInstruction = `\n\n=== NEW V17 SPECIALIST SESSION (ELEVEN LABS) ===\nYou are now the ${specialistType} specialist taking over from the triage AI. This is a fresh start for you - introduce yourself as the specialist and acknowledge the handoff.`;
      const contextInstruction = `\n\nIMPORTANT CONTEXT FROM TRIAGE AI:\n${actualContextSummary}\n\nBased on this context, provide focused and relevant support for the user's specific needs. Reference their situation naturally in your responses.`;
      enhancedPromptContent = promptData.prompt_content + sessionResetInstruction + contextInstruction;
      
      logV17('📝 Enhanced prompt with context', {
        originalLength: promptData.prompt_content?.length || 0,
        enhancedLength: enhancedPromptContent.length,
        contextLength: actualContextSummary.length
      });
    }

    // Add user memory context if userId is provided and not anonymous
    if (userId && userId !== 'anonymous') {
      logV17('🧠 Fetching user memory for prompt enhancement');
      
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('ai_instructions_summary, version, last_analyzed_timestamp, updated_at')
          .eq('user_id', userId)
          .single();

        if (!profileError && userProfile?.ai_instructions_summary) {
          const aiSummary = userProfile.ai_instructions_summary;
          
          logV17('✅ User memory found, enhancing prompt', {
            summaryLength: aiSummary.length,
            profileVersion: userProfile.version
          });
          
          // Enhance the specialist prompt with user memory context
          enhancedPromptContent = enhanceSpecialistPromptWithMemory(enhancedPromptContent, aiSummary);

          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'v17-specialist-prompt-enhanced-with-memory',
            userId,
            conversationId,
            specialistType,
            data: {
              version: 'V17',
              provider: 'eleven-labs',
              originalPromptLength: promptData.prompt_content?.length || 0,
              memoryAddedLength: aiSummary.length,
              finalPromptLength: enhancedPromptContent.length
            }
          });
        } else {
          logV17('ℹ️ No user memory found or profile error', {
            error: profileError?.message
          });
        }
      } catch (memoryError) {
        logV17('⚠️ Error fetching user memory, continuing without enhancement', memoryError);
      }
    }

    logV17('✅ V17 session configured successfully', {
      specialistType,
      conversationId,
      agentId,
      promptLength: enhancedPromptContent?.length || 0,
      hasVoiceSettings: !!promptData.voice_settings
    });

    // Return V17-specific session configuration for Eleven Labs
    return NextResponse.json({
      success: true,
      version: 'V17',
      provider: 'eleven-labs',
      session: {
        specialistType,
        conversationId,
        agentId,
        prompt: {
          id: promptData.id,
          type: promptData.prompt_type,
          content: enhancedPromptContent,
          voice_settings: promptData.voice_settings,
          metadata: {
            ...promptData.metadata,
            version: 'V17',
            provider: 'eleven-labs'
          }
        },
        contextSummary: actualContextSummary
      }
    });

  } catch (error) {
    logV17('❌ Unexpected error in V17 start-session', error);
    console.error('[V17] start-session error:', error);
    return NextResponse.json(
      { error: 'Internal server error starting V17 session' },
      { status: 500 }
    );
  }
}