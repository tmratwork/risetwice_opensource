// src/app/api/ai-response/route.ts

/*
This `route.ts` file:

1. **Creates a versatile AI endpoint** (`/api/ai-response`) that processes requests and returns AI-generated responses
   
2. **Handles two types of AI services**:
   - Text analysis with Claude (Anthropic)
   - Image analysis with GPT-4o (OpenAI)

3. **Routes requests based on content type**:
   - JSON requests → Claude for text analysis
   - FormData requests → OpenAI for image analysis

4. **Processes different inputs**:
   - For text: Takes `systemPrompt` and `userPrompt` in JSON
   - For images: Takes an image file, optional system prompt, and user prompt

5. **Manages API communication**:
   - Handles authentication with the respective AI providers
   - Formats requests properly for each service
   - Processes the responses

6. **Implements robust error handling**:
   - Detailed logging of requests, responses, and errors
   - Customized error messages based on error types
   - Development vs. production error detail control

7. **Provides fallbacks**:
   - Mock responses when API keys aren't configured
   - Appropriate error responses for various failure scenarios

*/

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 300; // Set maximum duration allowed for HTTP call request response to 300 seconds (5 minutes)
export const dynamic = 'force-dynamic';

// Map to track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<Response>>();

// Initialize OpenAI client if key exists
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Helper function to log and format errors
function logError(context: string, error: unknown) {
  const errorDetails = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    type: error instanceof Error ? error.constructor.name : 'Unknown',
    cause: error instanceof Error ? error.cause : undefined,
    name: error instanceof Error ? error.name : 'Unknown Error',
    code: error instanceof Error && 'code' in error ? (error as { code: string | number }).code : undefined,
    statusCode: error instanceof Error && 'statusCode' in error ? (error as { statusCode: number }).statusCode : undefined,
    status: error instanceof Error && 'status' in error ? (error as { status: number }).status : undefined,
  };

  console.error(`AI Response API Error in ${context}:`, errorDetails);
  return errorDetails;
}

export async function POST(req: NextRequest) {
  const requestId = Date.now().toString();

  try {
    // Generate a request fingerprint to deduplicate identical in-flight requests
    const contentType = req.headers.get('content-type') || '';
    let requestFingerprint = '';

    // Only try to deduplicate JSON requests (text analysis)
    // Clone the request to read the body without consuming it
    if (contentType.includes('application/json')) {
      try {
        const clone = req.clone();
        const body = await clone.json();
        requestFingerprint = JSON.stringify(body);

        // Check if an identical request is already in progress
        if (inFlightRequests.has(requestFingerprint)) {
          console.log(`[Request ${requestId}] 🔄 Duplicate request detected, reusing existing response`);
          return inFlightRequests.get(requestFingerprint);
        }
      } catch (fingerprintError) {
        console.error(`[Request ${requestId}] Unable to generate fingerprint:`, fingerprintError);
        // Continue processing even if fingerprinting fails
      }
    }

    if (contentType.includes('application/json')) {
      console.log(`[Request ${requestId}] Starting text analysis request with Claude`);

      // Create the response promise
      const responsePromise = handleTextAnalysis(req, requestId);

      // Store the promise for potential reuse if we have a fingerprint
      if (requestFingerprint) {
        inFlightRequests.set(requestFingerprint, responsePromise);
        console.log(`[Request ${requestId}] 🔒 Request stored for deduplication with fingerprint`);

        // Clean up the in-flight request after the response is sent
        // Using a longer delay (5s) to catch rapid duplicate requests
        responsePromise.finally(() => {
          setTimeout(() => {
            if (inFlightRequests.has(requestFingerprint)) {
              inFlightRequests.delete(requestFingerprint);
              console.log(`[Request ${requestId}] 🔓 Request removed from fingerprint tracking`);
            }
          }, 5000);
        });
      }

      return responsePromise;
    } else {
      console.log(`[Request ${requestId}] Starting image analysis request with OpenAI`);
      return await handleImageAnalysis(req, requestId);
    }
  } catch (error) {
    const errorDetails = logError('POST handler', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        requestId,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

// Handle image analysis requests
async function handleImageAnalysis(req: NextRequest, requestId: string) {
  try {
    // Parse form data
    const formData = await req.formData();
    const imageFile = formData.get('image') as File;
    const systemPrompt = formData.get('systemPrompt') as string; // Get the system prompt
    const userPrompt = formData.get('userPrompt') as string; // Get the user prompt

    console.log(`[Request ${requestId}] Image analysis request with prompts: ${systemPrompt ? 'system provided' : 'system not provided'}, ${userPrompt ? 'user provided' : 'user not provided'}`);

    if (!imageFile) {
      console.error(`[Request ${requestId}] No image provided in request`);
      return NextResponse.json(
        {
          error: 'No image provided',
          requestId
        },
        { status: 400 }
      );
    }

    console.log(`[Request ${requestId}] Image file received: ${imageFile.name}, type: ${imageFile.type}, size: ${imageFile.size} bytes`);

    // Ensure we have a valid image file
    if (!imageFile.type.startsWith('image/')) {
      console.error(`[Request ${requestId}] Invalid file type: ${imageFile.type}`);
      return NextResponse.json(
        {
          error: 'File does not appear to be an image',
          requestId,
          fileType: imageFile.type
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    try {
      const bytes = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      console.log(`[Request ${requestId}] Converted to buffer: ${buffer.length} bytes`);

      if (buffer.length === 0) {
        console.error(`[Request ${requestId}] Empty buffer created from image file`);
        return NextResponse.json(
          {
            error: 'Empty image file provided',
            requestId
          },
          { status: 400 }
        );
      }

      if (openai) {
        // Use OpenAI for analysis with the prompts if provided
        try {
          const analysisStart = Date.now();
          console.log(`[Request ${requestId}] Starting OpenAI analysis...`);
          const analysisResult = await analyzeWithOpenAI(buffer, systemPrompt, userPrompt, requestId);
          console.log(`[Request ${requestId}] Analysis completed in ${Date.now() - analysisStart}ms`);
          return NextResponse.json({
            ...analysisResult,
            requestId
          });
        } catch (error) {
          const errorDetails = logError('OpenAI analysis', error);

          return NextResponse.json(
            {
              error: 'Error analyzing image with OpenAI',
              requestId,
              details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            },
            { status: 500 }
          );
        }
      } else {
        // No API keys available, use mock response
        console.log(`[Request ${requestId}] No OpenAI API key available, using mock response`);
        return NextResponse.json({
          ...generateMockResponse(),
          requestId
        });
      }
    } catch (error) {
      const errorDetails = logError('image buffer conversion', error);

      return NextResponse.json(
        {
          error: 'Error processing image data',
          requestId,
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        },
        { status: 400 }
      );
    }
  } catch (error) {
    const errorDetails = logError('image analysis', error);

    return NextResponse.json(
      {
        error: 'Error processing image',
        requestId,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

interface AnalysisResult {
  description: string;
}

// Image analysis using OpenAI
async function analyzeWithOpenAI(
  imageBuffer: Buffer,
  systemPrompt?: string,
  userPrompt?: string,
  requestId?: string
): Promise<AnalysisResult> {
  try {
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    const base64Image = imageBuffer.toString('base64');
    console.log(`[Request ${requestId}] Converted image to base64 (length: ${base64Image.length})`);

    // Default prompts if not provided
    const defaultSystemPrompt = "You analyze images and provide detailed descriptions.";
    const defaultUserPrompt = "Please provide a detailed description of this image in about 2-3 paragraphs. Focus on what is shown, important features, and any relevant context.";

    // Use provided prompts if available, otherwise use defaults
    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
    const finalUserPrompt = userPrompt || defaultUserPrompt;

    console.log(`[Request ${requestId}] Using ${systemPrompt ? 'custom' : 'default'} system prompt and ${userPrompt ? 'custom' : 'default'} user prompt for analysis`);

    try {
      console.log(`[Request ${requestId}] Sending request to OpenAI API (model: gpt-4o)`);
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: finalSystemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high"
                }
              },
              {
                type: "text",
                text: finalUserPrompt
              }
            ]
          }
        ],
        max_tokens: 1000,
      });

      console.log(`[Request ${requestId}] Received response from OpenAI API`);

      if (!response.choices || response.choices.length === 0) {
        console.error(`[Request ${requestId}] OpenAI response missing choices:`, response);
        throw new Error('Invalid response format from OpenAI API');
      }

      return {
        description: response.choices[0]?.message?.content || "No description available",
      };
    } catch (error) {
      // Detailed OpenAI API error logging
      if (error instanceof Error) {
        console.error(`[Request ${requestId}] OpenAI API error:`, {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        });

        // Check for OpenAI specific error properties
        const openaiError = error as Error & {
          status?: number;
          headers?: Record<string, string>;
          type?: string;
        };

        if (openaiError.status) {
          console.error(`[Request ${requestId}] OpenAI API status code: ${openaiError.status}`);
        }

        if (openaiError.headers) {
          console.error(`[Request ${requestId}] OpenAI API response headers:`, openaiError.headers);
        }

        if (openaiError.type) {
          console.error(`[Request ${requestId}] OpenAI error type: ${openaiError.type}`);
        }
      }

      throw error;
    }
  } catch (error) {
    const errorDetails = logError('OpenAI analysis function', error);
    console.error(`[Request ${requestId}] Error with OpenAI analysis:`, errorDetails);
    throw new Error(`Failed to analyze with OpenAI: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Handle text analysis with Claude
async function handleTextAnalysis(req: NextRequest, requestId: string) {
  try {
    // Advanced request logging
    const url = req.url;
    const method = req.method;
    const headersLog: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (!key.includes('authorization') && !key.includes('cookie')) {
        headersLog[key] = value;
      }
    });

    console.log(`[Request ${requestId}] Full request details:`, {
      method,
      url,
      headers: headersLog,
      clientIp: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown'
    });

    let data;
    try {
      data = await req.json();
      const promptLength = data.userPrompt?.length || 0;
      const systemLength = data.systemPrompt?.length || 0;

      console.log(`[Request ${requestId}] Request body size check - System: ${systemLength} chars, User: ${promptLength} chars`);

      // Check if request is too large (20MB is a good estimate for max size)
      const estimatedSizeKB = (JSON.stringify(data).length / 1024).toFixed(2);
      console.log(`[Request ${requestId}] Estimated request size: ${estimatedSizeKB}KB`);

      if (parseInt(estimatedSizeKB) > 20000) {
        console.error(`[Request ${requestId}] ⚠️ Request size too large: ${estimatedSizeKB}KB`);
        return NextResponse.json(
          {
            error: 'Request payload too large',
            requestId
          },
          { status: 413 }
        );
      }
    } catch (parseError) {
      console.error(`[Request ${requestId}] ❌ Failed to parse JSON:`, parseError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          requestId,
          details: process.env.NODE_ENV === 'development' ? String(parseError) : undefined
        },
        { status: 400 }
      );
    }

    const { systemPrompt, userPrompt } = data;

    console.log(`[Request ${requestId}] Text analysis request with prompts: ${systemPrompt ? 'system provided' : 'system not provided'}, ${userPrompt ? 'user provided' : 'user not provided'}`);

    if (!userPrompt) {
      console.error(`[Request ${requestId}] No user prompt provided in request`);
      return NextResponse.json(
        {
          error: 'No user prompt provided',
          requestId
        },
        { status: 400 }
      );
    }

    // Import anthropic from our library
    let anthropic;
    try {
      const anthropicModule = await import('@/lib/anthropic');
      anthropic = anthropicModule.anthropic;

      if (!anthropic) {
        console.error(`[Request ${requestId}] ❌ Failed to import Anthropic client - client is null or undefined`);
        throw new Error('Failed to initialize Anthropic client');
      }
    } catch (importError) {
      console.error(`[Request ${requestId}] ❌ Failed to import Anthropic module:`, importError);
      return NextResponse.json(
        {
          error: 'Failed to initialize AI client',
          requestId,
          details: process.env.NODE_ENV === 'development' ? String(importError) : undefined
        },
        { status: 500 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.log(`[Request ${requestId}] No Anthropic API key available, using mock response`);
      return NextResponse.json({
        ...generateMockClaudeResponse(),
        requestId
      });
    }

    try {
      const analysisStart = Date.now();
      console.log(`[Request ${requestId}] Starting Claude analysis at ${new Date(analysisStart).toISOString()}...`);
      console.log(`[Request ${requestId}] Using model: claude-sonnet-4-20250514`);

      // Use Claude for analysis
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096, // this is the max token for this model
        system: systemPrompt || "You are a helpful AI assistant specializing in mathematics education.",
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ],
      });

      const analysisEnd = Date.now();
      console.log(`[Request ${requestId}] Claude analysis completed in ${analysisEnd - analysisStart}ms at ${new Date(analysisEnd).toISOString()}`);

      // Add detailed logging of the response content
      if (response.content && response.content.length > 0) {
        // Check content type and safely access text property
        const content = response.content[0];
        const textContent = content.type === 'text' ? content.text : '';

        console.log(`[Request ${requestId}] Claude response content length: ${textContent?.length || 0} chars`);
        // Only log a small sample for debugging - avoiding large content that can block event loop
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Request ${requestId}] Claude response content sample: ${textContent?.substring(0, 50)}...`);
        }
        console.log(`[Request ${requestId}] Claude response ID: ${response.id}`);
        console.log(`[Request ${requestId}] Claude model used: ${response.model}`);
        console.log(`[Request ${requestId}] Claude stop reason: ${response.stop_reason || 'None'}`);
        console.log(`[Request ${requestId}] Claude usage tokens: ${JSON.stringify(response.usage || {})}`);
      } else {
        console.error(`[Request ${requestId}] ⚠️ WARNING: Empty or missing content in Claude response:`, response);
      }

      // Safely extract text from the content block
      const description = response.content && response.content.length > 0 && response.content[0].type === 'text'
        ? response.content[0].text
        : "No analysis available";

      // Check if the response was truncated (max_tokens limit)
      const wasTruncated = response.stop_reason === 'max_tokens';

      // Add inspection step for JSON content if truncated
      let jsonValidationResult = null;
      if (wasTruncated && description) {
        console.log(`[Request ${requestId}] Response was truncated (max_tokens reached), checking for JSON validity`);
        jsonValidationResult = validateAndRepairJson(description);
        console.log(`[Request ${requestId}] JSON validation result: ${jsonValidationResult ? 'Attempted repair' : 'No JSON detected or unrepairable'}`);
      }

      return NextResponse.json({
        description: jsonValidationResult?.repairedJson || description,
        requestId,
        modelUsed: response.model,
        usage: response.usage,
        completed: true,
        wasTruncated,
        jsonRepaired: !!jsonValidationResult?.wasRepaired
      });
    } catch (error: unknown) {
      const errorDetails = logError('Claude analysis', error);
      console.error(`[Request ${requestId}] ❌ ❌ ❌ Claude API error:`, error);

      // Specific handling for network errors
      if (error instanceof Error) {
        if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
          console.error(`[Request ${requestId}] ❌ NETWORK ERROR: This might be due to connectivity issues or a problem with the Anthropic API`);

          return NextResponse.json(
            {
              error: 'Network error while connecting to AI service',
              requestId,
              errorType: 'NETWORK_ERROR',
              details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            },
            { status: 503 } // Service Unavailable
          );
        }

        // Check for rate limit errors
        const errorObj = error as Error & { status?: number };
        if (errorObj.status === 429 || (error.message && error.message.includes('rate'))) {
          console.error(`[Request ${requestId}] ❌ RATE LIMIT ERROR: The API request was rate limited`);

          return NextResponse.json(
            {
              error: 'AI service rate limit exceeded. Please try again later.',
              requestId,
              errorType: 'RATE_LIMIT',
              details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
            },
            { status: 429 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Error analyzing text with Claude',
          requestId,
          errorType: 'API_ERROR',
          details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorDetails = logError('text analysis', error);
    console.error(`[Request ${requestId}] ❌ ❌ ❌ Unhandled error in text analysis:`, error);

    return NextResponse.json(
      {
        error: 'Error processing text analysis request',
        requestId,
        errorType: 'SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

function generateMockResponse(): AnalysisResult {
  return {
    description: "This is a mock image analysis response since no API keys were configured. In a real scenario, this would contain a detailed analysis of the mathematics homework, including which problems have incorrect answers and why."
  };
}

function generateMockClaudeResponse(): AnalysisResult {
  return {
    description: "This is a mock Claude analysis response since no API keys were configured. In a real scenario, this would contain a detailed analysis of the OCR text, identifying mathematical errors and providing feedback."
  };
}

// Validate and repair truncated JSON responses
function validateAndRepairJson(text: string): { wasRepaired: boolean; repairedJson: string } | null {
  try {
    // Skip non-JSON responses
    if (!text.includes('```json') && !text.startsWith('{')) {
      return null;
    }

    // Extract JSON content if wrapped in markdown code blocks
    let jsonContent = text;
    if (text.includes('```json')) {
      const match = text.match(/```json\s*([\s\S]*?)(?:```|$)/);
      if (match && match[1]) {
        jsonContent = match[1].trim();
      }
    }

    // Check if already valid JSON
    try {
      JSON.parse(jsonContent);
      return { wasRepaired: false, repairedJson: jsonContent };
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_) {
      // Not valid JSON, attempt repair
    }

    // Count open and close braces
    const openBraces = (jsonContent.match(/{/g) || []).length;
    const closeBraces = (jsonContent.match(/}/g) || []).length;

    // If missing closing braces, add them
    if (openBraces > closeBraces) {
      const missingBraces = openBraces - closeBraces;
      const repairedJson = jsonContent + "}".repeat(missingBraces);

      // Verify if the repaired JSON is valid
      try {
        JSON.parse(repairedJson);
        return { wasRepaired: true, repairedJson };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // Repair attempt failed
      }
    }

    // Try to extract partial valid JSON content by finding the largest valid object
    let extractedJson = null;
    let currentIndex = 0;

    // Try to find the largest valid JSON object
    while (currentIndex < jsonContent.length) {
      const startBrace = jsonContent.indexOf('{', currentIndex);
      if (startBrace === -1) break;

      for (let endIndex = jsonContent.length; endIndex > startBrace; endIndex--) {
        try {
          const potentialJson = jsonContent.substring(startBrace, endIndex) + "}".repeat(openBraces - closeBraces);
          JSON.parse(potentialJson);
          if (!extractedJson || potentialJson.length > extractedJson.length) {
            extractedJson = potentialJson;
          }
          break;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
          // This substring is not valid JSON, continue trying
        }
      }

      currentIndex = startBrace + 1;
    }

    if (extractedJson) {
      return { wasRepaired: true, repairedJson: extractedJson };
    }

    return null;
  } catch (e) {
    console.error("Error in validateAndRepairJson:", e);
    return null;
  }
}

