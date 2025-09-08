// src/app/api/v17/tools/list/route.ts
// V17 ElevenLabs Tools List API - Get current tool IDs from ElevenLabs

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
    const includeDetails = url.searchParams.get('includeDetails') === 'true';

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ 
        error: 'Missing ELEVENLABS_API_KEY environment variable' 
      }, { status: 500 });
    }

    logV17('🔍 Fetching current ElevenLabs tools');

    // Get all tools from ElevenLabs
    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/tools`, {
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

    const toolsData = await response.json();
    
    // Extract tool IDs and basic info
    const tools = toolsData.tools || [];
    const toolIds = tools.map((tool: any) => tool.id);
    
    logV17('✅ Tools fetched successfully', {
      totalTools: tools.length,
      toolIds: toolIds.slice(0, 5), // Log first 5 IDs for debugging
      allToolsCount: toolIds.length
    });

    const result: any = {
      success: true,
      totalTools: tools.length,
      toolIds: toolIds
    };

    // Include detailed tool info if requested
    if (includeDetails) {
      result.tools = tools.map((tool: any) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        type: tool.type,
        created_at: tool.created_at,
        updated_at: tool.updated_at
      }));
    }

    return NextResponse.json(result);

  } catch (error) {
    logV17('❌ Error fetching tools', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({ 
      error: 'Failed to fetch tools',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}