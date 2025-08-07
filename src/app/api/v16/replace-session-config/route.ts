import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logTriageHandoffServer, logUserMemoryServer } from '@/utils/server-logger';
import { enhanceSpecialistPromptWithMemory } from '../utils/memory-prompt';

// Type definition for function objects from database
interface FunctionDefinition {
  name: string;
  description?: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const correlationId = `replace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Helper function for specialist handoff logging
  const logSpecialistHandoff = (message: string, data?: unknown) => {
    if (process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
      console.log(`[specialist_handoff] [API] ${message}`, data || '');
    }
  };
  
  try {
    const { specialistType, conversationId, contextSummary, userId } = await request.json();
    
    // Check if this is an inter-specialist handoff (not from triage)
    const isFromTriage = contextSummary?.includes('TRIAGE AI:') || contextSummary?.includes('triage assessment');
    const isInterSpecialistHandoff = !isFromTriage && specialistType !== 'triage';
    
    if (isInterSpecialistHandoff) {
      logSpecialistHandoff('⚠️ INTER-SPECIALIST HANDOFF DETECTED in API', {
        targetSpecialist: specialistType,
        contextPreview: contextSummary?.substring(0, 100) + '...',
        conversationId
      });
      
      // Load triage prompt for comparison
      const { data: triageData } = await supabase
        .from('ai_prompts')
        .select('prompt_content')
        .eq('prompt_type', 'triage')
        .eq('is_active', true)
        .single();
        
      if (triageData) {
        logSpecialistHandoff('===== COMPARING TRIAGE VS SPECIALIST PROMPTS =====');
        
        // Check how triage describes handoffs
        const triageLower = triageData.prompt_content.toLowerCase();
        const triageHandoffPhrases = [
          'seamless', 'unified persona', 'expertise', 'access different',
          'single ai', 'one persona', 'maintain persona'
        ];
        
        const triageFound = triageHandoffPhrases.filter(phrase => triageLower.includes(phrase));
        logSpecialistHandoff('Triage prompt unified persona phrases:', triageFound);
        
        // Extract triage handoff instructions
        const triageHandoffSection = triageData.prompt_content.match(/HANDOFF[^]*?(?=\n[A-Z]+\s+[A-Z]+:|$)/i);
        if (triageHandoffSection) {
          logSpecialistHandoff('📋 TRIAGE HANDOFF INSTRUCTIONS:', triageHandoffSection[0].substring(0, 500) + '...');
        }
      }
    }

    logTriageHandoffServer({
      level: 'INFO',
      category: 'REPLACE_CONFIG',
      operation: 'replace-session-config-start',
      correlationId,
      conversationId,
      specialistType,
      data: {
        receivedSpecialistType: specialistType,
        receivedContextSummary: contextSummary?.substring(0, 100) + '...',
        contextSummaryLength: contextSummary?.length || 0
      }
    });

    // Load specialist prompt and functions from database
    const { data: promptData, error: promptError } = await supabase
      .from('ai_prompts')
      .select('prompt_content, voice_settings, functions')
      .eq('prompt_type', specialistType)
      .eq('is_active', true)
      .single();

    if (promptError || !promptData) {
      logTriageHandoffServer({
        level: 'ERROR',
        category: 'REPLACE_CONFIG',
        operation: 'specialist-prompt-load-failed',
        correlationId,
        conversationId,
        specialistType,
        data: { error: promptError?.message || 'No prompt found' }
      });
      
      throw new Error(`Failed to load ${specialistType} specialist prompt: ${promptError?.message || 'No prompt found'}`);
    }
    
    // Log full prompt content for specialist handoff analysis
    if (isInterSpecialistHandoff) {
      logSpecialistHandoff(`===== FULL PROMPT FOR ${specialistType.toUpperCase()} =====`);
      logSpecialistHandoff('Prompt content:', promptData.prompt_content);
      
      // Analyze prompt for handoff-related language
      const promptLower = promptData.prompt_content.toLowerCase();
      const handoffPhrases = [
        'hand off', 'handoff', 'transfer', 'refer', 'route',
        'different specialist', 'another specialist', 'other specialist',
        'unified persona', 'single persona', 'one persona',
        'maintain persona', 'break persona', 'disconnect', 'end session',
        'seamless', 'expertise shift', 'access different'
      ];
      
      const foundPhrases = handoffPhrases.filter(phrase => promptLower.includes(phrase));
      logSpecialistHandoff('📝 Handoff-related phrases found in prompt:', foundPhrases);
      
      if (foundPhrases.length === 0) {
        logSpecialistHandoff('⚠️ WARNING: No handoff language found in specialist prompt!');
      }
      
      // Check for problematic phrases that might break persona
      const problematicPhrases = [
        'i will hand you off', 'i\'ll transfer you', 'connecting you to',
        'different ai', 'another ai', 'separate specialist',
        'end our conversation', 'disconnect', 'goodbye'
      ];
      
      const foundProblematic = problematicPhrases.filter(phrase => promptLower.includes(phrase));
      if (foundProblematic.length > 0) {
        logSpecialistHandoff('❌ CRITICAL: Problematic phrases that may break unified persona:', foundProblematic);
      }
      
      // Extract specialist's inter-referral section if it exists
      const specialistReferralSection = promptData.prompt_content.match(/INTER-SPECIALIST[^]*?(?=\n[A-Z]+\s+[A-Z]+:|$)/i);
      if (specialistReferralSection) {
        logSpecialistHandoff('📋 SPECIALIST INTER-REFERRAL INSTRUCTIONS:', specialistReferralSection[0]);
      } else {
        logSpecialistHandoff('⚠️ No explicit INTER-SPECIALIST REFERRAL section found in prompt');
      }
    }

    // Extract functions from the ai_prompts.functions column
    const functionsData = promptData.functions || [];

    if (!Array.isArray(functionsData)) {
      logTriageHandoffServer({
        level: 'ERROR',
        category: 'REPLACE_CONFIG',
        operation: 'specialist-functions-invalid-format',
        correlationId,
        conversationId,
        specialistType,
        data: { error: 'Functions column is not an array', functionsType: typeof functionsData }
      });
      
      throw new Error(`Invalid functions format for ${specialistType} specialist: expected array, got ${typeof functionsData}`);
    }
    
    // Log function details for specialist handoff analysis
    if (isInterSpecialistHandoff) {
      logSpecialistHandoff(`===== FUNCTIONS FOR ${specialistType.toUpperCase()} =====`);
      logSpecialistHandoff(`Total functions: ${functionsData.length}`);
      
      // Find and log the handoff function if it exists
      const handoffFunction = functionsData.find((f: FunctionDefinition) => f.name === 'trigger_specialist_handoff');
      if (handoffFunction) {
        logSpecialistHandoff('✅ trigger_specialist_handoff FOUND! Full definition:');
        logSpecialistHandoff(JSON.stringify(handoffFunction, null, 2));
        
        // Check if the description mentions unified persona
        const description = handoffFunction.description?.toLowerCase() || '';
        if (description.includes('unified') || description.includes('seamless') || description.includes('expertise')) {
          logSpecialistHandoff('✅ Handoff function mentions unified persona approach');
        } else {
          logSpecialistHandoff('⚠️ WARNING: Handoff function does not mention unified persona!');
        }
      } else {
        logSpecialistHandoff('❌ CRITICAL: trigger_specialist_handoff NOT FOUND in specialist functions!');
        logSpecialistHandoff('Available function names:', functionsData.map((f: FunctionDefinition) => f.name).join(', '));
      }
      
      // Also check if we need to load universal functions
      logSpecialistHandoff('Checking for universal functions merge...');
    }

    // Enhance prompt with context summary if provided
    let enhancedPromptContent = promptData.prompt_content;
    if (contextSummary && !contextSummary.includes('Resuming conversation from')) {
      const contextInstruction = `\n\nIMPORTANT CONTEXT FROM TRIAGE AI:\n${contextSummary}\n\nBased on this context, provide focused and relevant support for the user's specific needs.`;
      enhancedPromptContent = promptData.prompt_content + contextInstruction;

      logTriageHandoffServer({
        level: 'INFO',
        category: 'REPLACE_CONFIG',
        operation: 'context-added-to-prompt',
        correlationId,
        conversationId,
        specialistType,
        data: {
          originalPromptLength: promptData.prompt_content.length,
          enhancedPromptLength: enhancedPromptContent.length,
          contextLength: contextSummary.length
        }
      });
    }

    // V16: Add user memory context if userId is provided and not anonymous
    if (userId && userId !== 'anonymous') {
      // Helper function for user memory logging
      const logUserMemory = (message: string, ...args: unknown[]) => {
        if (process.env.NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS === 'true') {
          console.log(`[user_memory] ${message}`, ...args);
        }
      };

      logUserMemory('V16 replace-session: Attempting to fetch user AI instructions summary', {
        userId,
        specialistType,
        conversationId,
        source: 'replace-session-config-api'
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
            logUserMemory('V16 replace-session: No user profile found', {
              userId,
              specialistType,
              conversationId
            });
            
            // File logging for server-side
            logUserMemoryServer({
              level: 'INFO',
              category: 'PROFILE_FETCH',
              operation: 'no-profile-found-replace-session',
              correlationId,
              userId,
              conversationId,
              specialistType,
              data: { reason: 'PGRST116' }
            });
          } else {
            logUserMemory('V16 replace-session: Error fetching user profile', {
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
              operation: 'profile-fetch-error-replace-session',
              correlationId,
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
          
          logUserMemory('V16 replace-session: User AI summary found, enhancing specialist prompt', {
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
            operation: 'ai-summary-loaded-replace-session',
            correlationId,
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

          logTriageHandoffServer({
            level: 'INFO',
            category: 'MEMORY',
            operation: 'user-memory-added-to-replace-config',
            correlationId,
            conversationId,
            specialistType,
            data: {
              userId,
              memoryAddedLength: aiSummary.length,
              finalPromptLength: enhancedPromptContent.length
            }
          });
          
          logUserMemory('V16 replace-session: Successfully enhanced prompt with user memory', {
            userId,
            specialistType,
            conversationId,
            originalPromptLength: promptData.prompt_content?.length || 0,
            memoryAddedLength: aiSummary.length,
            finalPromptLength: enhancedPromptContent.length
          });

          // Log the FULL enhanced prompt when memory logging is enabled
          logUserMemory('V16 replace-session: FULL ENHANCED PROMPT WITH USER MEMORY:', {
            userId,
            specialistType,
            conversationId,
            fullEnhancedPrompt: enhancedPromptContent
          });
          
          // File logging for successful enhancement
          logUserMemoryServer({
            level: 'INFO',
            category: 'MEMORY_ENHANCEMENT',
            operation: 'replace-session-prompt-enhanced-with-memory',
            correlationId,
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
          logUserMemory('V16 replace-session: No AI instructions summary found in user profile', {
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
            operation: 'no-ai-summary-in-profile-replace-session',
            correlationId,
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
        logUserMemory('V16 replace-session: Unexpected error fetching user memory', {
          error: (memoryError as Error).message,
          userId,
          specialistType,
          conversationId
        });
        
        // File logging for unexpected error
        logUserMemoryServer({
          level: 'ERROR',
          category: 'MEMORY_ENHANCEMENT',
          operation: 'unexpected-memory-fetch-error-replace-session',
          correlationId,
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

    // Load and merge universal functions if needed
    let universalFunctions: FunctionDefinition[] = [];
    if (specialistType !== 'universal_functions') {
      const { data: universalData, error: universalError } = await supabase
        .from('ai_prompts')
        .select('functions')
        .eq('prompt_type', 'universal_functions')
        .eq('is_active', true)
        .single();
        
      if (!universalError && universalData?.functions) {
        universalFunctions = universalData.functions;
        
        if (isInterSpecialistHandoff) {
          logSpecialistHandoff(`===== UNIVERSAL FUNCTIONS =====`);
          logSpecialistHandoff(`Loaded ${universalFunctions.length} universal functions`);
          
          // Check if handoff function is in universal functions
          const universalHandoff = universalFunctions.find((f: FunctionDefinition) => f.name === 'trigger_specialist_handoff');
          if (universalHandoff) {
            logSpecialistHandoff('✅ trigger_specialist_handoff FOUND in universal functions!');
            logSpecialistHandoff('Universal handoff function definition:', JSON.stringify(universalHandoff, null, 2));
          }
        }
      }
    }
    
    // Combine specialist functions with universal functions
    const allFunctions = [...functionsData, ...universalFunctions];
    
    if (isInterSpecialistHandoff) {
      logSpecialistHandoff(`===== FINAL MERGED FUNCTIONS =====`);
      logSpecialistHandoff(`Total functions after merge: ${allFunctions.length} (${functionsData.length} specialist + ${universalFunctions.length} universal)`);
      
      // Final check for handoff function
      const finalHandoff = allFunctions.find((f: FunctionDefinition) => f.name === 'trigger_specialist_handoff');
      if (finalHandoff) {
        logSpecialistHandoff('✅ FINAL CHECK: trigger_specialist_handoff is available after merge');
      } else {
        logSpecialistHandoff('❌ FINAL CHECK: trigger_specialist_handoff NOT AVAILABLE even after merge!');
        logSpecialistHandoff('❌ This specialist CANNOT perform inter-specialist handoffs!');
      }
    }

    // Format functions for OpenAI
    const formattedFunctions = allFunctions || [];

    logTriageHandoffServer({
      level: 'INFO',
      category: 'REPLACE_CONFIG',
      operation: 'configuration-prepared',
      correlationId,
      conversationId,
      specialistType,
      data: {
        promptLength: enhancedPromptContent.length,
        functionsCount: formattedFunctions.length,
        hasContext: !!contextSummary && !contextSummary.includes('Resuming conversation from'),
        voiceSettings: promptData.voice_settings
      }
    });

    // Return configuration for AI replacement
    const response = {
      success: true,
      config: {
        instructions: enhancedPromptContent,
        tools: formattedFunctions,
        voice: promptData.voice_settings?.voice || 'alloy'
      },
      metadata: {
        specialistType,
        promptLength: enhancedPromptContent.length,
        functionsCount: formattedFunctions.length,
        correlationId
      }
    };

    logTriageHandoffServer({
      level: 'INFO',
      category: 'REPLACE_CONFIG',
      operation: 'replace-session-config-success',
      correlationId,
      conversationId,
      specialistType,
      data: {
        configPrepared: true,
        instructionsLength: response.config.instructions.length,
        toolsCount: response.config.tools.length
      }
    });

    return NextResponse.json(response);

  } catch (error) {
    logTriageHandoffServer({
      level: 'ERROR',
      category: 'REPLACE_CONFIG',
      operation: 'replace-session-config-error',
      correlationId,
      data: { error: (error as Error).message }
    });

    console.error('[triageAI][replace-config] Failed to prepare session config:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: (error as Error).message,
        correlationId 
      },
      { status: 500 }
    );
  }
}