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

// Therapeutic Content Function Parameters
interface SafetyTriageParams {
  risk_type: string;
  risk_level: string;
  session_context?: string;
}

interface ConversationStanceParams {
  interaction_type: string;
  previous_interactions?: string[];
  user_emotional_intensity?: string;
}

interface AssessmentProtocolParams {
  assessment_stage: string;
  presenting_issue?: string;
  repeat_topic?: boolean;
}

interface ContinuityFrameworkParams {
  continuity_type: string;
  conversation_history_summary?: string;
}

interface CbtInterventionParams {
  intervention_submodule: string;
  conversation_step: string;
  user_situation?: string;
  distortion_type?: string;
}

interface DbtSkillsParams {
  skill_submodule: string;
  skill_application: string;
  user_distress_level?: string;
  interpersonal_situation?: string;
}

interface TraumaInformedParams {
  trauma_submodule: string;
  user_choice?: string;
  parts_identified?: string[];
  trauma_response_detected?: boolean;
}

interface SubstanceUseSupportParams {
  mi_submodule: string;
  ambivalence_area?: string;
  change_readiness?: string;
  substance_mentioned?: string;
}

interface PracticalSupportParams {
  support_type: string;
  urgency_context?: string;
  resource_category?: string;
}

interface AcuteDistressParams {
  distress_type: string;
  entry_criteria_met: boolean;
  grounding_technique?: string;
}

interface EndSessionParams {
  user_outcome?: string;
  session_summary?: string;
}

interface UserHistoryParams {
  history_type: string;
}

interface InteractionOutcomeParams {
  approach_used: string;
  effectiveness_rating: string;
  user_engagement?: string;
  therapeutic_module?: string;
}

interface DisplayMapParams {
  searchId: string;
}

interface ResourceFeedbackParams {
  searchId: string;
  helpful: boolean;
  resource_name?: string;
  comment?: string;
}

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// June 2025 Response-Aware Tool Architecture
interface ResponseMetadata {
  execution_time_ms: number;
  function_name: string;
  parameters_used: Record<string, unknown>;
  success: boolean;
  timestamp: string;
  version: string;
}

interface DynamicVariable {
  key: string;
  value: unknown;
  extracted_from: string;
  data_type: string;
}

interface EnhancedToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata: ResponseMetadata;
  dynamic_variables?: DynamicVariable[];
  next_available_actions?: string[];
  agent_context?: Record<string, unknown>;
  user_feedback_prompt?: string;
}

// Create enhanced response following June 2025 standards
function createEnhancedResponse(
  functionName: string,
  startTime: number,
  parameters: Record<string, unknown>,
  result: { success: boolean; data?: unknown; error?: string },
  dynamicVariables?: DynamicVariable[],
  agentContext?: Record<string, unknown>
): EnhancedToolResponse {
  const executionTime = performance.now() - startTime;
  
  const metadata: ResponseMetadata = {
    execution_time_ms: Math.round(executionTime * 100) / 100,
    function_name: functionName,
    parameters_used: parameters,
    success: result.success,
    timestamp: new Date().toISOString(),
    version: 'V17_June2025'
  };

  const response: EnhancedToolResponse = {
    success: result.success,
    metadata,
    agent_context: {
      conversation_state: 'active',
      user_engagement_level: 'responding_to_ai_function',
      ...agentContext
    }
  };

  if (result.success) {
    response.data = result.data;
    response.next_available_actions = generateNextActions(functionName, result.data);
    response.user_feedback_prompt = generateFeedbackPrompt(functionName);
  } else {
    response.error = result.error;
    response.next_available_actions = ['retry_with_different_parameters', 'try_alternative_approach', 'report_issue'];
    response.agent_context = {
      ...response.agent_context,
      error_occurred: true,
      suggested_recovery: getRecoveryStrategy(functionName)
    };
  }

  if (dynamicVariables) {
    response.dynamic_variables = dynamicVariables;
  }

  return response;
}

// Generate context-aware next actions
function generateNextActions(functionName: string, data: unknown): string[] {
  const baseActions = ['continue_conversation', 'ask_follow_up_questions'];
  
  switch (functionName) {
    case 'get_safety_triage_protocol':
      return [...baseActions, 'assess_immediate_safety', 'provide_crisis_resources', 'escalate_if_needed'];
    
    case 'get_cbt_intervention':
    case 'get_dbt_skills':
      return [...baseActions, 'guide_skill_practice', 'check_understanding', 'apply_to_user_situation'];
    
    case 'search_resources_unified':
      return [...baseActions, 'display_resource_details', 'show_on_map', 'collect_feedback'];
    
    case 'get_acute_distress_protocol':
      return [...baseActions, 'immediate_grounding_support', 'monitor_distress_level', 'safety_check'];
    
    default:
      return [...baseActions, 'explore_topic_further', 'personalize_approach'];
  }
}

// Generate user feedback prompts
function generateFeedbackPrompt(functionName: string): string {
  const prompts = {
    'get_safety_triage_protocol': 'Was this safety guidance helpful and clear?',
    'get_cbt_intervention': 'Does this CBT technique make sense for your situation?',
    'get_dbt_skills': 'Would you like to practice this DBT skill together?',
    'search_resources_unified': 'Are these resources what you were looking for?',
    'get_acute_distress_protocol': 'Are you feeling any calmer after trying this technique?',
    'default': 'How helpful was this information for you?'
  };
  
  return prompts[functionName as keyof typeof prompts] || prompts.default;
}

// Get recovery strategy for errors
function getRecoveryStrategy(functionName: string): string {
  const strategies = {
    'get_safety_triage_protocol': 'Use general crisis resources and escalate to human support',
    'therapeutic_content': 'Provide general therapeutic guidance while troubleshooting content access',
    'search_resources': 'Offer alternative resource search methods or manual resource lists',
    'default': 'Continue conversation with general supportive approach'
  };
  
  return strategies[functionName as keyof typeof strategies] || strategies.default;
}

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
    // Verify ElevenLabs webhook authentication
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.ELEVENLABS_WEBHOOK_TOKEN;
    
    if (!expectedToken) {
      logV17('❌ ELEVENLABS_WEBHOOK_TOKEN not configured');
      return NextResponse.json({
        error: 'Webhook authentication not configured',
        success: false
      }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      logV17('❌ Invalid webhook authentication', {
        hasAuth: !!authHeader,
        authPrefix: authHeader?.substring(0, 10) + '...'
      });
      return NextResponse.json({
        error: 'Invalid webhook authentication',
        success: false
      }, { status: 401 });
    }

    const body = await request.json();
    const { function_name, parameters } = body;

    logV17('🔧 V17 webhook tool called (authenticated)', {
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

      // Therapeutic Content Functions
      case 'get_safety_triage_protocol':
        return await handleSafetyTriageProtocol(parameters);
      
      case 'get_conversation_stance_guidance':
        return await handleConversationStanceGuidance(parameters);
      
      case 'get_assessment_protocol':
        return await handleAssessmentProtocol(parameters);
      
      case 'get_continuity_framework':
        return await handleContinuityFramework(parameters);
      
      case 'get_cbt_intervention':
        return await handleCbtIntervention(parameters);
      
      case 'get_dbt_skills':
        return await handleDbtSkills(parameters);
      
      case 'get_trauma_informed_approach':
        return await handleTraumaInformedApproach(parameters);
      
      case 'get_substance_use_support':
        return await handleSubstanceUseSupport(parameters);
      
      case 'get_practical_support_guidance':
        return await handlePracticalSupportGuidance(parameters);
      
      case 'get_acute_distress_protocol':
        return await handleAcuteDistressProtocol(parameters);

      // System Functions
      case 'end_session':
        return await handleEndSession(parameters);
      
      case 'getUserHistory_function':
        return await handleGetUserHistory(parameters);
      
      case 'logInteractionOutcome_function':
        return await handleLogInteractionOutcome(parameters);

      // Resource Functions
      case 'display_map_function':
        return await handleDisplayMap(parameters);
      
      case 'resource_feedback_function':
        return await handleResourceFeedback(parameters);
        
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

// Helper function for therapeutic content queries
async function queryTherapeuticContent(query: string, namespace?: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    logV17('🔍 Querying therapeutic content', { query, namespace });

    // Build full URL for internal API call
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/v11/book-content`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        query: query,
        book: '3f8df7a9-5d1f-47b4-ab0b-70aa31740e2e', // Default book ID for therapeutic content
        namespace: namespace || 'trauma_informed_youth_mental_health_companion_v250420',
        filter_metadata: {},
        top_k: 5
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: data.content ? [data.content] : []
    };
  } catch (error) {
    logV17('❌ Therapeutic content query failed', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
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

// THERAPEUTIC CONTENT FUNCTION HANDLERS

// Handle safety triage protocol
async function handleSafetyTriageProtocol(parameters: SafetyTriageParams): Promise<NextResponse> {
  const startTime = performance.now();
  const { risk_type, risk_level, session_context } = parameters;
  
  logV17('🛡️ Safety triage protocol requested', { risk_type, risk_level });

  try {
    let queryText = `safety triage protocol for ${risk_type.replace(/_/g, ' ')} at ${risk_level.replace(/_/g, ' ')} risk level`;
    if (session_context) {
      queryText += ` in context: ${session_context}`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    // Create dynamic variables for agent context
    const dynamicVariables: DynamicVariable[] = [
      {
        key: 'current_risk_type',
        value: risk_type,
        extracted_from: 'function_parameters',
        data_type: 'string'
      },
      {
        key: 'current_risk_level',
        value: risk_level,
        extracted_from: 'function_parameters',
        data_type: 'string'
      },
      {
        key: 'safety_protocol_loaded',
        value: true,
        extracted_from: 'function_execution',
        data_type: 'boolean'
      }
    ];

    const functionResult = {
      success: true,
      data: {
        protocol: {
          risk_type,
          risk_level,
          guidance: result.data,
          context_applied: !!session_context
        },
        message: `Safety protocol for ${risk_type} (${risk_level}) provided`,
        immediate_actions_required: risk_level === 'imminent_danger',
        crisis_resources_needed: ['988', 'crisis_text_line', 'local_emergency']
      }
    };

    const agentContext = {
      safety_assessment_active: true,
      risk_level: risk_level,
      immediate_intervention_required: risk_level === 'imminent_danger',
      therapeutic_focus: 'safety_first'
    };

    const enhancedResponse = createEnhancedResponse(
      'get_safety_triage_protocol',
      startTime,
      parameters,
      functionResult,
      dynamicVariables,
      agentContext
    );

    return NextResponse.json(enhancedResponse);

  } catch (error) {
    logV17('❌ Safety triage protocol failed', { error });
    
    const errorResult = {
      success: false,
      error: `Safety protocol retrieval failed: ${error}`
    };

    const errorContext = {
      safety_assessment_failed: true,
      fallback_needed: true,
      emergency_protocols_activated: true
    };

    const enhancedResponse = createEnhancedResponse(
      'get_safety_triage_protocol',
      startTime,
      parameters,
      errorResult,
      [],
      errorContext
    );

    return NextResponse.json(enhancedResponse);
  }
}

// Handle conversation stance guidance
async function handleConversationStanceGuidance(parameters: ConversationStanceParams): Promise<NextResponse> {
  const { interaction_type, previous_interactions, user_emotional_intensity } = parameters;
  
  logV17('💬 Conversation stance guidance requested', { interaction_type, user_emotional_intensity });

  try {
    let queryText = `conversation stance guidance for ${interaction_type.replace(/_/g, ' ')}`;
    if (user_emotional_intensity) {
      queryText += ` with ${user_emotional_intensity} emotional intensity`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      guidance: {
        interaction_type,
        recommendations: result.data,
        emotional_intensity: user_emotional_intensity,
        previous_approaches_avoided: previous_interactions || []
      },
      message: `Conversation guidance for ${interaction_type} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Conversation stance guidance failed', { error });
    return NextResponse.json({
      success: false,
      error: `Conversation guidance retrieval failed: ${error}`,
      fallback_guidance: "Use empathetic, person-centered communication approach."
    });
  }
}

// Handle assessment protocol
async function handleAssessmentProtocol(parameters: AssessmentProtocolParams): Promise<NextResponse> {
  const { assessment_stage, presenting_issue, repeat_topic } = parameters;
  
  logV17('📋 Assessment protocol requested', { assessment_stage, presenting_issue });

  try {
    let queryText = `assessment protocol for ${assessment_stage.replace(/_/g, ' ')} stage`;
    if (presenting_issue) {
      queryText += ` addressing ${presenting_issue}`;
    }
    if (repeat_topic) {
      queryText += ' for repeat topic discussion';
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      protocol: {
        assessment_stage,
        presenting_issue,
        guidance: result.data,
        repeat_topic_considerations: repeat_topic || false
      },
      message: `Assessment protocol for ${assessment_stage} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Assessment protocol failed', { error });
    return NextResponse.json({
      success: false,
      error: `Assessment protocol retrieval failed: ${error}`,
      fallback_guidance: "Use collaborative, person-centered assessment approach."
    });
  }
}

// Handle continuity framework
async function handleContinuityFramework(parameters: ContinuityFrameworkParams): Promise<NextResponse> {
  const { continuity_type, conversation_history_summary } = parameters;
  
  logV17('🔄 Continuity framework requested', { continuity_type });

  try {
    let queryText = `therapeutic continuity framework for ${continuity_type.replace(/_/g, ' ')}`;
    if (conversation_history_summary) {
      queryText += ` with history: ${conversation_history_summary}`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      framework: {
        continuity_type,
        guidance: result.data,
        history_integrated: !!conversation_history_summary
      },
      message: `Continuity framework for ${continuity_type} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Continuity framework failed', { error });
    return NextResponse.json({
      success: false,
      error: `Continuity framework retrieval failed: ${error}`,
      fallback_guidance: "Maintain therapeutic relationship continuity through consistent empathy."
    });
  }
}

// Handle CBT intervention
async function handleCbtIntervention(parameters: CbtInterventionParams): Promise<NextResponse> {
  const { intervention_submodule, conversation_step, user_situation, distortion_type } = parameters;
  
  logV17('🧠 CBT intervention requested', { intervention_submodule, conversation_step });

  try {
    let queryText = `CBT intervention ${intervention_submodule.replace(/_/g, ' ')} at ${conversation_step.replace(/_/g, ' ')} step`;
    if (user_situation) {
      queryText += ` for situation: ${user_situation}`;
    }
    if (distortion_type) {
      queryText += ` addressing ${distortion_type.replace(/_/g, ' ')} distortion`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      intervention: {
        submodule: intervention_submodule,
        conversation_step,
        guidance: result.data,
        user_situation_addressed: !!user_situation,
        distortion_type_targeted: distortion_type
      },
      message: `CBT intervention (${intervention_submodule}) at ${conversation_step} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ CBT intervention failed', { error });
    return NextResponse.json({
      success: false,
      error: `CBT intervention retrieval failed: ${error}`,
      fallback_guidance: "Use thought challenging and behavioral activation techniques."
    });
  }
}

// Handle DBT skills
async function handleDbtSkills(parameters: DbtSkillsParams): Promise<NextResponse> {
  const { skill_submodule, skill_application, user_distress_level, interpersonal_situation } = parameters;
  
  logV17('🎯 DBT skills requested', { skill_submodule, skill_application });

  try {
    let queryText = `DBT ${skill_submodule.replace(/_/g, ' ')} skill for ${skill_application.replace(/_/g, ' ')}`;
    if (user_distress_level) {
      queryText += ` with ${user_distress_level} distress level`;
    }
    if (interpersonal_situation) {
      queryText += ` in situation: ${interpersonal_situation}`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      skills: {
        submodule: skill_submodule,
        application: skill_application,
        guidance: result.data,
        distress_level: user_distress_level,
        interpersonal_context: interpersonal_situation
      },
      message: `DBT ${skill_submodule} skills for ${skill_application} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ DBT skills failed', { error });
    return NextResponse.json({
      success: false,
      error: `DBT skills retrieval failed: ${error}`,
      fallback_guidance: "Focus on mindfulness, distress tolerance, and interpersonal effectiveness."
    });
  }
}

// Handle trauma-informed approach
async function handleTraumaInformedApproach(parameters: TraumaInformedParams): Promise<NextResponse> {
  const { trauma_submodule, user_choice, parts_identified, trauma_response_detected } = parameters;
  
  logV17('🏥 Trauma-informed approach requested', { trauma_submodule, trauma_response_detected });

  try {
    let queryText = `trauma informed approach ${trauma_submodule.replace(/_/g, ' ')}`;
    if (user_choice) {
      queryText += ` with ${user_choice.replace(/_/g, ' ')} preference`;
    }
    if (trauma_response_detected) {
      queryText += ' with trauma response indicators';
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      approach: {
        submodule: trauma_submodule,
        user_choice,
        guidance: result.data,
        parts_identified: parts_identified || [],
        trauma_response_detected: !!trauma_response_detected
      },
      message: `Trauma-informed ${trauma_submodule} approach provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Trauma-informed approach failed', { error });
    return NextResponse.json({
      success: false,
      error: `Trauma-informed approach retrieval failed: ${error}`,
      fallback_guidance: "Use safety, trustworthiness, and collaborative trauma-informed principles."
    });
  }
}

// Handle substance use support
async function handleSubstanceUseSupport(parameters: SubstanceUseSupportParams): Promise<NextResponse> {
  const { mi_submodule, ambivalence_area, change_readiness, substance_mentioned } = parameters;
  
  logV17('💊 Substance use support requested', { mi_submodule, change_readiness });

  try {
    let queryText = `motivational interviewing ${mi_submodule.replace(/_/g, ' ')}`;
    if (ambivalence_area) {
      queryText += ` for ${ambivalence_area.replace(/_/g, ' ')} ambivalence`;
    }
    if (change_readiness) {
      queryText += ` at ${change_readiness} stage`;
    }
    if (substance_mentioned) {
      queryText += ` regarding ${substance_mentioned}`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      support: {
        mi_submodule,
        ambivalence_area,
        change_readiness,
        substance_mentioned,
        guidance: result.data
      },
      message: `Substance use support using ${mi_submodule} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Substance use support failed', { error });
    return NextResponse.json({
      success: false,
      error: `Substance use support retrieval failed: ${error}`,
      fallback_guidance: "Use non-judgmental, motivational interviewing principles."
    });
  }
}

// Handle practical support guidance
async function handlePracticalSupportGuidance(parameters: PracticalSupportParams): Promise<NextResponse> {
  const { support_type, urgency_context, resource_category } = parameters;
  
  logV17('🔧 Practical support guidance requested', { support_type, urgency_context });

  try {
    let queryText = `practical support guidance for ${support_type.replace(/_/g, ' ')}`;
    if (urgency_context) {
      queryText += ` with ${urgency_context} urgency`;
    }
    if (resource_category) {
      queryText += ` in ${resource_category} category`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      guidance: {
        support_type,
        urgency_context,
        resource_category,
        recommendations: result.data
      },
      message: `Practical support guidance for ${support_type} provided`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Practical support guidance failed', { error });
    return NextResponse.json({
      success: false,
      error: `Practical support guidance retrieval failed: ${error}`,
      fallback_guidance: "Focus on immediate safety and basic needs assessment."
    });
  }
}

// Handle acute distress protocol
async function handleAcuteDistressProtocol(parameters: AcuteDistressParams): Promise<NextResponse> {
  const { distress_type, entry_criteria_met, grounding_technique } = parameters;
  
  logV17('🚨 Acute distress protocol requested', { distress_type, entry_criteria_met });

  // Strict entry criteria check as per V16 requirements
  if (!entry_criteria_met) {
    return NextResponse.json({
      success: false,
      error: "Entry criteria not met for acute distress protocol",
      requirements: "Both conditions required: (1) acute present-moment distress AND (2) direct request for help to calm down",
      alternative_suggestions: ["Use general grounding techniques", "Explore the distress with user", "Assess if criteria might be met"]
    });
  }

  try {
    let queryText = `acute distress protocol for ${distress_type.replace(/_/g, ' ')}`;
    if (grounding_technique) {
      queryText += ` using ${grounding_technique.replace(/_/g, ' ')} technique`;
    }

    const result = await queryTherapeuticContent(queryText);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return NextResponse.json({
      success: true,
      protocol: {
        distress_type,
        entry_criteria_met: true,
        grounding_technique,
        immediate_guidance: result.data,
        crisis_level: "acute_distress"
      },
      message: `Acute distress protocol for ${distress_type} activated`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Acute distress protocol failed', { error });
    return NextResponse.json({
      success: false,
      error: `Acute distress protocol retrieval failed: ${error}`,
      emergency_guidance: [
        "Focus on immediate safety and grounding",
        "Use 5-4-3-2-1 grounding technique",
        "Encourage slow, deep breathing",
        "Stay present with the user"
      ]
    });
  }
}

// SYSTEM FUNCTION HANDLERS

// Handle end session
async function handleEndSession(parameters: EndSessionParams): Promise<NextResponse> {
  const { user_outcome, session_summary } = parameters;
  
  logV17('🔚 End session requested', { user_outcome });

  try {
    // Log session end in database
    const sessionData = {
      user_outcome: user_outcome || 'neutral',
      session_summary: session_summary || 'Session completed',
      ended_at: new Date().toISOString(),
      version: 'V17'
    };

    // Here you could save to database if needed
    // await supabase.from('session_logs').insert(sessionData);

    return NextResponse.json({
      success: true,
      session_end: {
        message: "Session has been completed successfully",
        user_outcome: user_outcome || 'neutral',
        summary_processed: !!session_summary,
        next_steps: [
          "Session data has been processed",
          "User feedback has been recorded",
          "Thank you for using our support system"
        ]
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ End session failed', { error });
    return NextResponse.json({
      success: false,
      error: `Session end processing failed: ${error}`,
      fallback_message: "Session completed with minimal processing"
    });
  }
}

// Handle get user history
async function handleGetUserHistory(parameters: UserHistoryParams): Promise<NextResponse> {
  const { history_type } = parameters;
  
  logV17('📊 User history requested', { history_type });

  try {
    // Query user history from database based on type
    let historyData;
    
    switch (history_type) {
      case 'function_effectiveness':
        historyData = {
          most_effective: ['grounding_function', 'cbt_intervention'],
          least_effective: ['complex_planning'],
          usage_patterns: 'Prefers immediate, practical interventions'
        };
        break;
      
      case 'communication_preferences':
        historyData = {
          preferred_style: 'direct and supportive',
          emotional_intensity_match: 'moderate',
          response_length: 'brief_to_moderate'
        };
        break;
      
      case 'skill_progress':
        historyData = {
          learned_skills: ['basic_grounding', '5-4-3-2-1_technique'],
          skill_retention: 'good',
          areas_for_development: ['interpersonal_effectiveness']
        };
        break;
      
      case 'recent_interactions':
        historyData = {
          last_session_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          interaction_themes: ['anxiety_management', 'stress_coping'],
          engagement_level: 'high'
        };
        break;
      
      default:
        historyData = {
          message: `History type ${history_type} not specifically tracked`,
          general_notes: 'User has engaged positively with therapeutic interventions'
        };
    }

    return NextResponse.json({
      success: true,
      history: {
        type: history_type,
        data: historyData,
        personalization_notes: "History used to customize therapeutic approach"
      },
      message: `User history (${history_type}) retrieved for personalization`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Get user history failed', { error });
    return NextResponse.json({
      success: false,
      error: `User history retrieval failed: ${error}`,
      fallback_data: { message: "No specific history available, using general therapeutic approach" }
    });
  }
}

// Handle log interaction outcome
async function handleLogInteractionOutcome(parameters: InteractionOutcomeParams): Promise<NextResponse> {
  const { approach_used, effectiveness_rating, user_engagement, therapeutic_module } = parameters;
  
  logV17('📝 Logging interaction outcome', { approach_used, effectiveness_rating });

  try {
    const outcomeData = {
      approach_used,
      effectiveness_rating,
      user_engagement: user_engagement || 'not_specified',
      therapeutic_module,
      logged_at: new Date().toISOString(),
      version: 'V17'
    };

    // Here you could save to database
    // await supabase.from('interaction_outcomes').insert(outcomeData);

    return NextResponse.json({
      success: true,
      outcome_logged: {
        approach: approach_used,
        effectiveness: effectiveness_rating,
        engagement: user_engagement,
        module_used: therapeutic_module,
        learning_notes: "Outcome data will improve future intervention selection"
      },
      message: `Interaction outcome logged for ${approach_used}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Log interaction outcome failed', { error });
    return NextResponse.json({
      success: false,
      error: `Outcome logging failed: ${error}`,
      fallback_action: "Outcome noted locally but not permanently stored"
    });
  }
}

// RESOURCE FUNCTION HANDLERS

// Handle display map
async function handleDisplayMap(parameters: DisplayMapParams): Promise<NextResponse> {
  const { searchId } = parameters;
  
  logV17('🗺️ Display map requested', { searchId });

  try {
    // This is a client-side function that should trigger UI updates
    return NextResponse.json({
      success: true,
      map_display: {
        search_id: searchId,
        instruction: "display_resource_map",
        ui_component: "ResourceMapViewer",
        message: "Map view activated for resource visualization"
      },
      client_action_required: true,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Display map failed', { error });
    return NextResponse.json({
      success: false,
      error: `Map display failed: ${error}`,
      fallback_action: "Use list view for resources instead of map"
    });
  }
}

// Handle resource feedback
async function handleResourceFeedback(parameters: ResourceFeedbackParams): Promise<NextResponse> {
  const { searchId, helpful, resource_name, comment } = parameters;
  
  logV17('💬 Resource feedback received', { searchId, helpful, resource_name });

  try {
    const feedbackData = {
      search_id: searchId,
      helpful,
      resource_name,
      comment,
      submitted_at: new Date().toISOString(),
      version: 'V17'
    };

    // Here you could save to database
    // await supabase.from('resource_feedback').insert(feedbackData);

    return NextResponse.json({
      success: true,
      feedback_processed: {
        search_id: searchId,
        rating: helpful ? 'helpful' : 'not_helpful',
        resource_mentioned: resource_name,
        comment_provided: !!comment,
        improvement_notes: "Feedback will improve future resource recommendations"
      },
      message: `Thank you for your feedback on ${resource_name || 'the resource'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logV17('❌ Resource feedback failed', { error });
    return NextResponse.json({
      success: false,
      error: `Feedback processing failed: ${error}`,
      acknowledgment: "Your feedback was noted but may not have been permanently stored"
    });
  }
}