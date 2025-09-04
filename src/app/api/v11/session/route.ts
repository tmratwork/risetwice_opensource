import { NextResponse } from 'next/server';
import { AI_MODELS } from '@/config/ai-models';

export const dynamic = 'force-dynamic';

/**
 * This endpoint generates an ephemeral token for OpenAI Realtime API
 * Without exposing the actual API key to the client
 */
export async function POST(req: Request) {
  try {
    // Get OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY is not set in environment variables");
      return NextResponse.json({
        error: "Missing API key configuration"
      }, { status: 500 });
    }

    // Parse request body to get session configuration
    let config;
    try {
      config = await req.json();
    } catch (error) {
      // Default configuration if no body is provided
      config = {
        voice: "alloy",
        model: AI_MODELS.DEFAULTS.REALTIME_VOICE,
        instructions: "You are a helpful assistant.",
      };
      console.error("Error parsing request body:", error);
    }

    // Create session with OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODELS.DEFAULTS.REALTIME_VOICE,
        voice: config.voice || "alloy",
        modalities: ["audio", "text"],
        instructions: config.instructions || "You are a helpful assistant.",
        tool_choice: config.tool_choice || "auto",
        tools: config.tools,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed with status ${response.status}: ${errorText}`);
      return NextResponse.json({
        error: `Failed to create session: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log("Session created successfully with ID:", data.id);

    // Return the ephemeral token to the client
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json({
      error: "Failed to create session",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}