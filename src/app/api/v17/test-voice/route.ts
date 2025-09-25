// src/app/api/v17/test-voice/route.ts
// ElevenLabs Voice Testing API for V17

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

interface VoiceSettings {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

interface TestVoiceRequest {
  agent_id?: string;
  voice_id?: string;
  text: string;
  voice_settings: VoiceSettings;
  model_family?: string;
  language?: string;
  demo_mode?: boolean;
}

// V17 conditional logging
const logV17VoiceTest = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17-voice-test] ${message}`, ...args);
  }
};

export async function POST(request: NextRequest) {
  try {
    const body: TestVoiceRequest = await request.json();
    const { agent_id, voice_id, text, voice_settings, model_family, language, demo_mode } = body;

    logV17VoiceTest('🎵 Testing voice settings', {
      agentId: agent_id,
      voiceId: voice_id,
      textLength: text?.length || 0,
      settings: voice_settings,
      modelFamily: model_family,
      language,
      demoMode: demo_mode
    });

    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    if (!agent_id && !voice_id) {
      return NextResponse.json(
        { error: 'either agent_id or voice_id is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logV17VoiceTest('❌ ElevenLabs API key not found');
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    let finalVoiceId = voice_id;

    if (agent_id && !voice_id) {
      // Get voice_id from agent
      const agentResponse = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${agent_id}`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!agentResponse.ok) {
        const errorText = await agentResponse.text();
        logV17VoiceTest('❌ Failed to fetch agent', {
          status: agentResponse.status,
          error: errorText
        });
        return NextResponse.json(
          { error: `Failed to fetch agent: ${errorText}` },
          { status: agentResponse.status }
        );
      }

      const agent = await agentResponse.json();
      finalVoiceId = agent.voice_id;

      if (!finalVoiceId) {
        logV17VoiceTest('❌ No voice_id found for agent', { agentId: agent_id });
        return NextResponse.json(
          { error: 'Agent does not have a voice_id' },
          { status: 400 }
        );
      }

      logV17VoiceTest('📥 Using voice from agent', {
        agentId: agent_id,
        voiceId: finalVoiceId
      });
    } else {
      logV17VoiceTest('📥 Using direct voice_id', {
        voiceId: finalVoiceId,
        demoMode: demo_mode
      });
    }

    // Generate audio using the ElevenLabs TTS API with the test settings
    const ttsPayload = {
      text: text,
      voice_settings: {
        stability: voice_settings.stability,
        similarity_boost: voice_settings.similarity_boost,
        style: voice_settings.style || 0,
        use_speaker_boost: voice_settings.use_speaker_boost || false,
        speed: voice_settings.speed || 1.0  // ✅ ADD SPEED PARAMETER - this was missing!
      },
      ...(model_family && model_family !== 'same_as_agent' && { model_id: model_family })
    };

    const ttsResponse = await fetch(`${ELEVENLABS_API_BASE}/text-to-speech/${finalVoiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ttsPayload)
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      logV17VoiceTest('❌ ElevenLabs TTS error', {
        status: ttsResponse.status,
        error: errorText
      });
      return NextResponse.json(
        { error: `ElevenLabs TTS error: ${errorText}` },
        { status: ttsResponse.status }
      );
    }

    // Get the audio data as buffer
    const audioBuffer = await ttsResponse.arrayBuffer();

    logV17VoiceTest('✅ Voice test audio generated successfully', {
      agentId: agent_id,
      voiceId: finalVoiceId,
      audioSize: audioBuffer.byteLength,
      demoMode: demo_mode
    });

    // Return the audio as a blob URL or base64
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: `data:audio/mpeg;base64,${audioBase64}`,
      voice_id: finalVoiceId,
      settings_used: voice_settings,
      demo_mode: demo_mode
    });

  } catch (error) {
    logV17VoiceTest('❌ Voice test error', error);
    return NextResponse.json(
      { error: 'Failed to test voice settings' },
      { status: 500 }
    );
  }
}