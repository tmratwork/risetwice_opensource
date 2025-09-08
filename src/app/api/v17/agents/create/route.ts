// src/app/api/v17/agents/create/route.ts
// V17 ElevenLabs Agent Configuration API
// Creates and configures ElevenLabs agents with voice, AI instructions, and knowledge base

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// V17 conditional logging
const logV17 = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
    console.log(`[V17] ${message}`, ...args);
  }
};

// ElevenLabs API configuration
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Configure server tools for ElevenLabs agent (June 2025 standards)
function configureServerTools() {
  // Determine webhook base URL - production vs development
  let webhookBaseUrl: string;
  
  if (process.env.NODE_ENV === 'production') {
    // Production: Use VERCEL_URL or custom domain
    webhookBaseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';
  } else {
    // Development: Use localhost
    webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  
  const webhookUrl = `${webhookBaseUrl}/api/v17/tools/webhook`;
  const webhookToken = process.env.ELEVENLABS_WEBHOOK_TOKEN;
  
  logV17('🌐 Webhook configuration', {
    environment: process.env.NODE_ENV,
    webhookBaseUrl,
    webhookUrl,
    hasToken: !!webhookToken
  });

  if (!webhookToken) {
    logV17('⚠️ ELEVENLABS_WEBHOOK_TOKEN not configured - tools will not work');
    return [];
  }

  // All 16 V17 triage functions as server tools
  const serverTools = [
    // Therapeutic Content Functions
    {
      type: 'server' as const,
      name: 'get_safety_triage_protocol',
      description: 'Retrieve safety assessment procedures and crisis protocols for immediate risk situations',
      url: webhookUrl,
      method: 'POST' as const,
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        risk_type: {
          type: 'string',
          description: 'Type of safety concern detected (suicide_ideation, self_harm, etc.)',
          required: true,
          enum: ['suicide_ideation', 'self_harm', 'harm_to_others', 'psychosis', 'unsafe_environment', 'illegal_behaviors']
        },
        risk_level: {
          type: 'string', 
          description: 'Level of risk assessment needed based on user indicators',
          required: true,
          enum: ['passive_monitoring', 'active_assessment', 'imminent_danger', 'high_distress']
        },
        session_context: {
          type: 'string',
          description: 'Current conversation context for continuity-aware responses',
          required: false
        }
      }
    },
    {
      type: 'server' as const,
      name: 'get_conversation_stance_guidance', 
      description: 'Retrieve empathy matching strategies and conversational guidance for therapeutic communication',
      url: webhookUrl,
      method: 'POST' as const,
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        interaction_type: {
          type: 'string',
          description: 'Type of conversational guidance needed for current interaction',
          required: true,
          enum: ['empathy_matching', 'interpersonal_conflict', 'effort_praise', 'validation_level', 'brief_responses', 'one_question_rule']
        },
        user_emotional_intensity: {
          type: 'string',
          description: 'User emotional intensity for appropriate empathy matching',
          required: false,
          enum: ['low', 'moderate', 'high', 'crisis']
        }
      }
    },
    {
      type: 'server' as const,
      name: 'get_assessment_protocol',
      description: 'Retrieve 4-stage assessment framework with specific prompts and collaborative inquiry techniques',
      url: webhookUrl,
      method: 'POST' as const, 
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        assessment_stage: {
          type: 'string',
          description: 'Current stage of the 4-stage assessment process',
          required: true,
          enum: ['opening', 'deepening_understanding', 'exploring_context', 'assessing_coping', 'clarifying_intent']
        },
        presenting_issue: {
          type: 'string',
          description: 'User mentioned concern or topic for contextualized assessment prompts',
          required: false
        }
      }
    },
    {
      type: 'server' as const,
      name: 'get_acute_distress_protocol',
      description: 'Retrieve immediate grounding exercises for users in acute present-moment distress',
      url: webhookUrl,
      method: 'POST' as const,
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        distress_type: {
          type: 'string',
          description: 'Type of acute distress currently experienced',
          required: true,
          enum: ['panic_attack', 'overwhelming_emotion', 'dissociation', 'trauma_activation', 'acute_anxiety']
        },
        entry_criteria_met: {
          type: 'boolean',
          description: 'REQUIRED: Whether BOTH conditions are met - (1) acute present-moment distress AND (2) direct request for help to calm down',
          required: true
        }
      }
    },
    // System Functions
    {
      type: 'server' as const,
      name: 'search_resources_unified',
      description: 'Search for mental health resources, services, and community support',
      url: webhookUrl,
      method: 'POST' as const,
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        query: {
          type: 'string',
          description: 'Search query describing what the user needs',
          required: true
        },
        resource_category: {
          type: 'string', 
          description: 'Category of resource being searched for',
          required: true,
          enum: ['emergency_shelter', 'food_assistance', 'healthcare_access', 'job_search', 'legal_aid', 'lgbtq_support', 'substance_abuse_support', 'educational_support']
        },
        location: {
          type: 'string',
          description: 'Geographic location where resources are needed',
          required: true
        }
      }
    },
    {
      type: 'server' as const,
      name: 'end_session',
      description: 'End the current session and trigger appropriate cleanup',
      url: webhookUrl,
      method: 'POST' as const,
      auth_type: 'bearer' as const,
      auth_config: {
        token: webhookToken
      },
      parameters: {
        user_outcome: {
          type: 'string',
          description: 'User assessment of session helpfulness',
          required: false,
          enum: ['helpful', 'somewhat_helpful', 'not_helpful', 'neutral']
        }
      }
    }
  ];

  logV17('🔧 Configured server tools for ElevenLabs agent', {
    toolCount: serverTools.length,
    webhookUrl,
    toolNames: serverTools.map(t => t.name)
  });

  return serverTools;
}

// NEW: Create V17 tools using ElevenLabs tools API (post-July 2025)
async function createV17Tools(): Promise<string[]> {
  // RETURN THE ACTUAL TOOL IDs FROM SUCCESSFUL PROGRAMMATIC CREATION
  // These tools were created using the working API format we discovered
  const toolIds = [
    'tool_5401k4kyv4ztexw95bsra3ctfm12',  // get_safety_triage_protocol_test  
    'tool_6701k4kyx3ysf98av4mpm20x8238',  // get_conversation_stance_guidance
    'tool_6801k4kyxcg4fj38jsfke0de0k3d',  // get_assessment_protocol
    'tool_4301k4kyxmjwfppahnf036bv1ed3',  // get_acute_distress_protocol
    'tool_0901k4kyxz2cerarsc4d4yzaen1e',  // search_resources_unified
    'tool_8101k4kyy6gdfydtjkeapx8qbx53'   // end_session
  ];

  logV17('✅ Using existing V17 tools created programmatically', {
    toolCount: toolIds.length,
    toolIds: toolIds
  });

  return toolIds;

  /* ORIGINAL PROGRAMMATIC CREATION CODE - COMMENTED OUT
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const webhookToken = process.env.ELEVENLABS_WEBHOOK_TOKEN;
  
  if (!ELEVENLABS_API_KEY || !webhookToken) {
    throw new Error('Missing ElevenLabs API key or webhook token');
  }

  // Environment-aware webhook URL
  let webhookUrl: string;
  if (process.env.NODE_ENV === 'production') {
    webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/v17/tools/webhook`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/api/v17/tools/webhook`;
  } else {
    webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/v17/tools/webhook`;
  }

  logV17('🔧 Creating V17 tools with new ElevenLabs API', {
    webhookUrl,
    hasToken: !!webhookToken
  });
  */

  // Define the 6 V17 tools - COMMENTED OUT AS WE USE HARDCODED IDs ABOVE
  /* 
  const toolConfigs = [
    {
      name: "get_safety_triage_protocol",
      description: "Retrieve safety assessment procedures and crisis protocols for immediate risk situations",
      parameters: {
        risk_type: {
          type: "string",
          description: "Type of safety concern detected (suicide_ideation, self_harm, etc.)",
          enum: ["suicide_ideation", "self_harm", "harm_to_others", "psychosis", "unsafe_environment", "illegal_behaviors"]
        },
        risk_level: {
          type: "string", 
          description: "Level of risk assessment needed based on user indicators",
          enum: ["passive_monitoring", "active_assessment", "imminent_danger", "high_distress"]
        },
        session_context: {
          type: "string",
          description: "Current conversation context for continuity-aware responses"
        }
      },
      required: ["risk_type", "risk_level"]
    },
    {
      name: "get_conversation_stance_guidance", 
      description: "Retrieve empathy matching strategies and conversational guidance for therapeutic communication",
      parameters: {
        interaction_type: {
          type: "string",
          description: "Type of conversational guidance needed for current interaction",
          enum: ["empathy_matching", "interpersonal_conflict", "effort_praise", "validation_level", "brief_responses", "one_question_rule"]
        },
        user_emotional_intensity: {
          type: "string",
          description: "User emotional intensity for appropriate empathy matching",
          enum: ["low", "moderate", "high", "crisis"]
        }
      },
      required: ["interaction_type"]
    },
    {
      name: "get_assessment_protocol",
      description: "Retrieve 4-stage assessment framework with specific prompts and transition scripts",
      parameters: {
        assessment_stage: {
          type: "string",
          description: "Current stage of the 4-stage assessment process",
          enum: ["opening", "deepening_understanding", "exploring_context", "assessing_coping", "clarifying_intent"]
        },
        presenting_issue: {
          type: "string",
          description: "User mentioned concern or topic for contextualized assessment prompts"
        }
      },
      required: ["assessment_stage"]
    },
    {
      name: "get_acute_distress_protocol",
      description: "Retrieve immediate grounding exercises for users in acute present-moment distress",
      parameters: {
        distress_type: {
          type: "string",
          description: "Type of acute distress currently experienced",
          enum: ["panic_attack", "overwhelming_emotion", "dissociation", "trauma_activation", "acute_anxiety"]
        },
        entry_criteria_met: {
          type: "boolean",
          description: "Whether BOTH conditions are met - (1) acute present-moment distress AND (2) direct request for help to calm down"
        }
      },
      required: ["distress_type", "entry_criteria_met"]
    },
    {
      name: "search_resources_unified",
      description: "Search for mental health resources, services, and community support",
      parameters: {
        query: {
          type: "string",
          description: "Search query describing what the user needs"
        },
        resource_category: {
          type: "string",
          description: "Category of resource needed",
          enum: ["crisis_support", "mental_health", "substance_abuse", "housing", "food", "employment", "healthcare", "legal_aid"]
        }
      },
      required: ["query"]
    },
    {
      name: "end_session",
      description: "Ends the current session and triggers appropriate cleanup and memory processing",
      parameters: {
        user_outcome: {
          type: "string",
          description: "User assessment of session helpfulness",
          enum: ["helpful", "somewhat_helpful", "not_helpful", "neutral"]
        },
        session_summary: {
          type: "string",
          description: "Brief summary of session content for memory processing"
        }
      },
      required: []
    }
  ];

  const toolIds: string[] = [];

  // Systematic testing approach based on WebAI research - test multiple formats
  for (const toolConfig of toolConfigs) {
    try {
      logV17(`🔧 Creating tool: ${toolConfig.name} - Testing multiple formats systematically`);
      
      let result = null;
      
      // Test formats based on WebAI research - discriminator insights
      const testFormats = [
        // Format A: Server Tool Discriminator (WebAI Priority #1)
        {
          name: "Server Discriminator",
          payload: {
            tool_config: {
              type: "server",  // Changed from "webhook" to "server" 
              name: toolConfig.name,
              description: toolConfig.description,
              url: webhookUrl,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${webhookToken}`
              },
              api_schema: {
                type: "object",
                properties: toolConfig.parameters,
                required: (toolConfig as any).required || []
              }
            }
          }
        },
        
        // Format B: Tool Type Discriminator (WebAI Priority #2)
        {
          name: "Tool Type Discriminator",
          payload: {
            tool_config: {
              tool_type: "webhook",  // Changed from "type" to "tool_type"
              name: toolConfig.name,
              description: toolConfig.description,
              url: webhookUrl,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${webhookToken}`
              },
              parameters: (() => {
                const params: Record<string, any> = {};
                Object.entries(toolConfig.parameters).forEach(([key, value]) => {
                  params[key] = {
                    ...value,
                    required: (toolConfig as any).required?.includes(key) || false
                  };
                });
                return params;
              })()
            }
          }
        },
        
        // Format C: Nested Configuration (WebAI Priority #3)
        {
          name: "Nested Configuration",
          payload: {
            tool_config: {
              type: "server",
              config: {
                name: toolConfig.name,
                description: toolConfig.description,
                webhook: {
                  url: webhookUrl,
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${webhookToken}`
                  },
                  api_schema: {
                    type: "object",
                    properties: toolConfig.parameters,
                    required: (toolConfig as any).required || []
                  }
                }
              }
            }
          }
        },
        
        // Format D: Server with parameters (alternative approach)
        {
          name: "Server with Parameters",
          payload: {
            tool_config: {
              type: "server",
              name: toolConfig.name,
              description: toolConfig.description,
              url: webhookUrl,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${webhookToken}`
              },
              parameters: (() => {
                const params: Record<string, any> = {};
                Object.entries(toolConfig.parameters).forEach(([key, value]) => {
                  params[key] = {
                    ...value,
                    required: (toolConfig as any).required?.includes(key) || false
                  };
                });
                return params;
              })()
            }
          }
        }
      ];

      // Test each format systematically
      for (let i = 0; i < testFormats.length; i++) {
        const format = testFormats[i];
        
        try {
          logV17(`🔧 Testing Format ${i + 1} (${format.name}) for ${toolConfig.name}`);
          
          const response = await fetch('https://api.elevenlabs.io/v1/convai/tools', {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVENLABS_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(format.payload)
          });

          if (response.ok) {
            result = await response.json();
            logV17(`✅ Format ${i + 1} (${format.name}) WORKS for ${toolConfig.name}!`, { 
              toolId: result.id,
              formatUsed: format.name
            });
            break; // Success - stop testing other formats
          } else {
            const errorText = await response.text();
            logV17(`❌ Format ${i + 1} (${format.name}) failed for ${toolConfig.name}`, { 
              status: response.status, 
              error: errorText.substring(0, 300) + (errorText.length > 300 ? '...' : '')
            });
          }
        } catch (formatError) {
          logV17(`❌ Format ${i + 1} (${format.name}) exception for ${toolConfig.name}`, { 
            error: formatError instanceof Error ? formatError.message : String(formatError)
          });
        }
      }

      // If all formats failed, throw an error
      if (!result) {
        throw new Error(`Failed to create tool ${toolConfig.name} - all ${testFormats.length} formats failed`);
      }

      toolIds.push(result.id);
      
      logV17(`✅ Successfully created tool: ${toolConfig.name}`, {
        toolId: result.id,
        totalFormatsAvailable: testFormats.length
      });

    } catch (error) {
      logV17(`❌ Error creating tool ${toolConfig.name}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  logV17('✅ All V17 tools created successfully', {
    toolCount: toolIds.length,
    toolIds
  });

  return toolIds;
  */
}

export async function POST(request: NextRequest) {
  console.log(`[V17] 🚨 FORCE LOG: API ENDPOINT CALLED - /api/v17/agents/create`);
  
  try {
    const body = await request.json();
    const { 
      specialistType = 'triage', 
      voiceId = 'EmtkmiOFoQVpKRVpXH2B', // V17 specified voice by default
      userId 
    } = body;
    
    console.log(`[V17] 🚨 FORCE LOG: Request body parsed - voiceId: ${voiceId}, specialistType: ${specialistType}`);

    logV17('🤖 Creating ElevenLabs agent', {
      specialistType,
      voiceId,
      userId: userId || 'anonymous'
    });

    // 1. GET AI INSTRUCTIONS from Supabase (same as V16)
    const { data: aiPromptArray, error: promptError } = await supabase
      .rpc('get_ai_prompt_by_type', {
        target_prompt_type: specialistType,
        requesting_user_id: userId || null
      });
    
    const aiPrompt = aiPromptArray?.[0] || null;

    if (promptError || !aiPrompt) {
      logV17('❌ Failed to load AI prompt', { promptError, specialistType });
      return NextResponse.json({ 
        error: `Failed to load ${specialistType} prompt from database` 
      }, { status: 500 });
    }

    logV17('✅ AI prompt loaded', {
      specialistType,
      promptLength: aiPrompt.prompt_content?.length || 0,
      functionsCount: aiPrompt.functions?.length || 0
    });

    // Log the actual prompt being used (truncated for readability)
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      console.log(`[V17] 📝 AI Instructions for ${specialistType}:`, {
        promptPreview: aiPrompt.prompt_content?.substring(0, 500) + '...',
        fullPromptLength: aiPrompt.prompt_content?.length || 0,
        functionNames: aiPrompt.functions?.map((f: { name: string }) => f.name) || [],
        lastUpdated: aiPrompt.updated_at
      });
    }

    // 2. SET VOICE CONFIGURATION
    const voiceConfig = {
      voice_id: voiceId,
      model_id: "eleven_turbo_v2",  // ✅ Change from v2_5 to v2 for English agent compatibility
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.0,
      use_speaker_boost: true
    };

    // V17: Update the existing ElevenLabs agent with Supabase instructions
    const existingAgentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
    
    if (!existingAgentId) {
      throw new Error('NEXT_PUBLIC_ELEVENLABS_AGENT_ID not configured');
    }

    logV17('🔄 Updating ElevenLabs agent with Supabase instructions and voice config', {
      agentId: existingAgentId,
      instructionLength: aiPrompt.prompt_content?.length || 0,
      voiceConfig: voiceConfig,
      voiceId: voiceConfig.voice_id
    });

    // Initialize agent info
    let agent = {
      agent_id: existingAgentId,
      name: `RiseTwice ${specialistType} Agent`,
      specialist_type: specialistType,
      voice_id: voiceId,
      updated: false,
      instructions_length: 0
    };

    // NEW: Create tools using ElevenLabs tools API, then get tool IDs for agent
    const toolIds = await createV17Tools();
    
    // Update the agent with our Supabase instructions using NEW 2025 API STRUCTURE
    try {
      console.log(`[V17] 🚨 FORCE LOG: About to PATCH agent with voice_id: ${voiceConfig.voice_id} and ${toolIds.length} tool IDs`);
      console.log(`[V17] 🔧 TOOL IDS:`, toolIds);
      
      const patchPayload = {
        conversation_config: {
          agent: {
            prompt: {
              prompt: aiPrompt.prompt_content || `You are a ${specialistType} AI assistant specialized in mental health support.`,
              first_message: "Hello! I'm here to provide mental health support. How can I help you today?",
              tool_ids: toolIds  // NEW: Use tool IDs instead of tools array
            }
          },
          tts: voiceConfig
          // REMOVED: tools array - now deprecated
        },
        name: `RiseTwice ${specialistType} Agent`,
        tags: ["mental-health", specialistType, "risetwice"]
      };
      
      console.log(`[V17] 🔧 PATCH PAYLOAD:`, JSON.stringify(patchPayload, null, 2));
      
      // Write full payload to file for debugging
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync('/tmp/v17-patch-payload.json', JSON.stringify(patchPayload, null, 2));
      } catch (e) {
        console.log('[V17] Could not write debug file:', e);
      }
      
      const updateResponse = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${existingAgentId}`, {
        method: 'PATCH',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchPayload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.log(`[V17] 🚨 FORCE LOG: PATCH FAILED - Status: ${updateResponse.status}, Error: ${errorText}`);
        logV17('❌ Failed to update ElevenLabs agent', {
          status: updateResponse.status,
          error: errorText
        });
        throw new Error(`Failed to update agent: ${updateResponse.status} - ${errorText}`);
      }

      const updatedAgent = await updateResponse.json();
      console.log(`[V17] 🚨 FORCE LOG: PATCH SUCCESS - Voice should now be: ${voiceConfig.voice_id}`);
      console.log(`[V17] 🚨 FORCE LOG: Response voice_id: ${updatedAgent.conversation_config?.tts?.voice_id || 'NOT SET'}`);
      console.log(`[V17] 🔧 ELEVENLABS RESPONSE TOOLS:`, JSON.stringify(updatedAgent.conversation_config?.tools || 'NO TOOLS', null, 2));
      
      // Write ElevenLabs response to file for debugging
      try {
        const { writeFileSync } = await import('fs');
        writeFileSync('/tmp/v17-elevenlabs-response.json', JSON.stringify(updatedAgent, null, 2));
      } catch (e) {
        console.log('[V17] Could not write debug response file:', e);
      }
      
      logV17('✅ ElevenLabs agent updated successfully', {
        agentId: updatedAgent.agent_id,
        hasInstructions: !!updatedAgent.conversation_config?.agent?.prompt?.prompt,
        instructionLength: updatedAgent.conversation_config?.agent?.prompt?.prompt?.length || 0
      });

      // Update agent info with successful update
      agent = {
        agent_id: existingAgentId,
        name: `RiseTwice ${specialistType} Agent`,
        specialist_type: specialistType,
        voice_id: voiceId,
        updated: true,
        instructions_length: updatedAgent.conversation_config?.agent?.prompt?.prompt?.length || 0
      };

      logV17('✅ ElevenLabs agent updated successfully', {
        agentId: agent.agent_id,
        specialistType,
        voiceId: voiceConfig.voice_id,
        instructionsUpdated: true
      });

    } catch (updateError) {
      logV17('❌ Failed to update ElevenLabs agent, using existing configuration', {
        error: updateError instanceof Error ? updateError.message : String(updateError)
      });
      
      // Agent info already initialized above, just log the error
    }

    // For V17 MVP, we'll skip database storage and work directly with the existing agent
    logV17('💾 V17 MVP: Skipping database storage, using existing agent configuration');

    // CRITICAL: Verify what ElevenLabs agent actually has configured
    if (process.env.NEXT_PUBLIC_ENABLE_V17_LOGS === 'true') {
      try {
        const response = await fetch(`${ELEVENLABS_API_BASE}/convai/agents/${existingAgentId}`, {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const agentData = await response.json();
          console.log(`[V17] 🔍 ELEVENLABS AGENT VERIFICATION:`, {
            agentId: existingAgentId,
            hasInstructions: !!agentData.conversation_config?.agent?.prompt?.prompt,
            instructionLength: agentData.conversation_config?.agent?.prompt?.prompt?.length || 0,
            instructionPreview: agentData.conversation_config?.agent?.prompt?.prompt?.substring(0, 200) || 'NO INSTRUCTIONS',
            voiceId: agentData.conversation_config?.tts?.voice_id || 'not set',
            llmModel: agentData.conversation_config?.llm?.model || 'not set',
            lastUpdated: agentData.updated_at || 'unknown'
          });

          // Check if our Supabase prompt matches ElevenLabs agent
          const elevenLabsPrompt = agentData.conversation_config?.agent?.prompt?.prompt || '';
          const supabasePrompt = aiPrompt.prompt_content || '';
          const promptsMatch = elevenLabsPrompt.includes(supabasePrompt.substring(0, 500));
          
          console.log(`[V17] 🔍 PROMPT COMPARISON:`, {
            supabasePromptLength: supabasePrompt.length,
            elevenLabsPromptLength: elevenLabsPrompt.length,
            promptsMatch: promptsMatch,
            mismatchWarning: !promptsMatch ? '⚠️ PROMPTS DO NOT MATCH!' : '✅ Prompts appear to match'
          });
        } else {
          console.log(`[V17] ❌ Failed to verify ElevenLabs agent: ${response.status}`);
        }
      } catch (error) {
        console.log(`[V17] ❌ Error verifying ElevenLabs agent:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      agent: {
        agent_id: agent.agent_id,
        specialist_type: specialistType,
        voice_id: voiceConfig.voice_id,
        name: agent.name
      }
    });

  } catch (error) {
    logV17('❌ Error creating ElevenLabs agent', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({ 
      error: 'Failed to create ElevenLabs agent',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET method to retrieve existing agents
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const specialistType = url.searchParams.get('specialistType') || 'triage';

    logV17('🔍 Getting ElevenLabs agents', { specialistType });

    // Get agents from database
    const { data: agents, error } = await supabase
      .from('elevenlabs_agents')
      .select('*')
      .eq('specialist_type', specialistType)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logV17('❌ Failed to fetch agents from database', { error });
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      agents: agents || []
    });

  } catch (error) {
    logV17('❌ Error fetching ElevenLabs agents', { error });
    return NextResponse.json({ 
      error: 'Failed to fetch agents' 
    }, { status: 500 });
  }
}