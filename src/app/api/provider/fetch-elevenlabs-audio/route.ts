// src/app/api/provider/fetch-elevenlabs-audio/route.ts
// Fetch conversation audio directly from ElevenLabs API for comparison

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { conversation_id } = await request.json();

    console.log('[elevenlabs_audio_fetch] Fetching audio for conversation:', conversation_id);

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      );
    }

    // Use server-side env var (without NEXT_PUBLIC_ prefix)
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      console.error('[elevenlabs_audio_fetch] ❌ ElevenLabs API key not configured');
      console.error('[elevenlabs_audio_fetch] Available env vars:', Object.keys(process.env).filter(k => k.includes('ELEVEN')));
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    console.log('[elevenlabs_audio_fetch] 🔑 Using API key:', elevenLabsApiKey.substring(0, 10) + '...');

    // First, try to get conversation metadata to see if it exists
    console.log('[elevenlabs_audio_fetch] 🔍 First checking if conversation exists...');
    try {
      const metadataResponse = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': elevenLabsApiKey,
          },
        }
      );

      if (metadataResponse.ok) {
        const metadata = await metadataResponse.json();
        console.log('[elevenlabs_audio_fetch] ✅ Conversation exists:', {
          conversationId: metadata.conversation_id,
          agentId: metadata.agent_id,
          status: metadata.status,
          hasAudio: metadata.audio_url ? 'yes' : 'no'
        });

        // If ElevenLabs provides a direct audio URL, use that
        if (metadata.audio_url) {
          console.log('[elevenlabs_audio_fetch] 🎵 Found audio URL in metadata:', metadata.audio_url);
          const audioResponse = await fetch(metadata.audio_url);
          if (audioResponse.ok) {
            const audioBlob = await audioResponse.blob();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Audio = buffer.toString('base64');

            return NextResponse.json({
              success: true,
              audio: {
                base64: base64Audio,
                mimeType: audioBlob.type || 'audio/mpeg',
                size: audioBlob.size,
                sizeMB: parseFloat((audioBlob.size / 1024 / 1024).toFixed(2))
              }
            });
          }
        }
      } else {
        const errorText = await metadataResponse.text();
        console.log('[elevenlabs_audio_fetch] ⚠️ Conversation not found:', errorText);
      }
    } catch (err) {
      console.log('[elevenlabs_audio_fetch] ⚠️ Error checking metadata:', err);
    }

    // Fetch conversation audio from ElevenLabs
    // Note: The correct endpoint format may vary - trying common patterns
    const endpoints = [
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation_id}/audio`,
      `https://api.elevenlabs.io/v1/convai/conversation/${conversation_id}/audio`,
      `https://api.elevenlabs.io/v1/conversations/${conversation_id}/audio`
    ];

    let audioResponse: Response | null = null;
    let lastError: string = '';

    for (const endpoint of endpoints) {
      console.log('[elevenlabs_audio_fetch] 🔄 Trying endpoint:', endpoint);

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Accept': 'audio/*'
          },
        });

        if (response.ok) {
          console.log('[elevenlabs_audio_fetch] ✅ Success with endpoint:', endpoint);
          audioResponse = response;
          break;
        } else {
          const errorText = await response.text();
          console.log('[elevenlabs_audio_fetch] ⚠️ Failed with status', response.status, ':', errorText);
          lastError = errorText;
        }
      } catch (err) {
        console.log('[elevenlabs_audio_fetch] ⚠️ Error with endpoint:', endpoint, err);
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    if (!audioResponse || !audioResponse.ok) {
      console.error('[elevenlabs_audio_fetch] ❌ All endpoints failed. Last error:', lastError);

      // Check if it's a "not found" error vs "not ready yet" error
      const isNotFound = lastError.includes('not found') || lastError.includes('not accessible');
      const isProcessing = lastError.includes('processing') || lastError.includes('not ready');

      let errorMessage = 'Failed to fetch audio from ElevenLabs';
      let suggestion = '';

      if (isNotFound) {
        errorMessage = 'Conversation audio not found';
        suggestion = 'The conversation may not have audio storage enabled. Check agent settings: Advanced → Privacy → Store Call Audio';
      } else if (isProcessing) {
        errorMessage = 'Audio is still being processed';
        suggestion = 'Wait 10-15 seconds after conversation ends, then try again';
      } else {
        errorMessage = 'Failed to retrieve audio';
        suggestion = 'Possible causes: audio storage disabled, conversation too old, or API error';
      }

      return NextResponse.json(
        {
          error: errorMessage,
          suggestion,
          details: lastError,
          triedEndpoints: endpoints
        },
        { status: 404 }
      );
    }

    // Get audio as blob
    const audioBlob = await audioResponse.blob();
    console.log('[elevenlabs_audio_fetch] ✅ Retrieved audio:', {
      size: audioBlob.size,
      type: audioBlob.type,
      sizeMB: (audioBlob.size / 1024 / 1024).toFixed(2)
    });

    // Convert blob to base64 for JSON response
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');

    return NextResponse.json({
      success: true,
      audio: {
        base64: base64Audio,
        mimeType: audioBlob.type || 'audio/mpeg',
        size: audioBlob.size,
        sizeMB: parseFloat((audioBlob.size / 1024 / 1024).toFixed(2))
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[elevenlabs_audio_fetch] ❌ API error:', errorMessage);
    console.error('[elevenlabs_audio_fetch] ❌ Stack:', errorStack);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ElevenLabs audio',
      details: errorMessage
    }, { status: 500 });
  }
}
