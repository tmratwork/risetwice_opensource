// src/app/api/v17/voice-settings/route.ts
// ElevenLabs Agent Voice Settings API for V17

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

interface VoiceSettings {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

interface UpdateVoiceSettingsRequest {
  agent_id: string;
  voice_settings: VoiceSettings;
  model_family?: string;
  language?: string;
}

// V17 conditional logging
const logV17VoiceSettings = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17-voice-settings] ${message}`, ...args);
  }
};

export async function PUT(request: NextRequest) {
  try {
    const body: UpdateVoiceSettingsRequest = await request.json();
    const { agent_id, voice_settings, model_family, language } = body;

    logV17VoiceSettings('🎛️ Updating voice settings', {
      agentId: agent_id,
      settings: voice_settings,
      modelFamily: model_family,
      language
    });

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logV17VoiceSettings('❌ ElevenLabs API key not found');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    // Update ElevenLabs conversational AI agent settings
    // Use the same structure as agent creation API (conversation_config.tts)
    const updatePayload = {
      conversation_config: {
        tts: {
          ...voice_settings,
          ...(model_family && model_family !== 'same_as_agent' && { model_id: model_family }),
          ...(language && { language })
        }
      }
    };

    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agent_id}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logV17VoiceSettings('❌ ElevenLabs API error', {
        status: response.status,
        error: errorText
      });
      return NextResponse.json(
        { error: `ElevenLabs API error: ${errorText}` },
        { status: response.status }
      );
    }

    const updatedAgent = await response.json();

    logV17VoiceSettings('✅ Voice settings updated successfully', {
      agentId: agent_id,
      updatedFields: Object.keys(updatePayload)
    });

    return NextResponse.json({
      success: true,
      agent: updatedAgent
    });

  } catch (error) {
    logV17VoiceSettings('❌ Voice settings update error', error);
    return NextResponse.json(
      { error: 'Failed to update voice settings' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id');

    if (!agent_id) {
      return NextResponse.json(
        { error: 'agent_id is required' },
        { status: 400 }
      );
    }

    logV17VoiceSettings('📖 Fetching current voice settings', { agentId: agent_id });

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logV17VoiceSettings('❌ ElevenLabs API key not found');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agent_id}`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logV17VoiceSettings('❌ ElevenLabs API error', {
        status: response.status,
        error: errorText
      });
      return NextResponse.json(
        { error: `ElevenLabs API error: ${errorText}` },
        { status: response.status }
      );
    }

    const agent = await response.json();

    logV17VoiceSettings('✅ Voice settings fetched successfully', {
      agentId: agent_id,
      hasVoiceSettings: !!agent.voice_settings
    });

    return NextResponse.json({
      success: true,
      voice_settings: agent.voice_settings || {
        speed: 1.0,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        use_speaker_boost: false
      },
      model_family: agent.model_family || 'same_as_agent',
      language: agent.language || 'en'
    });

  } catch (error) {
    logV17VoiceSettings('❌ Voice settings fetch error', error);
    return NextResponse.json(
      { error: 'Failed to fetch voice settings' },
      { status: 500 }
    );
  }
}