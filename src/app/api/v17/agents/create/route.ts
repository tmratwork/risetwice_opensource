// src/app/api/v17/agents/create/route.ts
// V17 ElevenLabs Agent Configuration API
// Creates and configures ElevenLabs agents with voice, AI instructions, and knowledge base

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

// V17 Tools Configuration - ElevenLabs Tools API (post-July 2025)
async function createV17Tools(): Promise<string[]> {
  // COMPLETE V17 TOOL SET - All 33 V16 Triage Functions Migrated
  // All tools configured with proper POST schemas and parameter validation
  const toolIds = [
    // Core V17 Tools (6) - Previously available via server tools
    'tool_5401k4kyv4ztexw95bsra3ctfm12',  // get_safety_triage_protocol
    'tool_6701k4kyx3ysf98av4mpm20x8238',  // get_conversation_stance_guidance
    'tool_6801k4kyxcg4fj38jsfke0de0k3d',  // get_assessment_protocol
    'tool_4301k4kyxmjwfppahnf036bv1ed3',  // get_acute_distress_protocol
    'tool_0901k4kyxz2cerarsc4d4yzaen1e',  // search_resources_unified
    'tool_8101k4kyy6gdfydtjkeapx8qbx53',  // end_session
    
    // Mental Health Core Functions (6)
    'tool_9601k4m0bgreekste00ccrpr98mn',  // grounding_function
    'tool_6401k4m0bqrqfmnsh1z05jxxgc0k',  // thought_exploration_function
    'tool_8001k4m0c0mqehsawr2nebnt0ghw',  // problem_solving_function
    'tool_6501k4m0c0mvfpgb6be30rfgdbch',  // screening_function
    'tool_4001k4m0cej1eg7t5g0sygqk69p9',  // psychoeducation_function
    'tool_9101k4m0cej0en5rkgxkf3ara2gp',  // validation_function
    
    // Crisis Support Functions (3)
    'tool_6401k4m0cej1eqxt0kw73nm28zgn',  // crisis_response_function
    'tool_3101k4m0dzdcfb095rpx1f2qyqmh',  // crisis_mental_health_function
    'tool_7001k4m0dzdffmf929y3xmp6g53c',  // domestic_violence_support_function
    
    // Therapeutic Content Functions (6)
    'tool_7301k4m0cw43fsssrjaqz2k7q3p9',  // get_continuity_framework
    'tool_2801k4m0cw4benvadghpv80kc0g9',  // get_cbt_intervention
    'tool_2801k4m0cw4cfearaat0n0ysvgfx',  // get_dbt_skills
    'tool_2701k4m0cw4hen6bejf8bx4h9v33',  // get_trauma_informed_approach
    'tool_1201k4m0cw4gepnbcpbc6kdb6nx1',  // get_substance_use_support
    'tool_1101k4m0cw4gf5gt42amet53j32f',  // get_practical_support_guidance
    
    // Future Planning Functions (6)
    'tool_5501k4m0dzdefs492w4g904nbk26',  // educational_guidance_function
    'tool_3601k4m0dzdffz4tc30k5yej2z2y',  // futures_assessment_function
    'tool_8601k4m0dzdgerh8x4wxmfrvww4r',  // goal_planning_function
    'tool_5701k4m0dzdjf25spfg78x7qtv36',  // pathway_exploration_function
    'tool_8801k4m0dzddepqa77g8n3fns5e8',  // resource_connection_function
    'tool_1301k4m0e099fkyvy8cwtp10g960',  // skill_building_function
    
    // Session Management Functions (2)
    'tool_2901k4m0dd68faftazeh8vdb9a16',  // getUserHistory_function
    'tool_2601k4m0dzbje4pb3a80pedezdsc',  // logInteractionOutcome_function
    
    // Support Functions (4)
    'tool_3001k4m0dzbjey3ahbtwvdp46819',  // cultural_humility_function
    'tool_3701k4m0dzcgfskr3de657sfk6tc',  // display_map_function
    'tool_2101k4m0dzcgerqbx46gecxt1a0c',  // resource_feedback_function
    'tool_7001k4m0dzcgef0vbsntwx768qsa'   // report_technical_error
  ];

  logV17('✅ Using existing V17 tools created programmatically', {
    toolCount: toolIds.length,
    toolIds: toolIds
  });

  return toolIds;

}

export async function POST(request: NextRequest) {
  console.log(`[V17] 🚨 FORCE LOG: API ENDPOINT CALLED - /api/v17/agents/create`);
  
  try {
    const body = await request.json();
    const { 
      specialistType = 'triage', 
      voiceId = 'EmtkmiOFoQVpKRVpXH2B', // V17 specified voice by default
      userId 
    } = body;
    
    console.log(`[V17] 🚨 FORCE LOG: Request body parsed - voiceId: ${voiceId}, specialistType: ${specialistType}`);

    logV17('🤖 Creating ElevenLabs agent', {
      specialistType,
      voiceId,
      userId: userId || 'anonymous'
    });

    // 1. GET AI INSTRUCTIONS from Supabase (same as V16)
    const { data: aiPromptArray, error: promptError } = await supabase
      .rpc('get_ai_prompt_by_type', {
        target_prompt_type: specialistType,
        requesting_user_id: userId || null
      });
    
    const aiPrompt = aiPromptArray?.[0] || null;

    if (promptError || !aiPrompt) {
      logV17('❌ Failed to load AI prompt', { promptError, specialistType });
      return NextResponse.json({ 
        error: `Failed to load ${specialistType} prompt from database` 
      }, { status: 500 });
    }

    logV17('✅ AI prompt loaded', {
      specialistType,
      promptLength: aiPrompt.prompt_content?.length || 0,
      functionsCount: aiPrompt.functions?.length || 0
    });

    // Log the actual prompt being used (truncated for readability)
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      console.log(`[V17] 📝 AI Instructions for ${specialistType}:`, {
        promptPreview: aiPrompt.prompt_content?.substring(0, 500) + '...',
        fullPromptLength: aiPrompt.prompt_content?.length || 0,
        functionNames: aiPrompt.functions?.map((f: { name: string }) => f.name) || [],
        lastUpdated: aiPrompt.updated_at
      });
    }

    // 2. SET VOICE CONFIGURATION
    const voiceConfig = {
      voice_id: voiceId,
      model_id: "eleven_turbo_v2",  // ✅ Change from v2_5 to v2 for English agent compatibility
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true
    };

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

    // NEW: Create tools using ElevenLabs tools API, then get tool IDs for agent
    const toolIds = await createV17Tools();
    
    // Update the agent with our Supabase instructions using NEW 2025 API STRUCTURE
    try {
      console.log(`[V17] 🚨 FORCE LOG: About to PATCH agent with voice_id: ${voiceConfig.voice_id} and ${toolIds.length} tool IDs`);
      console.log(`[V17] 🔧 TOOL IDS:`, toolIds);
      
      const patchPayload = {
        conversation_config: {
          agent: {
            prompt: {
              prompt: aiPrompt.prompt_content || `You are a ${specialistType} AI assistant specialized in mental health support.`,
              first_message: "Hello! I'm here to provide mental health support. How can I help you today?",
              tool_ids: toolIds  // NEW: Use tool IDs instead of tools array
            }
          },
          tts: voiceConfig
          // REMOVED: tools array - now deprecated
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
      console.log(`[V17] 🔧 ELEVENLABS RESPONSE TOOLS:`, JSON.stringify(updatedAgent.conversation_config?.tools || 'NO TOOLS', null, 2));
      
      // Write ElevenLabs response to file for debugging
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync('/tmp/v17-elevenlabs-response.json', JSON.stringify(updatedAgent, null, 2));
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
          console.log(`[V17] 🔍 ELEVENLABS AGENT VERIFICATION:`, {
            agentId: existingAgentId,
            hasInstructions: !!agentData.conversation_config?.agent?.prompt?.prompt,
            instructionLength: agentData.conversation_config?.agent?.prompt?.prompt?.length || 0,
            instructionPreview: agentData.conversation_config?.agent?.prompt?.prompt?.substring(0, 200) || 'NO INSTRUCTIONS',
            voiceId: agentData.conversation_config?.tts?.voice_id || 'not set',
            llmModel: agentData.conversation_config?.llm?.model || 'not set',
            lastUpdated: agentData.updated_at || 'unknown'
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
        name: agent.name
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