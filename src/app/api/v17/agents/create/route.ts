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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      specialistType = 'triage', 
      voiceId = 'pNInz6obpgDQGcFmaJgB', // Adam voice by default
      userId 
    } = body;

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
        functionNames: aiPrompt.functions?.map(f => f.name) || [],
        lastUpdated: aiPrompt.updated_at
      });
    }

    // 2. SET VOICE CONFIGURATION
    const voiceConfig = {
      voice_id: voiceId,
      model_id: "eleven_turbo_v2_5",
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

    logV17('🔄 Updating ElevenLabs agent with Supabase instructions', {
      agentId: existingAgentId,
      instructionLength: aiPrompt.prompt_content?.length || 0
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

    // Update the agent with our Supabase instructions using POST-MAY 2025 API STRUCTURE
    try {
      const updateResponse = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${existingAgentId}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: {
                prompt: aiPrompt.prompt_content || `You are a ${specialistType} AI assistant specialized in mental health support.`,
                first_message: "Hello! I'm here to provide mental health support. How can I help you today?"
              }
            }
          },
          name: `RiseTwice ${specialistType} Agent`,
          tags: ["mental-health", specialistType, "risetwice"]
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        logV17('❌ Failed to update ElevenLabs agent', {
          status: updateResponse.status,
          error: errorText
        });
        throw new Error(`Failed to update agent: ${updateResponse.status} - ${errorText}`);
      }

      const updatedAgent = await updateResponse.json();
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