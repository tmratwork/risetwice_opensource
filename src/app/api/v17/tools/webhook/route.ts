// src/app/api/v17/tools/webhook/route.ts
// V17 Webhook Tools for ElevenLabs Function Calls
// Handles function calls from ElevenLabs agents using webhooks

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Pinecone } from '@pinecone-database/pinecone';

// Type definitions for function parameters
interface KnowledgeBaseSearchParams {
  query: string;
}

interface ResourceSearchParams {
  query: string;
  resource_category?: string;
  location?: string;
}

interface SpecialistHandoffParams {
  specialist_type: string;
  handoff_reason?: string;
  context_summary?: string;
  urgency_level?: string;
}

interface CrisisResponseParams {
  crisis_type: string;
  urgency_level?: string;
  location?: string;
}

interface UserLocationParams {
  [key: string]: unknown;
}

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { function_name, parameters } = body;

    logV17('🔧 V17 webhook tool called', {
      function_name,
      parameters: Object.keys(parameters || {}),
      timestamp: new Date().toISOString()
    });

    // Route function calls to appropriate handlers
    switch (function_name) {
      case 'search_knowledge_base':
        return await handleKnowledgeBaseSearch(parameters);
      
      case 'search_resources_unified':
      case 'resource_search_function':
        return await handleResourceSearch(parameters);
      
      case 'trigger_specialist_handoff':
        return await handleSpecialistHandoff(parameters);
      
      case 'crisis_response_function':
        return await handleCrisisResponse(parameters);
      
      case 'get_user_location':
        return await handleGetUserLocation(parameters);
        
      default:
        logV17('❌ Unknown function called', { function_name });
        return NextResponse.json({
          error: `Unknown function: ${function_name}`,
          success: false
        }, { status: 400 });
    }

  } catch (error) {
    logV17('❌ Error in webhook handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : String(error),
      success: false
    }, { status: 500 });
  }
}

// Handle knowledge base search using Pinecone
async function handleKnowledgeBaseSearch(parameters: KnowledgeBaseSearchParams): Promise<NextResponse> {
  const { query } = parameters;

  logV17('🔍 Searching knowledge base', { query });

  try {
    // Generate embedding for the query using same model as indexing
    const embedding = await generateEmbedding(query);
    
    // Query Pinecone knowledge base
    const index = pinecone.index('risetwice-knowledge-base');
    const queryResponse = await index.namespace('mental-health-docs').query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    });

    // Format results for ElevenLabs agent
    const results = queryResponse.matches.map(match => ({
      content: match.metadata?.text || '',
      score: match.score,
      source: match.metadata?.source || '',
      title: match.metadata?.title || ''
    }));

    logV17('✅ Knowledge base search completed', {
      query,
      resultsCount: results.length,
      topScore: results[0]?.score || 0
    });

    return NextResponse.json({
      success: true,
      results: results,
      summary: `Found ${results.length} relevant documents for: ${query}`,
      sources: [...new Set(results.map(r => r.source))]
    });

  } catch (error) {
    logV17('❌ Knowledge base search failed', { error });
    return NextResponse.json({
      success: false,
      error: `Knowledge base search failed: ${error}`
    });
  }
}

// Handle resource search using existing V16 logic
async function handleResourceSearch(parameters: ResourceSearchParams): Promise<NextResponse> {
  const { query, resource_category, location } = parameters;

  logV17('🏥 Searching resources', { query, resource_category, location });

  try {
    // Query Pinecone resource database (same as V16)
    const embedding = await generateEmbedding(`${query} ${resource_category} ${location}`);
    
    const index = pinecone.index('risetwice-resources');
    const queryResponse = await index.namespace('resources').query({
      vector: embedding,
      topK: 10,
      includeMetadata: true,
      filter: location ? {
        location: { "$eq": location }
      } : undefined
    });

    // Format resource results
    const resources = queryResponse.matches.map(match => ({
      id: match.id,
      title: match.metadata?.title || '',
      description: match.metadata?.description || '',
      address: match.metadata?.address || '',
      phone: match.metadata?.phone || '',
      website: match.metadata?.website || '',
      category: match.metadata?.category || resource_category,
      location: match.metadata?.location || location,
      score: match.score
    }));

    logV17('✅ Resource search completed', {
      query,
      location,
      resourcesFound: resources.length
    });

    return NextResponse.json({
      success: true,
      resources: resources,
      summary: `Found ${resources.length} ${resource_category} resources in ${location}`,
      location: location
    });

  } catch (error) {
    logV17('❌ Resource search failed', { error });
    return NextResponse.json({
      success: false,
      error: `Resource search failed: ${error}`
    });
  }
}

// Handle specialist handoff (V17 version)
async function handleSpecialistHandoff(parameters: SpecialistHandoffParams): Promise<NextResponse> {
  const { specialist_type, handoff_reason, context_summary, urgency_level } = parameters;

  logV17('🔄 Processing specialist handoff', {
    specialist_type,
    handoff_reason,
    context_length: context_summary?.length || 0,
    urgency_level
  });

  try {
    // Store handoff in database for V17 tracking
    const { error: dbError } = await supabase
      .from('specialist_handoffs')
      .insert({
        from_specialist: 'triage',
        to_specialist: specialist_type,
        handoff_reason: handoff_reason,
        context_summary: context_summary,
        urgency_level: urgency_level || 'normal',
        status: 'pending',
        created_at: new Date().toISOString(),
        version: 'V17'
      });

    if (dbError) {
      logV17('⚠️ Failed to store handoff in database', { dbError });
    }

    // Return success response for ElevenLabs
    return NextResponse.json({
      success: true,
      message: `Handoff to ${specialist_type} specialist has been initiated. Please wait while we connect you...`,
      data: {
        specialist_type,
        handoff_reason,
        urgency_level: urgency_level || 'normal',
        estimated_wait_time: '30-60 seconds'
      }
    });

  } catch (error) {
    logV17('❌ Specialist handoff failed', { error });
    return NextResponse.json({
      success: false,
      error: `Handoff failed: ${error}`
    });
  }
}

// Handle crisis response
async function handleCrisisResponse(parameters: CrisisResponseParams): Promise<NextResponse> {
  const { crisis_type, urgency_level, location } = parameters;

  logV17('🚨 Processing crisis response', { crisis_type, urgency_level, location });

  try {
    // Get crisis resources from database
    const { data: crisisResources, error } = await supabase
      .from('crisis_resources')
      .select('*')
      .eq('crisis_type', crisis_type)
      .eq('active', true);

    if (error) {
      logV17('❌ Failed to fetch crisis resources', { error });
    }

    // Standard crisis resources
    const resources = [
      {
        name: "National Suicide Prevention Lifeline",
        phone: "988",
        description: "24/7 crisis support",
        type: "immediate"
      },
      {
        name: "Crisis Text Line",
        phone: "Text HOME to 741741",
        description: "24/7 text-based crisis support",
        type: "immediate"
      },
      ...(crisisResources || [])
    ];

    return NextResponse.json({
      success: true,
      crisis_response: {
        message: "Immediate help is available. Please reach out to these resources:",
        resources: resources,
        urgency_acknowledgment: `This has been classified as ${urgency_level} urgency`,
        location_specific: location ? `Resources for ${location} area` : "National resources"
      }
    });

  } catch (error) {
    logV17('❌ Crisis response failed', { error });
    return NextResponse.json({
      success: false,
      error: `Crisis response failed: ${error}`,
      fallback_resources: [
        {
          name: "Emergency Services",
          phone: "911",
          description: "For immediate emergencies"
        }
      ]
    });
  }
}

// Handle get user location (for client-side functions)
async function handleGetUserLocation(parameters: UserLocationParams): Promise<NextResponse> {
  logV17('📍 Location request received', parameters);

  // This is a client-side function that should be registered on the frontend
  // Return instruction for client to handle
  return NextResponse.json({
    success: true,
    message: "Location request should be handled client-side",
    instruction: "register_client_tool",
    tool_name: "get_user_location"
  });
}

// Generate embedding for text queries (same as V16)
async function generateEmbedding(text: string): Promise<number[]> {
  // This would use the same embedding model as your V16 implementation
  // For now, return a mock embedding - replace with actual implementation
  logV17('🧠 Generating embedding', { textLength: text.length });
  
  // TODO: Replace with actual embedding generation using same model as V16
  // This is a placeholder - you'll need to use the same embedding service
  // that you use for indexing your Pinecone database
  
  throw new Error('Embedding generation not implemented - please integrate with your V16 embedding service');
}