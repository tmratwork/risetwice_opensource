// src/app/api/v15/session

import { NextResponse } from 'next/server';
import { MODELS } from '@/config/models';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * V15 endpoint for creating OpenAI Realtime API sessions
 * Adapted from V11 with V15-specific configurations
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
      // CONFIGURATION ERROR - Cannot start session with corrupted settings
      console.error("CONFIGURATION ERROR - Cannot parse session configuration:", error);
      return NextResponse.json({
        error: "CONFIGURATION ERROR - Cannot start session with corrupted settings",
        details: `Failed to parse session configuration: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Ensure the request body contains valid JSON configuration data"
      }, { status: 400 });
    }

    // Log what we're sending to OpenAI
    const openaiPayload = {
      model: MODELS.OPENAI.GPT_REALTIME,
      voice: config.voice || "alloy",
      modalities: ["audio", "text"],
      instructions: config.instructions || "You are a helpful AI companion for mental health support and educational assistance.",
      tool_choice: config.tool_choice || "auto",
      tools: config.tools,
    };

    // Log payload instructions to file instead of console to avoid truncation
    const logData = {
      timestamp: new Date().toISOString(),
      model: openaiPayload.model,
      voice: openaiPayload.voice,
      modalities: openaiPayload.modalities,
      tool_choice: openaiPayload.tool_choice,
      tools_count: openaiPayload.tools?.length || 0,
      instructions_length: openaiPayload.instructions?.length || 0,
      instructions: openaiPayload.instructions || 'NO INSTRUCTIONS PROVIDED',
      greeting_instructions: config.greetingInstructions || 'NO GREETING INSTRUCTIONS PROVIDED'
    };
    
    const logFile = path.join(process.cwd(), 'logs', 'v15-session-payload.log');
    
    try {
      // Check if logging is enabled via environment variable
      if (process.env.ENABLE_V15_SESSION_LOGS === 'true') {
        // Ensure logs directory exists
        const logsDir = path.dirname(logFile);
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Append to log file
        fs.appendFileSync(logFile, JSON.stringify(logData, null, 2) + '\n---\n');
      }
      
      // Log resource greeting instructions
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] Session API: received config', {
          greetingInstructions: config.greetingInstructions,
          hasGreetingInstructions: !!config.greetingInstructions,
          greetingInstructionsLength: config.greetingInstructions?.length || 0,
          greetingPreview: config.greetingInstructions?.substring(0, 200) + '...' || 'null',
          configKeys: Object.keys(config)
        });
      }
    } catch (error) {
      console.error('[V15-SESSION] Failed to log payload to file:', error);
    }

    console.log('[payloadToOpenAI][[AI_instructions] ===== FUNCTION TOOLS SENT TO AI =====');
    console.log('[payloadToOpenAI][[AI_instructions] Function Count:', openaiPayload.tools?.length || 0);
    if (openaiPayload.tools && openaiPayload.tools.length > 0) {
      console.log('[payloadToOpenAI][[AI_instructions] COMPLETE FUNCTION DEFINITIONS:');
      openaiPayload.tools.forEach((tool: unknown, index: number) => {
        const typedTool = tool as { name: string; description?: string; parameters?: Record<string, unknown> };
        console.log(`[payloadToOpenAI][[AI_instructions] === FUNCTION ${index + 1}: ${typedTool.name} ===`);
        console.log('[payloadToOpenAI][[AI_instructions] Full Function Definition:', JSON.stringify(tool, null, 2));
        console.log(`[payloadToOpenAI][[AI_instructions] === END FUNCTION ${index + 1} ===`);
      });
    } else {
      console.log('[payloadToOpenAI][[AI_instructions] NO FUNCTION TOOLS PROVIDED TO AI');
    }
    console.log('[payloadToOpenAI][[AI_instructions] ===== END OF FUNCTION TOOLS =====');

    console.log('[payloadToOpenAI][[AI_instructions] ===== COMPLETE JSON PAYLOAD TO OPENAI =====');
    console.log('[payloadToOpenAI][[AI_instructions] FULL OPENAI PAYLOAD:');
    console.log('[payloadToOpenAI][[AI_instructions]', JSON.stringify(openaiPayload, null, 2));
    console.log('[payloadToOpenAI][[AI_instructions] ===== END OF COMPLETE PAYLOAD =====');

    if (openaiPayload.tools && openaiPayload.tools.length > 0) {
      const resourceFunction = openaiPayload.tools.find((tool: { name: string }) => tool.name === 'search_resources_unified');
      if (resourceFunction) {
        console.log('[payloadToOpenAI][[functionCallDiagnosis] ✅ search_resources_unified being sent to OpenAI');
        console.log('[payloadToOpenAI][[functionCallDiagnosis] OpenAI function description:', (resourceFunction as { description?: string }).description?.substring(0, 200) + '...');
      } else {
        console.log('[payloadToOpenAI][[functionCallDiagnosis] ❌ search_resources_unified NOT found in OpenAI payload!');
        console.log('[payloadToOpenAI][[functionCallDiagnosis] Functions being sent to OpenAI:', openaiPayload.tools.map((tool: { name: string }) => tool.name));
      }
    } else {
      console.log('[payloadToOpenAI][[functionCallDiagnosis] ❌ NO TOOLS being sent to OpenAI!');
    }

    // Log the exact payload being sent to OpenAI
    try {
      if (process.env.ENABLE_V15_SESSION_LOGS === 'true') {
        const logFile = path.join(process.cwd(), 'logs', 'v15-session-payload.log');
        const logsDir = path.dirname(logFile);
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const payloadLog = {
          timestamp: new Date().toISOString(),
          event: 'SENDING_TO_OPENAI',
          payload: JSON.stringify(openaiPayload)
        };
        
        fs.appendFileSync(logFile, JSON.stringify(payloadLog, null, 2) + '\n---\n');
      }
    } catch (error) {
      console.error('[V15-SESSION] Failed to log OpenAI payload:', error);
    }

    // Create session with OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`V15 API request failed with status ${response.status}: ${errorText}`);
      return NextResponse.json({
        error: `Failed to create V15 session: ${response.status} ${response.statusText}`,
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();
    console.log("V15 Session created successfully with ID:", data.id);

    // Log OpenAI's response about the session
    console.log('[functionCallDiagnosis] ===== OPENAI SESSION RESPONSE =====');
    console.log('[functionCallDiagnosis] Session ID:', data.id);
    console.log('[functionCallDiagnosis] OpenAI accepted tools:', !!data.tools);
    console.log('[functionCallDiagnosis] OpenAI tool count:', data.tools?.length || 0);
    if (data.tools && data.tools.length > 0) {
      const resourceFunctionAccepted = data.tools.find((tool: { name: string }) => tool.name === 'search_resources_unified');
      if (resourceFunctionAccepted) {
        console.log('[functionCallDiagnosis] ✅ OpenAI accepted search_resources_unified');
      } else {
        console.log('[functionCallDiagnosis] ❌ OpenAI did not accept search_resources_unified');
        console.log('[functionCallDiagnosis] OpenAI accepted functions:', data.tools.map((tool: { name: string }) => tool.name));
      }
    }

    // Return the ephemeral token to the client
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating V15 session:", error);
    return NextResponse.json({
      error: "Failed to create V15 session",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}