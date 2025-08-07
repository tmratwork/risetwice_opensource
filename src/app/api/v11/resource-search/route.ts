// file: src/app/api/v11/resource-search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { logProgressUpdateServer } from '@/utils/server-logger';

// Anthropic streaming event types
interface StreamEvent {
  type: string;
  content_block?: {
    type: string;
    name?: string;
  };
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
  };
  input?: {
    query?: string;
  };
  name?: string;
  message?: {
    model?: string;
  };
}

// Server-side logging function for map function debugging
const logMapFunctionServer = (level: string, category: string, operation: string, data: Record<string, unknown>) => {
  if (process.env.NEXT_PUBLIC_ENABLE_MAP_FUNCTION_LOGS === 'true') {
    const timestamp = new Date().toISOString();
    // Console logging for immediate debugging
    console.log(`[map_function] [SERVER] ${operation}`, data);

    // File logging as required by logging standards
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFile = path.join(logsDir, 'map_function.log');
    const logLine = `${timestamp} [${level}] [${category}] ${operation}: ${JSON.stringify(data)}\n`;

    try {
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to map function log file:', error);
    }
  }
};

interface SearchRequestBody {
  query: string;
  resource_type?: string;
  location_specific?: boolean;
  location?: string;
  userId?: string;
  searchId?: string;
  requestId?: string; // Request ID for progress tracking
  mapView?: boolean; // New flag to indicate if map view is needed
}

export interface Resource {
  name: string;
  description: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  resource_type: string;
  type?: string;  // Matches the "type" field in JSON response
  address?: string | null;
  location?: string;
  hours?: string | null;
  eligibility?: string | null;
  costs?: string | null;
  languages?: string | null;
  accessibility?: string | null;
  notes?: string | null;
  verified: boolean;
  citation_index: number;
  availability?: string;
  coordinates?: [number, number]; // [longitude, latitude]
  relevance_score?: number;
}

export interface Citation {
  title?: string;
  url: string;
}


interface SearchResults {
  content: ContentBlock[];
  citations: Citation[];
  requestId?: string;
}

// Type for Anthropic response with citations extension
interface AnthropicResponseWithCitations extends Anthropic.Messages.Message {
  citations?: Citation[];
}

// Interface for Anthropic API response content blocks
interface AnthropicContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

// Interface for our internal ContentBlock structure, made compatible with Anthropic's types
interface ContentBlock {
  type: string;  // Use string to accept any type from Anthropic API 
  text?: string;
  [key: string]: unknown;  // Index signature to accept any properties
}

// For type checking Anthropic errors
interface AnthropicError {
  status?: number;
  type?: string;
  message?: string;
}

interface FormattedResults {
  summary: string;
  resources: Resource[];
  result_count: number;
  query_context: {
    resource_type: string;
    location_specific: boolean;
    location: string;
    mapView?: boolean;
  };
  raw_content: string;
  citation_links: Citation[];
  formatted_response: string;
  requestId?: string;
}

/**
 * Second Claude API call to format raw search results into clean JSON
 */
async function formatSearchResultsWithClaude(rawContent: string, requestId: string, location?: string): Promise<Resource[]> {
  console.log(`[RESOURCE-SEARCH-${requestId}] Making Claude formatting call...`);

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const formatPrompt = location ?
    `Extract and structure ONLY the resources that are located in ${location} from the search results below.

CRITICAL: Only include resources that have addresses in ${location}. Exclude any resources from other cities or states.

SEARCH RESULTS TO PROCESS:
${rawContent}

Please structure ONLY the ${location} resources in this JSON format:
{
  "resources": [
    {
      "name": "Organization Name",
      "address": "Complete street address with city, state, zip",
      "phone": "Phone number", 
      "description": "Brief description of services",
      "type": "Type of service",
      "verified": false,
      "website": "Website URL if mentioned",
      "contact": "Primary contact method"
    }
  ]
}

Requirements:
- ONLY include organizations physically located in ${location}
- Must have complete physical addresses in ${location}
- Exclude national hotlines unless they have a physical office in ${location}
- Exclude online-only services unless specifically for ${location} residents
- Exclude any organization with an address outside of ${location}

Return the structured data as clean JSON.` :
    `Extract and structure the resources from the search results below.

SEARCH RESULTS TO PROCESS:
${rawContent}

Please structure the resources you find in this JSON format:
{
  "resources": [
    {
      "name": "Organization Name",
      "address": "Complete street address with city, state, zip",
      "phone": "Phone number", 
      "description": "Brief description of services",
      "type": "Type of service",
      "verified": false,
      "website": "Website URL if mentioned",
      "contact": "Primary contact method"
    }
  ]
}

Focus on:
- Real organizations that provide actual services
- Complete physical addresses
- Excluding directories like 211 or general information sites
- Organizations with actual physical locations

Return the structured data as clean JSON.`;

  let responseContent = '';

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [
        { role: "user", content: formatPrompt }
      ]
    });

    // Extract the response content
    responseContent = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n\n');

    console.log(`[RESOURCE-SEARCH-${requestId}] Claude formatting response length: ${responseContent.length}`);

    // Strip markdown code blocks if present
    let cleanedContent = responseContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7); // Remove ```json
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3); // Remove ```
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3); // Remove trailing ```
    }
    cleanedContent = cleanedContent.trim();

    // Parse the JSON response
    let parsedData: { resources?: Record<string, unknown>[] };
    try {
      parsedData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error(`[RESOURCE-SEARCH-${requestId}] Failed to parse JSON: ${parseError}`);
      // Return empty array if parsing fails
      return [];
    }

    const resourceArray = parsedData.resources || [];

    if (location) {
      console.log(`[RESOURCE-SEARCH-${requestId}] Filtering resources for location: ${location}`);
      console.log(`[RESOURCE-SEARCH-${requestId}] Resources before filtering: ${resourceArray.length}`);
    }

    // Convert to our Resource format
    const resources: Resource[] = resourceArray.map((r: Record<string, unknown>) => ({
      name: String(r.name || ''),
      description: String(r.description || ''),
      address: r.address ? String(r.address) : null,
      phone: r.phone ? String(r.phone) : null,
      contact: r.contact ? String(r.contact) : (r.phone ? String(r.phone) : null),
      website: r.website ? String(r.website) : null,
      type: r.type ? String(r.type) : undefined,
      resource_type: r.type ? String(r.type) : 'general',
      verified: Boolean(r.verified || false),
      citation_index: -1,
      location: r.address ? String(r.address) : undefined
    }));

    // Filter for valid resources
    const validResources = resources.filter(r =>
      r.name &&
      r.name.length > 5 &&
      r.address &&
      r.address.length > 10 &&
      !r.name.toLowerCase().includes('211')
    );

    console.log(`[RESOURCE-SEARCH-${requestId}] ✅ Claude formatting successful: ${validResources.length} valid resources`);

    if (location && validResources.length > 0) {
      // Log a sample to verify they're from the right location
      console.log(`[RESOURCE-SEARCH-${requestId}] Sample formatted resources:`);
      validResources.slice(0, 3).forEach((r, i) => {
        console.log(`[RESOURCE-SEARCH-${requestId}]   ${i + 1}. ${r.name} - ${r.address}`);
      });
    }

    return validResources;

  } catch (error) {
    console.error(`[RESOURCE-SEARCH-${requestId}] ❌ Claude formatting failed: ${error}`);

    // If it's a JSON parse error, log the content for debugging
    if (error instanceof SyntaxError) {
      console.error(`[RESOURCE-SEARCH-${requestId}] Raw content that failed to parse:`, responseContent?.substring(0, 500));
    }

    // Return empty array instead of throwing
    return [];
  }
}

/**
 * API route for searching mental health resources via Anthropic web search
 * This endpoint uses Claude's web search capabilities to find up-to-date mental health resources
 */
export async function POST(request: NextRequest) {
  const body: SearchRequestBody = await request.json();
  const requestId = body.requestId || uuidv4().substring(0, 8);

  // Logging helper following logging_method.md
  const logProgressUpdate = (msg: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_PROGRESS_UPDATE_LOGS === 'true') {
      console.log(`[progress_update] ${msg}`, ...args);
    }
  };

  logProgressUpdate(`Resource search request received`, {
    requestId,
    userId: body.userId || 'anonymous',
    hasUserId: !!body.userId,
    query: body.query,
    location: body.location || 'not specified'
  });

  try {
    console.log(`[RESOURCE-SEARCH-${requestId}] 🔍 Processing resource search request`);
    console.log(`[RESOURCE-SEARCH-${requestId}] Using ${body.requestId ? 'provided' : 'generated'} request ID`);


    // Log the resource search request for map function debugging
    logMapFunctionServer('INFO', 'RESOURCE_SEARCH', 'api_request_received', {
      requestId,
      query: body.query,
      resource_type: body.resource_type,
      location: body.location,
      location_specific: body.location_specific,
      mapView: body.mapView,
      searchId: body.searchId,
      timestamp: new Date().toISOString()
    });

    // Parse the request body
    // Validate required fields
    if (!body.query) {
      console.error(`[RESOURCE-SEARCH-${requestId}] ❌ Missing required field: query`);

      // Log validation error for map function debugging
      logMapFunctionServer('ERROR', 'VALIDATION', 'missing_query', {
        requestId,
        error: 'Query is required',
        timestamp: new Date().toISOString()
      });

      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Log search request
    console.log(`[RESOURCE-SEARCH-${requestId}] Request details:`, {
      query: body.query,
      resource_type: body.resource_type || 'not specified',
      location_specific: body.location_specific || false,
      location: body.location || 'not specified',
      userId: body.userId ? body.userId.substring(0, 8) + '...' : 'anonymous',
      searchId: body.searchId || 'not provided'
    });

    // Enhance search query for better results
    const enhancedQuery = constructSearchQuery(body);

    // Log the enhanced query for debugging
    console.log(`[RESOURCE-SEARCH-${requestId}] 🔎 Enhanced query: "${enhancedQuery}"`);

    // For audit/logging purposes
    const searchData = {
      original_query: body.query,
      enhanced_query: enhancedQuery,
      resource_type: body.resource_type || 'general',
      location_specific: body.location_specific || false,
      location: body.location || 'general',
      user_id: body.userId || null,
      search_id: body.searchId || null,
      timestamp: new Date().toISOString(),
      request_id: requestId,
    };

    // Store search request in database for analytics (non-blocking)
    if (body.userId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('resource_search_logs')
          .insert([searchData])
          .select();

        if (error) {
          // Check if the error is related to the table not existing or column missing
          const isSchemaError =
            error.message.includes('relation "resource_search_logs" does not exist') ||
            error.message.includes('column') && error.message.includes('does not exist');

          if (isSchemaError) {
            console.warn(`[RESOURCE-SEARCH-${requestId}] ⚠️ Schema issue with resource_search_logs table: ${error.message}`);
            console.warn(`[RESOURCE-SEARCH-${requestId}] 📋 Run migrations to create the resource_search_logs table`);
          } else {
            console.error(`[RESOURCE-SEARCH-${requestId}] ⚠️ Failed to log search request: ${error.message}`);
          }
          // Non-critical error, continue with the search
        } else {
          console.log(`[RESOURCE-SEARCH-${requestId}] ✅ Search request logged with ID: ${data?.[0]?.id || 'unknown'}`);
        }
      } catch (logError) {
        console.error(`[RESOURCE-SEARCH-${requestId}] ⚠️ Exception logging search request: ${(logError as Error).message}`);
        // Non-critical error, continue with the search
      }
    }

    // Perform the search using Anthropic web search
    const searchResults = await performResourceSearch(enhancedQuery, body, requestId, body.userId);

    // Capture the raw response content
    const rawSearchContent = searchResults.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text || '')
      .join('\n\n');

    console.log(`[RESOURCE-SEARCH-${requestId}] Raw search response captured, length: ${rawSearchContent.length}`);

    // Claude will handle web search internally and include results in the response
    // No need to intercept tool_use blocks - just process the response content
    // Always use the formatting API to structure the results
    if (rawSearchContent && rawSearchContent.length > 0) {
      console.log(`[RESOURCE-SEARCH-${requestId}] Using formatting API to structure results`);

      // Make second Claude API call for formatting
      const formattedResources = await formatSearchResultsWithClaude(rawSearchContent, requestId, body.location);

      if (formattedResources && formattedResources.length > 0) {
        const formattedResults = {
          summary: `Found ${formattedResources.length} resources in ${body.location || 'the specified area'}`,
          resources: formattedResources,
          result_count: formattedResources.length,
          query_context: {
            resource_type: body.resource_type || 'general',
            location_specific: body.location_specific || false,
            location: body.location || 'general',
            mapView: body.mapView || false
          },
          raw_content: rawSearchContent,
          citation_links: searchResults.citations || [],
          formatted_response: formatResponseForDisplay(
            `Found ${formattedResources.length} resources in ${body.location || 'the specified area'}`,
            formattedResources,
            searchResults.citations || []
          ),
          requestId
        };

        logResourceResults(formattedResults, requestId);

        const response = {
          success: true,
          results: formattedResults,
          query: body.query,
          resource_type: body.resource_type || 'general',
          location: body.location || 'general',
        };

        // Log final API response for map function debugging
        logMapFunctionServer('INFO', 'API_RESPONSE', 'successful_response', {
          requestId,
          success: true,
          resourceCount: formattedResults.resources.length,
          resourcesWithLocations: formattedResults.resources.filter(r => r.location || r.address).length,
          query: body.query,
          resource_type: body.resource_type || 'general',
          location: body.location || 'general',
          mapView: body.mapView,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json(response);
      }
    }

    // If we couldn't format any resources, return an error
    console.error(`[RESOURCE-SEARCH-${requestId}] ❌ No resources could be extracted from the search results`);

    const errorResponse = {
      success: false,
      error: 'No resources found',
      query: body.query,
      resource_type: body.resource_type || 'general',
      location: body.location || 'general',
    };

    // Log error response for map function debugging
    logMapFunctionServer('ERROR', 'API_RESPONSE', 'no_resources_error', {
      requestId,
      success: false,
      error: 'No resources found',
      query: body.query,
      resource_type: body.resource_type || 'general',
      location: body.location || 'general',
      mapView: body.mapView,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(errorResponse);
  } catch (error) {
    console.error('[RESOURCE-SEARCH] ❌ Exception processing search request:', error);

    // Log exception for map function debugging
    logMapFunctionServer('ERROR', 'API_EXCEPTION', 'search_request_failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(
      {
        error: 'Failed to process search request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * Log detailed resource results information
 */
function logResourceResults(formattedResults: FormattedResults, requestId: string) {
  if (formattedResults.resources.length > 0) {
    console.log(`\n=================================================================`);
    console.log(`============= FINAL EXTRACTED RESOURCES (${formattedResults.resources.length}) =============`);
    console.log(`=================================================================`);
    console.log(`[RESOURCE-SEARCH-${requestId}] Resources found (${formattedResults.resources.length} total):`);

    const resourcesWithLocations = formattedResults.resources.filter(r => r.location || r.address);

    console.log(JSON.stringify(formattedResults.resources.map((resource, index) => ({
      index: index + 1,
      name: resource.name,
      type: resource.resource_type,
      verified: resource.verified,
      website: resource.website || 'none',
      contact: resource.contact || 'none',
      location: resource.location || resource.address || 'none',
      description: resource.description?.substring(0, 150) + (resource.description?.length > 150 ? '...' : ''),
      descriptionLength: resource.description?.length || 0,
      citationIndex: resource.citation_index
    })), null, 2));

    console.log(`=================================================================`);
    console.log(`================ END EXTRACTED RESOURCES =====================`);
    console.log(`=================================================================\n`);

    // Log to map function server log for debugging
    logMapFunctionServer('INFO', 'RESOURCE_EXTRACTION', 'resources_extracted', {
      requestId,
      totalResources: formattedResults.resources.length,
      resourcesWithLocations: resourcesWithLocations.length,
      resourcesWithLocationDetails: resourcesWithLocations.map(r => ({
        name: r.name,
        location: r.location || r.address,
        type: r.resource_type
      })),
      allResources: formattedResults.resources.map(r => ({
        name: r.name,
        hasLocation: !!(r.location || r.address),
        location: r.location || r.address || 'none',
        type: r.resource_type
      })),
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`\n=================================================================`);
    console.log(`=============== NO RESOURCES WERE IDENTIFIED =================`);
    console.log(`=================================================================`);
    console.log(`[RESOURCE-SEARCH-${requestId}] No resources were identified in the response content.`);
    console.log(`[RESOURCE-SEARCH-${requestId}] Raw content was:`, JSON.stringify({
      responseLength: formattedResults.raw_content?.length,
      responsePreview: formattedResults.raw_content?.substring(0, 500) + (formattedResults.raw_content?.length > 500 ? '...' : '')
    }, null, 2));

    // Log to map function server log for debugging
    logMapFunctionServer('WARN', 'RESOURCE_EXTRACTION', 'no_resources_found', {
      requestId,
      totalResources: 0,
      resourcesWithLocations: 0,
      rawContentLength: formattedResults.raw_content?.length || 0,
      rawContentPreview: formattedResults.raw_content?.substring(0, 200) || 'none',
      timestamp: new Date().toISOString()
    });
    console.log(`=================================================================`);
    console.log(`================ END RESOURCE CHECK ==========================`);
    console.log(`=================================================================\n`);
  }
}


/**
 * Constructs search query respecting user intent and handling location properly
 */
function constructSearchQuery(body: SearchRequestBody): string {
  let query = body.query;  // Use exactly what the user asked for

  // Only add location if we have it
  if (body.location_specific && body.location) {
    query += ` in ${body.location}`;
  }

  return query;
}


/**
 * Message pools for varied, context-aware progress updates
 */
const SEARCH_MESSAGES = {
  starting: [
    "Let me search for that information...",
    "I'll look that up for you...",
    "Searching the web for details...",
    "Let me find some current information...",
    "I'll check what's available online...",
    "Searching for the latest info...",
    "Let me dig into that for you...",
    "I'll find some up-to-date details...",
    "Checking the web for information...",
    "Let me search for relevant details..."
  ],
  preparing: [
    "I'm preparing to search the web for relevant resources...",
    "Setting up the search parameters...",
    "Getting ready to find the best sources...",
    "Preparing to search across multiple sources...",
    "Configuring the search for optimal results..."
  ],
  analyzing: [
    "Analyzing your request and formulating search queries...",
    "Breaking down your question to find the best answers...",
    "Crafting targeted search queries for your needs...",
    "Determining the most effective search approach...",
    "Processing your request to optimize the search..."
  ],
  processing_first: [
    "Found some results! Let me analyze and organize them for you...",
    "Got some good sources - analyzing the information now...",
    "Found relevant information - processing the details...",
    "Retrieved some useful data - organizing it for you...",
    "Located several sources - reviewing the content..."
  ],
  processing_additional: [
    "Found more results! Gathering additional details...",
    "Got more sources - cross-referencing the information...",
    "Found additional data - comparing with previous results...",
    "Retrieved more sources - building a comprehensive picture...",
    "Located more information - synthesizing everything together..."
  ],
  finalizing: [
    "Almost done! Finalizing the resource list...",
    "Putting the finishing touches on your results...",
    "Organizing everything into a clear summary...",
    "Finalizing the most relevant information for you...",
    "Completing the analysis and preparing your results..."
  ]
};

/**
 * Tracks message usage to avoid repetition within the same search
 */
const messageUsageTracker = new Map<string, {
  used: Set<string>;
  processingCount: number;
}>();

/**
 * Gets a varied message from the appropriate pool, avoiding recent repetition
 */
function getVariedMessage(requestId: string, category: string, context?: { query?: string }): string {
  if (!messageUsageTracker.has(requestId)) {
    messageUsageTracker.set(requestId, {
      used: new Set(),
      processingCount: 0
    });
  }

  const tracker = messageUsageTracker.get(requestId)!;
  let messagePool = SEARCH_MESSAGES[category as keyof typeof SEARCH_MESSAGES];

  // Special handling for processing messages based on count
  if (category === 'processing_results') {
    tracker.processingCount++;
    messagePool = tracker.processingCount === 1
      ? SEARCH_MESSAGES.processing_first
      : SEARCH_MESSAGES.processing_additional;
  }

  // Filter out recently used messages for this search
  const availableMessages = messagePool.filter(msg => !tracker.used.has(msg));

  // If all messages used, reset and use any message
  const finalPool = availableMessages.length > 0 ? availableMessages : messagePool;

  // Pick random message from available pool
  const selectedMessage = finalPool[Math.floor(Math.random() * finalPool.length)];

  // Mark as used for this search
  tracker.used.add(selectedMessage);

  // Add query context for web_searching messages
  if (context?.query && category === 'web_searching') {
    return `Searching the web for: "${context.query}"...`;
  }

  return selectedMessage;
}

/**
 * Cleans up message tracking for completed searches
 */
function cleanupMessageTracking(requestId: string) {
  messageUsageTracker.delete(requestId);
}

/**
 * Processes streaming response from Claude API and emits progress updates
 */
async function processStreamingResponse(stream: AsyncIterable<unknown>, requestId: string, userId?: string): Promise<{ content: { type: string; text: string }[]; usage: { input_tokens: number; output_tokens: number }; model: string; stop_reason: string; citations: Citation[] }> {
  // Logging helper following logging_method.md
  const logProgressUpdate = (msg: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_PROGRESS_UPDATE_LOGS === 'true') {
      console.log(`[progress_update] ${msg}`, ...args);
    }
  };
  const contentBlocks: unknown[] = [];
  const citations: Citation[] = [];
  let currentContent = '';

  // Throttling variables
  let lastUpdateTime = 0;
  const THROTTLE_INTERVAL = 2500; // 2.5 seconds between updates
  let currentStage = '';

  logProgressUpdate(`Processing streaming response`, {
    requestId,
    userId: userId || 'anonymous',
    streamStartTime: new Date().toISOString()
  });

  // Throttled update function
  const throttledEmitUpdate = async (message: string, stage: string) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime;

    // If we're in a different stage or enough time has passed, send the update
    if (stage !== currentStage || timeSinceLastUpdate >= THROTTLE_INTERVAL) {
      logProgressUpdate(`Throttle: Sending update immediately`, {
        requestId,
        stage,
        timeSinceLastUpdate,
        previousStage: currentStage
      });
      
      await emitProgressUpdate(requestId, message, stage, userId);
      lastUpdateTime = now;
      currentStage = stage;
    } else {
      // Otherwise, skip this update due to throttling
      logProgressUpdate(`Throttle: Skipping update`, {
        requestId,
        stage,
        timeSinceLastUpdate,
        timeUntilNext: THROTTLE_INTERVAL - timeSinceLastUpdate
      });
    }
  };

  // Send initial progress message immediately (no throttle)
  const initialMessage = getVariedMessage(requestId, "starting");
  logProgressUpdate(`Sending initial progress message`, {
    requestId,
    stage: 'starting',
    message: initialMessage
  });
  await emitProgressUpdate(requestId, initialMessage, "starting", userId);
  lastUpdateTime = Date.now();
  currentStage = "starting";

  for await (const event of stream) {
    const streamEvent = event as StreamEvent;
    console.log(`[RESOURCE-SEARCH-${requestId}] Stream event:`, streamEvent.type);

    switch (streamEvent.type) {
      case 'content_block_start':
        if (streamEvent.content_block?.type === 'tool_use' && streamEvent.content_block?.name === 'web_search') {
          await throttledEmitUpdate(getVariedMessage(requestId, "preparing"), "tool_start");
        }
        break;

      case 'content_block_delta':
        if (streamEvent.delta?.type === 'input_json_delta') {
          // Claude is formulating the search query
          await throttledEmitUpdate(getVariedMessage(requestId, "analyzing"), "query_analysis");
        } else if (streamEvent.delta?.type === 'text_delta') {
          currentContent += streamEvent.delta.text || '';
        }
        break;

      case 'tool_use':
        if (streamEvent.name === 'web_search') {
          const query = streamEvent.input?.query || 'resources';
          await throttledEmitUpdate(getVariedMessage(requestId, "web_searching", { query }), "web_searching");
        }
        break;

      case 'content_block_stop':
        // Tool use completed, now processing results
        await throttledEmitUpdate(getVariedMessage(requestId, "processing_results"), "processing_results");
        break;

      case 'message_start':
        console.log(`[RESOURCE-SEARCH-${requestId}] Message started with model: ${streamEvent.message?.model}`);
        break;

      case 'message_delta':
        if (streamEvent.delta?.stop_reason) {
          console.log(`[RESOURCE-SEARCH-${requestId}] Message completed with reason: ${streamEvent.delta.stop_reason}`);
        }
        break;

      case 'message_stop':
        // For the final message, always send it immediately
        const finalMessage = getVariedMessage(requestId, "finalizing");
        logProgressUpdate(`Emitting finalizing progress (bypassing throttle)`, {
          requestId,
          stage: 'finalizing',
          message: finalMessage
        });
        await emitProgressUpdate(requestId, finalMessage, "finalizing", userId);
        logProgressUpdate(`Stream completed`, {
          requestId,
          totalDuration: new Date().toISOString()
        });
        break;
    }

    // Collect content blocks for final processing
    if (streamEvent.type === 'content_block_start') {
      contentBlocks.push(streamEvent.content_block);
    }
  }

  // Clean up message tracking for this search
  cleanupMessageTracking(requestId);

  // Assemble final content - combine text blocks
  const finalContent = currentContent || 'Search completed.';

  // Simulate the final response structure that the original code expects
  const finalResponse = {
    content: [{
      type: 'text',
      text: finalContent
    }],
    usage: { input_tokens: 0, output_tokens: 0 }, // Placeholder
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    citations: citations
  };

  return finalResponse;
}

/**
 * Emits progress updates to frontend via Supabase Realtime
 */
async function emitProgressUpdate(requestId: string, message: string, stage: string, userId?: string) {
  // Logging helper following logging_method.md
  const logProgressUpdate = (msg: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_PROGRESS_UPDATE_LOGS === 'true') {
      console.log(`[progress_update] ${msg}`, ...args);
    }
  };

  logProgressUpdate(`Emitting progress update`, {
    requestId,
    stage,
    message: message.substring(0, 50) + '...',
    userId: userId || 'anonymous',
    timestamp: new Date().toISOString()
  });

  // Server-side file logging
  logProgressUpdateServer({
    level: 'INFO',
    category: 'PROGRESS_UPDATE',
    operation: 'emit-progress',
    requestId,
    userId,
    stage,
    message,
    data: {
      messageLength: message.length,
      hasUserId: !!userId
    }
  });

  // Store progress in Supabase for real-time updates
  try {
    const { data, error } = await supabaseAdmin
      .from('progress_updates')
      .insert({
        request_id: requestId,
        user_id: userId || null,
        message,
        stage
      })
      .select()
      .single();

    if (error) {
      logProgressUpdate(`❌ Failed to store progress update`, {
        requestId,
        error: error.message,
        code: error.code,
        details: error.details
      });

      // Log error to file
      logProgressUpdateServer({
        level: 'ERROR',
        category: 'SUPABASE_INSERT',
        operation: 'store-progress-failed',
        requestId,
        userId,
        stage,
        error: error.message,
        data: {
          errorCode: error.code,
          errorDetails: error.details
        }
      });
    } else {
      logProgressUpdate(`✅ Progress update stored successfully`, {
        requestId,
        progressId: data?.id,
        stage
      });

      // Log success to file
      logProgressUpdateServer({
        level: 'INFO',
        category: 'SUPABASE_INSERT',
        operation: 'store-progress-success',
        requestId,
        userId,
        stage,
        data: {
          progressId: data?.id,
          createdAt: data?.created_at
        }
      });
    }
  } catch (err) {
    logProgressUpdate(`❌ Exception storing progress update`, {
      requestId,
      error: err instanceof Error ? err.message : String(err)
    });

    // Log exception to file
    logProgressUpdateServer({
      level: 'ERROR',
      category: 'EXCEPTION',
      operation: 'store-progress-exception',
      requestId,
      userId,
      stage,
      error: err instanceof Error ? err.message : String(err),
      data: {
        errorType: err instanceof Error ? err.name : typeof err
      }
    });
  }
}

/**
 * Performs the actual search using Anthropic's web search capability
 */
async function performResourceSearch(query: string, options: SearchRequestBody, requestId: string, userId?: string): Promise<SearchResults> {
  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Create a dynamic prompt based on the user's query and resource type
  const generateResourcePrompt = (query: string, resourceType?: string, location?: string): string => {
    // Default resource type if not specified
    const resourceTypeDesc = resourceType ? resourceType.replace('_', ' ') : 'mental health resources';

    if (location) {
      return `Find ${resourceTypeDesc} matching: "${query}".

IMPORTANT: ONLY find resources that are physically located in ${location}. Do NOT include resources from other cities or states.

Requirements:
- Resources MUST be located in ${location}
- Include complete street addresses
- Include phone numbers and contact information
- Focus on actual service providers with physical locations in ${location}
- Do NOT include national hotlines or resources from other cities
- Do NOT include online-only services unless they specifically serve ${location}`;
    } else {
      return `Find ${resourceTypeDesc} matching: "${query}".

Use web search to find actual organizations with physical locations.
Focus on getting complete contact information including addresses and phone numbers.
Look for real service providers, not just directories or referral services.
Include details about what services they provide.`;
    }
  };

  // Generate the dynamic prompt based on query, resource type, and location
  const resourcePrompt = generateResourcePrompt(query, options.resource_type, options.location);

  console.log(`[RESOURCE-SEARCH-${requestId}] Sending request to Anthropic with query: "${query}"`);

  // Optional user location for geographically relevant results
  const userLocation: Anthropic.Messages.WebSearchTool20250305.UserLocation | undefined =
    options.location_specific && options.location ? {
      type: "approximate" as const,
      city: options.location.split(',')[0].trim(), // Extract city part
      region: options.location.includes(',') ? options.location.split(',')[1].trim() : options.location, // Extract region if present
      country: "US", // Default to US, can be improved with better location parsing
    } : undefined;

  // Log the full request details for debugging
  console.log(`[RESOURCE-SEARCH-${requestId}] Full request to Anthropic:`, {
    model: "claude-sonnet-4-20250514",
    prompt: resourcePrompt,
    location: userLocation ? `${userLocation.city}, ${userLocation.region}, ${userLocation.country}` : "not specified",
    max_uses: 10
  });

  // Configure web search tool with optional user location
  const webSearchTool: Anthropic.Messages.WebSearchTool20250305 = {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 10,
    ...(userLocation ? { user_location: userLocation } : {})
  };

  try {
    // Make the API request to Claude with web search enabled and streaming
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        { role: "user", content: resourcePrompt }
      ],
      tools: [webSearchTool],
      stream: true, // Enable streaming for progress updates
      // Set system instructions for web search behavior
      system: userLocation ?
        `CRITICAL: You MUST only find ${options.resource_type || 'mental health'} resources that are physically located in ${userLocation.city}, ${userLocation.region}. 

DO NOT include:
- Resources from other cities or states
- National organizations unless they have a specific location in ${userLocation.city}
- Online-only services unless they specifically serve ${userLocation.city}

Each resource MUST have a physical address in ${userLocation.city}, ${userLocation.region}.` :
        `When using web search, find ${options.resource_type || 'mental health'} resources. Focus on actual organizations with physical locations and complete contact information.`
    });

    // Process the streaming response
    const response = await processStreamingResponse(stream, requestId, userId);

    console.log(`[RESOURCE-SEARCH-${requestId}] Received response from Anthropic`);

    // Log the ENTIRE raw response with clear delimiters
    console.log(`\n=================================================================`);
    console.log(`================== COMPLETE CLAUDE API RESPONSE ==================`);
    console.log(`=================================================================\n`);

    console.log(`[RESOURCE-SEARCH-${requestId}] Complete raw response:`,
      JSON.stringify(response, null, 2)
    );

    console.log(`\n=================================================================`);
    console.log(`================== END OF CLAUDE API RESPONSE ===================`);
    console.log(`=================================================================\n`);

    // Also log specifically content types to better understand the structure
    console.log(`[RESOURCE-SEARCH-${requestId}] Response content structure:`,
      JSON.stringify({
        contentTypes: response.content.map(c => c.type),
        hasToolCalls: response.content.some(c => ['tool_calls', 'tool_use'].includes(String(c.type))),
        hasToolResults: response.content.some(c => ['tool_result', 'web_search_result'].includes(String(c.type))),
        citationsCount: ((response as AnthropicResponseWithCitations).citations?.length || 0),
        usageStats: response.usage
      }, null, 2)
    );


    // Log all citations for complete debugging visibility with clear delimiters
    const citations = (response as AnthropicResponseWithCitations).citations;
    if (citations && Array.isArray(citations) && citations.length > 0) {
      console.log(`\n=================================================================`);
      console.log(`===================== CITATIONS LISTING =======================`);
      console.log(`=================================================================`);
      console.log(`[RESOURCE-SEARCH-${requestId}] All ${citations.length} citations:`,
        JSON.stringify(citations, null, 2)
      );
      console.log(`=================================================================`);
      console.log(`==================== END CITATIONS LISTING ====================`);
      console.log(`=================================================================\n`);
    }

    // Convert Anthropic content blocks to our internal format
    const convertedContent: ContentBlock[] = response.content.map(block => {
      // Cast block to unknown first to avoid type issues with specific block types
      const unknownBlock = block as unknown;
      // Create a copy of the block without the type property first
      const { type, ...rest } = unknownBlock as AnthropicContentBlock;

      // Then return a new object with type and the rest of the properties
      return {
        type: type,
        text: 'text' in block ? ((unknownBlock as AnthropicContentBlock).text) : undefined,
        ...rest
      };
    });

    return {
      content: convertedContent,
      citations: (response as AnthropicResponseWithCitations).citations || []
    };
  } catch (err) {
    // Type guard for AnthropicError - using unknown instead of any
    const error = err as unknown as AnthropicError;

    // Handle specific web search errors
    if (error.status === 429) {
      console.error(`[RESOURCE-SEARCH-${requestId}] Rate limit exceeded: too_many_requests`);
      throw new Error("Search rate limit exceeded. Please try again later.");
    }

    if (error.type === "api_error") {
      // Check for specific web search error types
      const errorMessage = error.message || "";
      if (errorMessage.includes("max_uses_exceeded")) {
        console.error(`[RESOURCE-SEARCH-${requestId}] Maximum web searches exceeded`);
        throw new Error("Maximum number of web searches exceeded. Please try a more specific query.");
      }
      if (errorMessage.includes("query_too_long")) {
        console.error(`[RESOURCE-SEARCH-${requestId}] Query too long`);
        throw new Error("Search query is too long. Please use a shorter, more focused query.");
      }
      if (errorMessage.includes("invalid_input")) {
        console.error(`[RESOURCE-SEARCH-${requestId}] Invalid search query`);
        throw new Error("Invalid search query. Please try different search terms.");
      }
    }

    // Default error handling
    console.error(`[RESOURCE-SEARCH-${requestId}] Error during web search:`, error);
    throw error;
  }
}


/**
 * Formats the response for display to the user
 */
function formatResponseForDisplay(summary: string, resources: Resource[], citations: Citation[]): string {
  let formattedResponse = `${summary}\n\n`;

  // Add each resource
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];

    formattedResponse += `**${i + 1}. ${resource.name}**`;
    if (resource.verified) formattedResponse += ' ✓\n';
    else formattedResponse += '\n';

    // Extract a cleaner description from the full paragraph
    let description = resource.description;
    // Remove the name if it's at the beginning
    if (description?.startsWith(resource.name)) {
      description = description.substring(resource.name.length).trim();
      if (description.startsWith(':')) description = description.substring(1).trim();
    }
    formattedResponse += `${description}\n`;

    // Add resource type if available and different from name
    if (resource.type && !resource.name.toLowerCase().includes(resource.type.toLowerCase())) {
      formattedResponse += `**Type:** ${resource.type}\n`;
    }

    // Add contact info if available
    if (resource.phone) {
      formattedResponse += `**Phone:** ${resource.phone}\n`;
    } else if (resource.contact) {
      formattedResponse += `**Contact:** ${resource.contact}\n`;
    }

    // Add email if available
    if (resource.email) {
      formattedResponse += `**Email:** ${resource.email}\n`;
    }

    // Add website if available
    if (resource.website) {
      const websiteUrl = resource.website.startsWith('http') ? resource.website : `https://${resource.website}`;
      formattedResponse += `**Website:** [${resource.website}](${websiteUrl})\n`;
    }

    // Add location if available
    if (resource.address) {
      formattedResponse += `**Address:** ${resource.address}\n`;
    } else if (resource.location) {
      formattedResponse += `**Location:** ${resource.location}\n`;
    }

    // Add hours if available
    if (resource.hours) {
      formattedResponse += `**Hours:** ${resource.hours}\n`;
    }

    // Add eligibility if available
    if (resource.eligibility) {
      formattedResponse += `**Eligibility:** ${resource.eligibility}\n`;
    }

    // Add costs if available
    if (resource.costs) {
      formattedResponse += `**Costs:** ${resource.costs}\n`;
    }

    // Add languages if available
    if (resource.languages) {
      formattedResponse += `**Languages:** ${resource.languages}\n`;
    }

    // Add accessibility info if available
    if (resource.accessibility) {
      formattedResponse += `**Accessibility:** ${resource.accessibility}\n`;
    }

    // Add notes if available
    if (resource.notes) {
      formattedResponse += `**Notes:** ${resource.notes}\n`;
    }

    // Add citation link if available
    if (resource.citation_index >= 0 && citations && citations.length > resource.citation_index) {
      const citation = citations[resource.citation_index];
      formattedResponse += `**Source:** [${citation.title || citation.url}](${citation.url})\n`;
    }

    formattedResponse += '\n';
  }

  // Add disclaimer
  formattedResponse += '\n**Disclaimer:** This information is provided for educational purposes only and does not constitute professional advice. Always verify availability and suitability of resources before reaching out. If you are in crisis, please call your local emergency number or a crisis hotline immediately.';

  return formattedResponse;
}

