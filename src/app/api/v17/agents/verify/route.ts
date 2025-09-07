// src/app/api/v17/agents/verify/route.ts
// V17 Agent Verification - Check what ElevenLabs agent actually has configured

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

    logV17('🔍 Verifying ElevenLabs agent configuration', { agentId });

    // Get current agent configuration from ElevenLabs
    const response = await fetch(`${ELEVENLABS_API_BASE}/conversational-ai/agents/${agentId}`, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
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
    
    // Extract key configuration details
    const config = {
      agentId: agentData.agent_id,
      name: agentData.name,
      hasInstructions: !!agentData.conversation_config?.prompt?.prompt,
      instructionLength: agentData.conversation_config?.prompt?.prompt?.length || 0,
      instructionPreview: agentData.conversation_config?.prompt?.prompt?.substring(0, 500) || 'NO INSTRUCTIONS FOUND',
      voiceId: agentData.conversation_config?.tts?.voice_id || 'not configured',
      voiceModel: agentData.conversation_config?.tts?.model_id || 'not configured',
      llmModel: agentData.conversation_config?.llm?.model || 'not configured',
      llmTemperature: agentData.conversation_config?.llm?.temperature || 'not configured',
      hasKnowledgeBase: !!agentData.conversation_config?.prompt?.knowledge_base?.length,
      knowledgeBaseCount: agentData.conversation_config?.prompt?.knowledge_base?.length || 0,
      lastUpdated: agentData.updated_at || 'unknown',
      status: agentData.status || 'unknown'
    };

    logV17('✅ Agent configuration retrieved', config);

    return NextResponse.json({
      success: true,
      agent: config,
      fullResponse: agentData // Include full response for debugging
    });

  } catch (error) {
    logV17('❌ Error verifying agent', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({ 
      error: 'Failed to verify agent configuration',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}