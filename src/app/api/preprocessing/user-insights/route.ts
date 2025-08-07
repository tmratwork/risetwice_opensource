/**
 * File: src/app/api/preprocessing/user-insights/route.ts
 * API endpoint to generate trauma-informed user insights from chat logs
 * This implements a privacy-first, ethical approach to data analysis as specified in the requirements
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { anthropic } from '@/lib/anthropic';

// Define Supabase error interface
interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

// Define typings for the insight buckets
interface UserInsight {
  type: 'strength' | 'goal' | 'coping' | 'resource' | 'risk' | 'engagement';
  content: string;
  source: string; // Message ID or conversation reference
  timestamp: string;
  confidence: number; // 0-1 scale
}

interface InsightAnalysisRequest {
  userId: string;
  startDate?: string;
  endDate?: string;
  insightTypes?: string[]; // Optional filter for specific insight types
  analyzeAll?: boolean; // Whether to ignore privacy settings (admin only)
}

// Define interface for job insights structure
interface JobInsights {
  insightId?: string;
  insights: {
    strengths: UserInsight[];
    goals: UserInsight[];
    coping: UserInsight[];
    resources: UserInsight[];
    risks: UserInsight[];
    engagement: UserInsight[];
  } | GroupedInsights;
  stats?: {
    conversations: number;
    messages: number;
    insightsExtracted: number;
  };
  warning?: string;
}

// Define GroupedInsights type
type GroupedInsights = {
  strengths: UserInsight[];
  goals: UserInsight[];
  coping: UserInsight[];
  resources: UserInsight[];
  risks: UserInsight[];
  engagement: UserInsight[];
}

// Job types
type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Helper functions for job management using Supabase instead of memory
async function createJob(jobId: string, userId: string, totalConversations: number) {
  try {
    const { error } = await supabase
      .from('job_status')
      .insert({
        id: jobId,
        user_id: userId,
        status: 'pending' as JobStatus,
        progress: 0,
        total_conversations: totalConversations,
        processed_conversations: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error creating job in database: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error in createJob:', e);
    return false;
  }
}

async function updateJob(
  jobId: string,
  updates: {
    status?: JobStatus;
    progress?: number;
    processed_conversations?: number;
    insights?: JobInsights;
    error?: string;
  }
) {
  try {
    const { error } = await supabase
      .from('job_status')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (error) {
      console.error(`Error updating job in database: ${error.message}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error in updateJob:', e);
    return false;
  }
}

async function getJob(jobId: string) {
  try {
    const { data, error } = await supabase
      .from('job_status')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return null;
    }
    return data;
  } catch (e) {
    console.error('Error in getJob:', e);
    return null;
  }
}

// Clean up old jobs (run once daily via cron instead of in-memory)
// Note: For Vercel, you'd use a separate cron function instead of this

// Status endpoint to check progress
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  // Fetch job status from the database
  const job = await getJob(jobId);

  if (!job) {
    // If job not found, try to find a completed insight with this ID in Supabase
    if (jobId.startsWith('insights-')) {
      try {
        const insightId = jobId.replace('insights-', '');
        const { data: insight, error } = await supabase
          .from('user_insights')
          .select('*')
          .eq('id', insightId)
          .single();

        if (!error && insight) {
          // If we found a matching insight, return it as a completed job
          return NextResponse.json({
            jobId,
            status: 'completed',
            progress: 100,
            insights: {
              insightId: insight.id,
              insights: insight.insights
            },
            lastUpdated: new Date(insight.updated_at || new Date())
          });
        }
      } catch (e) {
        console.error('Error checking for completed insight:', e);
      }
    }

    return NextResponse.json({
      error: 'Invalid or expired job ID. Try refreshing the page and starting again.'
    }, { status: 404 });
  }

  return NextResponse.json({
    jobId,
    status: job.status,
    progress: job.progress,
    totalConversations: job.total_conversations,
    processedConversations: job.processed_conversations,
    insights: job.status === 'completed' ? job.insights : undefined,
    error: job.error,
    lastUpdated: job.updated_at
  });
}

// Start processing job
export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const jobId = `insights-${requestId}`;
  const logPrefix = `[INSIGHT-ANALYSIS-${requestId}]`;

  try {
    // Parse request
    const body: InsightAnalysisRequest = await req.json();
    const { userId, startDate, endDate, insightTypes, analyzeAll = false } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Starting insight analysis for user ${userId}`);

    // 1. First check user privacy settings - only proceed if they've opted in
    // This is a critical privacy step aligned with trauma-informed care
    if (!analyzeAll) {
      const { data: privacySettings, error: privacyError } = await supabase
        .from('user_privacy_settings')
        .select('insights_opt_in, insights_categories')
        .eq('user_id', userId)
        .single();

      if (privacyError && privacyError.code !== 'PGRST116') {
        console.error(`${logPrefix} Error fetching privacy settings:`, privacyError);
        return NextResponse.json({
          error: 'Failed to verify privacy settings',
          details: privacyError.message
        }, { status: 500 });
      }

      // If no privacy settings or user hasn't opted in, respect privacy and exit
      if (!privacySettings || !privacySettings.insights_opt_in) {
        console.log(`${logPrefix} User has not opted in to insights analysis`);
        return NextResponse.json({
          error: 'User has not opted in to insights analysis',
          requiresOptIn: true
        }, { status: 403 });
      }

      // Filter insight types based on user preferences
      const allowedCategories = privacySettings.insights_categories || [];

      if (insightTypes?.length && allowedCategories.length) {
        // Only keep insight types the user has explicitly consented to
        const filteredTypes = insightTypes.filter(type =>
          allowedCategories.includes(type)
        );

        if (filteredTypes.length === 0) {
          return NextResponse.json({
            error: 'No consented insight categories selected',
            allowedCategories
          }, { status: 403 });
        }
      }
    }

    // 2. Fetch conversations for this user
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, created_at')
      .eq('human_id', userId)
      .order('created_at', { ascending: false });

    if (convError) {
      console.error(`${logPrefix} Error fetching conversations:`, convError);
      return NextResponse.json({
        error: 'Failed to fetch conversations',
        details: convError.message
      }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({
        error: 'No conversations found for this user'
      }, { status: 404 });
    }

    console.log(`${logPrefix} Found ${conversations.length} conversations`);

    // Create a new job in the database
    const jobCreated = await createJob(jobId, userId, conversations.length);

    if (!jobCreated) {
      return NextResponse.json({
        error: 'Failed to create job in database',
      }, { status: 500 });
    }

    // Return immediately with the job ID
    const response = NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Insights processing started',
      totalConversations: conversations.length
    });

    // Start the processing in the background
    processInsights(jobId, logPrefix, userId, conversations, { startDate, endDate });

    return response;
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start insights analysis',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Define conversation interface
interface Conversation {
  id: string;
  created_at: string;
  [key: string]: string | number | boolean | null | undefined; // For any other properties
}

// Background processing function
async function processInsights(
  jobId: string,
  logPrefix: string,
  userId: string,
  conversations: Conversation[],
  options: { startDate?: string, endDate?: string }
) {
  try {
    const { startDate, endDate } = options;

    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing'
    });

    // 3. Fetch messages from these conversations
    // Use conversation IDs to get all messages
    const conversationIds = conversations.map(conv => conv.id);

    let messagesQuery = supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    // Apply date filters if provided
    if (startDate) {
      messagesQuery = messagesQuery.gte('created_at', startDate);
    }
    if (endDate) {
      messagesQuery = messagesQuery.lte('created_at', endDate);
    }

    const { data: messages, error: msgError } = await messagesQuery as { data: Message[] | null, error: SupabaseError | null };

    if (msgError) {
      console.error(`${logPrefix} Error fetching messages:`, msgError);
      await updateJob(jobId, {
        status: 'failed',
        error: `Failed to fetch messages: ${msgError.message}`
      });
      return;
    }

    if (!messages || messages.length === 0) {
      console.log(`${logPrefix} No messages found for this user`);
      await updateJob(jobId, {
        status: 'failed',
        error: 'No messages found for this user'
      });
      return;
    }

    console.log(`${logPrefix} Found ${messages.length} messages to analyze`);


    // Define message interface
    interface Message {
      id: string;
      role: string;
      content: string;
      created_at: string;
      conversation_id: string;
    }

    // Define grouped message interface
    interface GroupedMessage {
      id: string;
      role: string;
      content: string;
      created_at: string;
    }

    // 4. Process messages by conversation
    const conversationGroups: Record<string, GroupedMessage[]> = {};

    // Group messages by conversation
    messages.forEach(msg => {
      if (!conversationGroups[msg.conversation_id]) {
        conversationGroups[msg.conversation_id] = [];
      }
      conversationGroups[msg.conversation_id].push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      });
    });

    // 5. Analyze conversations with AI
    const insights: UserInsight[] = [];

    // Track completion for processing multiple conversations
    let processedCount = 0;
    const totalConversations = Object.keys(conversationGroups).length;

    // Process each conversation
    for (const [convId, msgs] of Object.entries(conversationGroups)) {
      processedCount++;

      // Update progress
      const progress = Math.floor((processedCount / totalConversations) * 100);
      await updateJob(jobId, {
        progress,
        processed_conversations: processedCount
      });

      console.log(`${logPrefix} Processing conversation ${processedCount}/${totalConversations}: ${convId}`);

      try {
        // Format conversation for analysis
        const conversationText = msgs.map(msg =>
          `${msg.role.toUpperCase()} (${new Date(msg.created_at).toISOString()}): ${msg.content}`
        ).join('\n\n');

        // Skip empty conversations or those too short to analyze
        if (conversationText.length < 50) {
          console.log(`${logPrefix} Skipping conversation ${convId} - too short`);
          continue;
        }

        // Fetch custom prompts for this user if available
        let systemPrompt = '';
        let userPrompt = '';

        try {
          const baseUrl = process.env.API_BASE_URL ||
            (typeof window !== 'undefined' ? window.location.origin : 'https://www.r2ai.me');
          const promptsResponse = await fetch(`${baseUrl}/api/v15/prompts?categories=insights_system,insights_user`);

          if (promptsResponse.ok) {
            const promptsData = await promptsResponse.json();
            if (promptsData.success && promptsData.data) {
              systemPrompt = promptsData.data.systemPrompt;
              userPrompt = promptsData.data.userPrompt;
              console.log(`${logPrefix} Using custom prompts for user ${userId}`);
            }
          }
        } catch (promptError) {
          console.error(`${logPrefix} Error fetching custom prompts:`, promptError);
          // Continue with default prompts if there's an error
        }

        // Use defaults if we couldn't get custom prompts
        if (!systemPrompt) {
          systemPrompt = `You are analyzing a conversation between a user and an AI assistant, following a trauma-informed youth mental health approach. Extract insights that can help empower the young person, focusing only on information that would benefit them directly.

Extract only the following insight types, aligning with trauma-informed principles:
1. Strengths the AI has affirmed - Look for AI affirmations and self-efficacy statements
2. Current goals/priorities - Explicit goal statements or repeated value themes
3. Coping skills that seem helpful - Skills mentioned that helped or positive feedback on coping strategies
4. Resources explored - Any resources, hotlines, supports mentioned or requested
5. Risk indicators - Look for crisis keywords, pattern changes, or distress markers
6. Engagement signals - Ratio of user/AI words, frequency of optional disclosures

IMPORTANT PRIVACY CONSIDERATIONS:
- Do NOT attempt to diagnose
- Do NOT create psychological profiles
- Do NOT extract demographic information
- Do NOT highlight vulnerabilities without matching strengths
- Focus only on explicit content (don't "read between the lines")
- Only include insights with reasonable confidence

CRITICAL: All insights must use second-person perspective with "You" instead of "User" (e.g., "You mentioned feeling stressed" NOT "User mentioned feeling stressed" or "User is exploring").

Format your response as a JSON array with these fields for each insight:
- type: One of ["strength", "goal", "coping", "resource", "risk", "engagement"]
- content: The specific insight in neutral, validating language using direct second-person ("You") address
- source: Brief reference to where this was found (e.g., "mentioned at start of conversation")
- confidence: Your confidence in this insight (0.1-1.0)`;
        }

        if (!userPrompt) {
          userPrompt = `Here is the conversation to analyze. Focus only on the most clear and evidence-based insights that directly empower the user.\n\nREMEMBER: Always use direct second-person address in your insights (e.g., "You expressed interest in" rather than "User is interested in").`;
        }

        // Call Claude API for analysis

        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error('ANTHROPIC_API_KEY is not configured');
        }

        const { content } = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",  // Use the current Claude model
          max_tokens: 8000,
          temperature: 0.2,  // Keep temperature low for factual analysis
          system: systemPrompt,
          messages: [{
            role: "user",
            content: `${userPrompt}\n\n${conversationText}`
          }]
        });

        // Extract JSON data from Claude response
        // Handle different content block types from the Anthropic API
        let responseText = '';

        // Loop through content blocks to find text content
        for (const block of content) {
          if ('text' in block) {
            responseText = block.text;
            break;
          }
        }

        // Find and parse the JSON data
        try {
          // Try to extract JSON from the response using regex
          // Use a regex pattern that works without the 's' flag for broader compatibility
          const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);

          if (jsonMatch) {
            const extractedInsights = JSON.parse(jsonMatch[0]) as UserInsight[];

            // Add conversation ID to each insight and add to the collection
            extractedInsights.forEach(insight => {
              insights.push({
                ...insight,
                source: `${convId}:${insight.source}`
              });
            });

            console.log(`${logPrefix} Extracted ${extractedInsights.length} insights from conversation ${convId}`);
          } else {
            console.warn(`${logPrefix} No valid JSON found in Claude's response for conversation ${convId}`);
          }
        } catch (parseError) {
          console.error(`${logPrefix} Error parsing insights JSON:`, parseError);
          // Continue to process other conversations despite this error
        }
      } catch (analysisError) {
        console.error(`${logPrefix} Error analyzing conversation ${convId}:`, analysisError);
        // Continue with other conversations despite this error
      }
    }

    // 6. Group insights by type for presentation
    const groupedInsights = {
      strengths: insights.filter(i => i.type === 'strength'),
      goals: insights.filter(i => i.type === 'goal'),
      coping: insights.filter(i => i.type === 'coping'),
      resources: insights.filter(i => i.type === 'resource'),
      risks: insights.filter(i => i.type === 'risk'),
      engagement: insights.filter(i => i.type === 'engagement')
    };

    // 7. Store the results in the database
    const { data: savedInsights, error: saveError } = await supabase
      .from('user_insights')
      .insert({
        user_id: userId,
        generated_at: new Date().toISOString(),
        insights: groupedInsights,
        conversation_count: totalConversations,
        message_count: messages.length
      })
      .select('id')
      .single();

    if (saveError) {
      console.error(`${logPrefix} Error saving insights:`, saveError);
      // Still mark as completed but with a warning
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        processed_conversations: totalConversations,
        insights: {
          insights: groupedInsights,
          warning: 'Insights generated but not saved to database'
        }
      });
      return;
    }

    // 8. Update job status to completed with insights
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      processed_conversations: totalConversations,
      insights: {
        insightId: savedInsights?.id,
        insights: groupedInsights,
        stats: {
          conversations: totalConversations,
          messages: messages.length,
          insightsExtracted: insights.length
        }
      }
    });

    console.log(`${logPrefix} Insights processing completed - extracted ${insights.length} insights from ${totalConversations} conversations`);
  } catch (error) {
    console.error(`${logPrefix} Unexpected error during processing:`, error);

    // Update job status to failed
    await updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}