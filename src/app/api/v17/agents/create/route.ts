// src/app/api/v17/agents/create/route.ts
// V17 ElevenLabs Agent Configuration API
// Creates and configures ElevenLabs agents with voice, AI instructions, and knowledge base
//
// 🚨🚨🚨 CRITICAL WARNING FOR FUTURE CLAUDE CODE SESSIONS 🚨🚨🚨
// 
// ❌ DO NOT CREATE TOOLS DYNAMICALLY IN THIS FILE!
// ❌ DO NOT ADD fetch() calls with method: 'POST' to create tools!  
// ❌ DO NOT modify getExistingV17Tools() to create new tools!
//
// ✅ ALL TOOLS ARE ALREADY CREATED IN ELEVENLABS DASHBOARD (34+ tools)
// ✅ This file only FETCHES existing tool IDs and assigns them to agent
// ✅ getExistingV17Tools() uses GET method to fetch existing tools
//
// If you see this comment and think "but we need to create tools":
// STOP! The tools already exist. Just fetch and use them.
//
// 🚨🚨🚨 END CRITICAL WARNING 🚨🚨🚨

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// ElevenLabs API configuration
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Removed legacy server tools configuration - now using ElevenLabs Tools API exclusively

// ⚠️ CRITICAL: DO NOT CREATE TOOLS DYNAMICALLY!
// ⚠️ ALL TOOLS ARE ALREADY CREATED IN ELEVENLABS DASHBOARD
// ⚠️ THIS FUNCTION ONLY FETCHES EXISTING TOOL IDS - NEVER CREATES NEW ONES
// ⚠️ FUTURE CLAUDE: DO NOT MODIFY THIS TO CREATE TOOLS!
//
// V17 Tools Configuration - ElevenLabs Tools API (post-July 2025)
// FETCHES existing tools from dashboard - DOES NOT create new tools
async function getExistingV17Tools(): Promise<string[]> {
  logV17('🔍 Fetching existing ElevenLabs tools from dashboard');

  try {
    // ✅ CORRECT: Fetch existing tools from ElevenLabs dashboard
    // ❌ WRONG: Creating new tools with POST requests
    // Get all existing tools from ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logV17('❌ Failed to fetch existing tools', {
        status: response.status,
        error: errorText
      });
      return [];
    }

    const toolsData = await response.json();
    const tools = toolsData.tools || [];
    const toolIds = tools.map((tool: { id: string }) => tool.id);

    logV17('✅ Existing tools fetched successfully', {
      totalTools: tools.length,
      toolIds: toolIds.slice(0, 5), // Log first 5 for debugging
      allToolsCount: toolIds.length
    });

    return toolIds;
  } catch (error) {
    logV17('❌ Error fetching existing tools', { error });
    return [];
  }
}

export async function POST(request: NextRequest) {
  console.log(`[V17] 🚨 FORCE LOG: API ENDPOINT CALLED - /api/v17/agents/create`);

  try {
    const body = await request.json();
    const {
      specialistType = 'triage',
      voiceId = 'EmtkmiOFoQVpKRVpXH2B', // V17 specified voice by default
      userId,
      demoPromptAppend, // Optional demo prompt to append to base instructions
      voicePreferences // Optional voice preferences from localStorage
    } = body;

    console.log(`[V17] 🚨 FORCE LOG: Request body parsed - voiceId: ${voiceId}, specialistType: ${specialistType}, hasDemo: ${!!demoPromptAppend}`);

    logV17('🤖 Creating ElevenLabs agent', {
      specialistType,
      voiceId,
      userId: userId || 'anonymous',
      isDemoRequest: !!demoPromptAppend,
      demoPromptLength: demoPromptAppend?.length || 0
    });

    // 1. GET AI INSTRUCTIONS from Supabase
    // For ai_preview, check provider-specific customizations first, then fall back to global default
    let aiPrompt = null;
    let promptError = null;
    let customOpeningStatement: string | null = null;

    if (specialistType === 'ai_preview' && userId) {
      // Try to get provider-specific AI preview prompt first
      logV17('🔍 Checking for provider-specific AI preview prompt', { userId });

      const { data: providerPrompt, error: providerError } = await supabase
        .from('s2_provider_ai_preview_prompts')
        .select('prompt_content')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (providerPrompt && !providerError) {
        logV17('✅ Using provider-specific AI preview prompt', {
          userId,
          promptLength: providerPrompt.prompt_content.length
        });
        aiPrompt = { prompt_content: providerPrompt.prompt_content };
      } else {
        logV17('📘 No provider-specific prompt found, falling back to global default', {
          userId,
          error: providerError?.message
        });
      }

      // Fetch custom opening statement from s2_ai_style_configs
      logV17('🔍 Fetching custom opening statement from s2_ai_style_configs', { userId });

      const { data: therapistProfile } = await supabase
        .from('s2_therapist_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (therapistProfile) {
        // Get most recent active style config (order by created_at DESC to get newest inserted row)
        const { data: styleConfigs } = await supabase
          .from('s2_ai_style_configs')
          .select('opening_statement')
          .eq('therapist_profile_id', therapistProfile.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        const styleConfig = styleConfigs?.[0];

        if (styleConfig?.opening_statement) {
          customOpeningStatement = styleConfig.opening_statement;
          logV17('✅ Found custom opening statement', {
            userId,
            therapistProfileId: therapistProfile.id,
            openingStatementLength: styleConfig.opening_statement.length,
            openingStatementPreview: styleConfig.opening_statement.substring(0, 100) + '...'
          });
        } else {
          logV17('📘 No custom opening statement found, will use default', { userId });
        }
      }
    }

    // If no provider-specific prompt (or not ai_preview), use standard RPC
    if (!aiPrompt) {
      const { data: aiPromptArray, error: rpcError } = await supabase
        .rpc('get_ai_prompt_by_type', {
          target_prompt_type: specialistType,
          requesting_user_id: userId || null
        });

      aiPrompt = aiPromptArray?.[0] || null;
      promptError = rpcError;
    }

    if (promptError || !aiPrompt) {
      logV17('❌ Failed to load AI prompt', { promptError, specialistType });
      return NextResponse.json({
        error: `Failed to load ${specialistType} prompt from database`
      }, { status: 500 });
    }

    // Prepare final AI instructions (base + optional demo append)
    let finalPromptContent = aiPrompt.prompt_content || `You are a ${specialistType} AI assistant specialized in mental health support.`;

    // Append demo prompt if provided
    if (demoPromptAppend) {
      finalPromptContent += demoPromptAppend;
      logV17('✅ Demo prompt appended to base instructions', {
        originalLength: aiPrompt.prompt_content?.length || 0,
        appendLength: demoPromptAppend.length,
        finalLength: finalPromptContent.length
      });
    }

    logV17('✅ AI prompt loaded and processed', {
      specialistType,
      basePromptLength: aiPrompt.prompt_content?.length || 0,
      finalPromptLength: finalPromptContent.length,
      functionsCount: aiPrompt.functions?.length || 0,
      isDemoRequest: !!demoPromptAppend
    });

    // Log the actual prompt being used (truncated for readability)
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      console.log(`[V17] 📝 AI Instructions for ${specialistType}${demoPromptAppend ? ' (with demo append)' : ''}:`, {
        promptPreview: finalPromptContent.substring(0, 500) + '...',
        fullPromptLength: finalPromptContent.length,
        functionNames: aiPrompt.functions?.map((f: { name: string }) => f.name) || [],
        lastUpdated: aiPrompt.updated_at,
        isDemoRequest: !!demoPromptAppend
      });
    }

    // 2. SET VOICE CONFIGURATION - Use preferences if provided, otherwise defaults
    const defaultVoiceSettings = {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true,
      speed: 1.0
    };

    // Apply user voice preferences if provided
    const voiceSettings = voicePreferences?.voice_settings || defaultVoiceSettings;
    const modelFamily = voicePreferences?.model_family || 'eleven_turbo_v2';
    const language = voicePreferences?.language || 'en';

    const voiceConfig = {
      voice_id: voiceId,
      model_id: modelFamily === 'same_as_agent' ? 'eleven_turbo_v2' : modelFamily,
      stability: voiceSettings.stability,
      similarity_boost: voiceSettings.similarity_boost,
      style: voiceSettings.style,
      use_speaker_boost: voiceSettings.use_speaker_boost,
      speed: voiceSettings.speed,  // ✅ Now uses user preference!
      ...(language !== 'en' && { language }) // Add language if not English
    };

    logV17('🎛️ Voice configuration applied', {
      userPreferencesProvided: !!voicePreferences,
      finalVoiceConfig: voiceConfig,
      modelFamily: modelFamily
    });

    // V17: Update the existing ElevenLabs agent with Supabase instructions
    const existingAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!existingAgentId) {
      throw new Error('NEXT_PUBLIC_ELEVENLABS_AGENT_ID not configured');
    }

    logV17('🔄 Updating ElevenLabs agent with Supabase instructions and voice config', {
      agentId: existingAgentId,
      instructionLength: aiPrompt.prompt_content?.length || 0,
      voiceConfig: voiceConfig,
      voiceId: voiceConfig.voice_id
    });

    // Initialize agent info
    let agent = {
      agent_id: existingAgentId,
      name: `RiseTwice ${specialistType} Agent`,
      specialist_type: specialistType,
      voice_id: voiceId,
      updated: false,
      instructions_length: 0
    };

    // ⚠️ CRITICAL: This does NOT create tools - it fetches existing tool IDs!
    // ⚠️ All 34+ tools are already created in ElevenLabs dashboard
    // ⚠️ DO NOT modify this to create tools dynamically!
    // Get existing tools from ElevenLabs dashboard instead of creating new ones
    const toolIds = await getExistingV17Tools();

    // If no tools were fetched, use empty array (agent will work without tools)
    if (toolIds.length === 0) {
      logV17('⚠️ No existing tools found - agent will work without tool calling capability');
    }

    // Update the agent with our Supabase instructions using NEW 2025 API STRUCTURE
    try {
      console.log(`[V17] 🚨 FORCE LOG: About to PATCH agent with voice_id: ${voiceConfig.voice_id} and ${toolIds.length} tool IDs`);
      console.log(`[V17] 🔧 TOOL IDS:`, toolIds);

      // DON'T set first_message on agent - it will be overridden at session level
      // This prevents caching issues with the shared agent
      logV17('📝 Custom opening statement will be applied at SESSION level (not agent level)', {
        hasCustom: !!customOpeningStatement,
        messageLength: customOpeningStatement?.length || 0,
        messagePreview: customOpeningStatement?.substring(0, 100) || 'no custom message'
      });

      const patchPayload = {
        conversation_config: {
          agent: {
            // ✅ NO first_message here - it's set via session override to avoid caching
            prompt: {
              prompt: finalPromptContent,
              tool_ids: toolIds,  // NEW: Use tool IDs instead of tools array
              tools: []  // Empty array instead of null for ElevenLabs API validation
            }
          },
          tts: voiceConfig,
          tools: []  // Empty array instead of null for ElevenLabs API validation
        },
        name: `RiseTwice ${specialistType} Agent`,
        tags: ["mental-health", specialistType, "risetwice"]
      };

      console.log(`[V17] 🔧 PATCH PAYLOAD:`, JSON.stringify(patchPayload, null, 2));

      // Write full payload to file for debugging
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync('/tmp/v17-patch-payload.json', JSON.stringify(patchPayload, null, 2));
      } catch (e) {
        console.log('[V17] Could not write debug file:', e);
      }

      const updateResponse = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${existingAgentId}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchPayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.log(`[V17] 🚨 FORCE LOG: PATCH FAILED - Status: ${updateResponse.status}, Error: ${errorText}`);
        logV17('❌ Failed to update ElevenLabs agent', {
          status: updateResponse.status,
          error: errorText
        });
        throw new Error(`Failed to update agent: ${updateResponse.status} - ${errorText}`);
      }

      const updatedAgent = await updateResponse.json();
      console.log(`[V17] 🚨 FORCE LOG: PATCH SUCCESS - Voice should now be: ${voiceConfig.voice_id}`);
      console.log(`[V17] 🚨 FORCE LOG: Response voice_id: ${updatedAgent.conversation_config?.tts?.voice_id || 'NOT SET'}`);
      console.log(`[V17] 🔧 ELEVENLABS RESPONSE TOOL IDs:`, JSON.stringify(updatedAgent.conversation_config?.agent?.prompt?.tool_ids || 'NO TOOL IDS', null, 2));

      // Write ElevenLabs response to file for debugging
      try {
        const fsModule = await import('fs');
        fsModule.writeFileSync('/tmp/v17-elevenlabs-response.json', JSON.stringify(updatedAgent, null, 2));
      } catch (e) {
        console.log('[V17] Could not write debug response file:', e);
      }

      logV17('✅ ElevenLabs agent updated successfully', {
        agentId: updatedAgent.agent_id,
        hasInstructions: !!updatedAgent.conversation_config?.agent?.prompt?.prompt,
        instructionLength: updatedAgent.conversation_config?.agent?.prompt?.prompt?.length || 0
      });

      // Update agent info with successful update
      agent = {
        agent_id: existingAgentId,
        name: `RiseTwice ${specialistType} Agent`,
        specialist_type: specialistType,
        voice_id: voiceId,
        updated: true,
        instructions_length: updatedAgent.conversation_config?.agent?.prompt?.prompt?.length || 0
      };

      logV17('✅ ElevenLabs agent updated successfully', {
        agentId: agent.agent_id,
        specialistType,
        voiceId: voiceConfig.voice_id,
        instructionsUpdated: true
      });

    } catch (updateError) {
      logV17('❌ Failed to update ElevenLabs agent, using existing configuration', {
        error: updateError instanceof Error ? updateError.message : String(updateError)
      });

      // Agent info already initialized above, just log the error
    }

    // For V17 MVP, we'll skip database storage and work directly with the existing agent
    logV17('💾 V17 MVP: Skipping database storage, using existing agent configuration');

    // CRITICAL: Verify what ElevenLabs agent actually has configured
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      try {
        const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${existingAgentId}`, {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const agentData = await response.json();
          const actualFirstMessage = agentData.conversation_config?.agent?.first_message || 'NOT SET';

          console.log(`[V17] 🔍 ELEVENLABS AGENT VERIFICATION:`, {
            agentId: existingAgentId,
            hasInstructions: !!agentData.conversation_config?.agent?.prompt?.prompt,
            instructionLength: agentData.conversation_config?.agent?.prompt?.prompt?.length || 0,
            instructionPreview: agentData.conversation_config?.agent?.prompt?.prompt?.substring(0, 200) || 'NO INSTRUCTIONS',
            voiceId: agentData.conversation_config?.tts?.voice_id || 'not set',
            llmModel: agentData.conversation_config?.llm?.model || 'not set',
            lastUpdated: agentData.updated_at || 'unknown'
          });

          console.log(`[V17] 🎯 FIRST MESSAGE VERIFICATION:`, {
            customOpeningStatementAvailable: !!customOpeningStatement,
            customOpeningStatement: customOpeningStatement || 'NOT SET',
            actualFirstMessage: actualFirstMessage,
            note: 'first_message is now set at SESSION level, not agent level (to avoid caching)'
          });

          // Check if our Supabase prompt matches ElevenLabs agent
          const elevenLabsPrompt = agentData.conversation_config?.agent?.prompt?.prompt || '';
          const supabasePrompt = aiPrompt.prompt_content || '';
          const promptsMatch = elevenLabsPrompt.includes(supabasePrompt.substring(0, 500));

          console.log(`[V17] 🔍 PROMPT COMPARISON:`, {
            supabasePromptLength: supabasePrompt.length,
            elevenLabsPromptLength: elevenLabsPrompt.length,
            promptsMatch: promptsMatch,
            mismatchWarning: !promptsMatch ? '⚠️ PROMPTS DO NOT MATCH!' : '✅ Prompts appear to match'
          });
        } else {
          console.log(`[V17] ❌ Failed to verify ElevenLabs agent: ${response.status}`);
        }
      } catch (error) {
        console.log(`[V17] ❌ Error verifying ElevenLabs agent:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        specialist_type: specialistType,
        voice_id: voiceConfig.voice_id,
        name: agent.name,
        customOpeningStatement: customOpeningStatement // ✅ Return fresh opening statement from database
      }
    });

  } catch (error) {
    logV17('❌ Error creating ElevenLabs agent', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Failed to create ElevenLabs agent',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET method to retrieve existing agents
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const specialistType = url.searchParams.get('specialistType') || 'triage';

    logV17('🔍 Getting ElevenLabs agents', { specialistType });

    // Get agents from database
    const { data: agents, error } = await supabase
      .from('elevenlabs_agents')
      .select('*')
      .eq('specialist_type', specialistType)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logV17('❌ Failed to fetch agents from database', { error });
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      agents: agents || []
    });

  } catch (error) {
    logV17('❌ Error fetching ElevenLabs agents', { error });
    return NextResponse.json({
      error: 'Failed to fetch agents'
    }, { status: 500 });
  }
}