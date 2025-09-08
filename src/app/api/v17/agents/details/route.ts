// src/app/api/v17/agents/details/route.ts
// V17 Agent Details API - Get current agent configuration including tool IDs

import { NextRequest, NextResponse } from 'next/server';

const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId') || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!agentId) {
      return NextResponse.json({ 
        error: 'No agent ID provided' 
      }, { status: 400 });
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ 
        error: 'Missing ELEVENLABS_API_KEY environment variable' 
      }, { status: 500 });
    }

    logV17('🔍 Fetching ElevenLabs agent details with tools', { agentId });

    // Get current agent configuration from ElevenLabs using correct endpoint
    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logV17('❌ ElevenLabs API error', { status: response.status, error: errorText });
      return NextResponse.json({ 
        error: `ElevenLabs API error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    const agentData = await response.json();
    
    // Extract tool IDs from the agent configuration
    const toolIds = agentData.conversation_config?.agent?.prompt?.tool_ids || [];
    
    // Extract comprehensive configuration details
    const agentDetails = {
      agentId: agentData.agent_id,
      name: agentData.name,
      status: agentData.status || 'unknown',
      created_at: agentData.created_at,
      updated_at: agentData.updated_at,
      
      // Instructions/Prompt
      hasInstructions: !!agentData.conversation_config?.agent?.prompt?.prompt,
      instructionLength: agentData.conversation_config?.agent?.prompt?.prompt?.length || 0,
      instructionPreview: agentData.conversation_config?.agent?.prompt?.prompt?.substring(0, 500) || 'NO INSTRUCTIONS FOUND',
      firstMessage: agentData.conversation_config?.agent?.prompt?.first_message || 'not set',
      
      // Voice Configuration
      voiceId: agentData.conversation_config?.tts?.voice_id || 'not configured',
      voiceModel: agentData.conversation_config?.tts?.model_id || 'not configured',
      voiceSettings: {
        stability: agentData.conversation_config?.tts?.stability,
        similarity_boost: agentData.conversation_config?.tts?.similarity_boost,
        style: agentData.conversation_config?.tts?.style,
        use_speaker_boost: agentData.conversation_config?.tts?.use_speaker_boost
      },
      
      // LLM Configuration
      llmModel: agentData.conversation_config?.llm?.model || 'not configured',
      llmTemperature: agentData.conversation_config?.llm?.temperature || 'not configured',
      
      // Tools Configuration
      toolIds: toolIds,
      totalTools: toolIds.length,
      hasTools: toolIds.length > 0,
      
      // Knowledge Base
      hasKnowledgeBase: !!agentData.conversation_config?.agent?.prompt?.knowledge_base?.length,
      knowledgeBaseCount: agentData.conversation_config?.agent?.prompt?.knowledge_base?.length || 0,
      
      // Tags
      tags: agentData.tags || []
    };

    logV17('✅ Agent details retrieved', {
      agentId: agentDetails.agentId,
      name: agentDetails.name,
      totalTools: agentDetails.totalTools,
      voiceId: agentDetails.voiceId,
      instructionLength: agentDetails.instructionLength
    });

    return NextResponse.json({
      success: true,
      agent: agentDetails,
      toolIds: toolIds, // Convenient direct access to tool IDs
      // Include full response for debugging if needed
      fullResponse: process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true' ? agentData : undefined
    });

  } catch (error) {
    logV17('❌ Error fetching agent details', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({ 
      error: 'Failed to fetch agent details',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}