// src/app/api/v17/signed-url/route.ts
// V17 Eleven Labs Signed URL API - Server-side authentication

import { NextRequest, NextResponse } from 'next/server';

// Conditional logging for V17
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

export async function POST(request: NextRequest) {
  try {
    logV17('🔐 Signed URL request received');

    // Get request data
    const body = await request.json();
    const { agentId, includeConversationId = false } = body;

    if (!agentId) {
      logV17('❌ Missing agentId in request');
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      );
    }

    // Validate API key
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      logV17('❌ Missing ELEVENLABS_API_KEY environment variable');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    logV17('🔑 Requesting signed URL from Eleven Labs', { agentId, includeConversationId });

    // Call Eleven Labs API for signed URL
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}${includeConversationId ? '&include_conversation_id=true' : ''}`;
    
    const response = await fetch(elevenLabsUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logV17('❌ Eleven Labs API error', { 
        status: response.status, 
        error: errorText 
      });
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    logV17('✅ Signed URL generated successfully', { 
      hasSignedUrl: !!data.signed_url,
      urlLength: data.signed_url?.length 
    });

    // Return signed URL to client
    return NextResponse.json({
      signed_url: data.signed_url,
      expires_in_minutes: 15, // Eleven Labs signed URLs expire in 15 minutes
      agent_id: agentId,
    });

  } catch (error) {
    logV17('❌ Signed URL generation failed', error);
    console.error('[V17] Signed URL API error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}