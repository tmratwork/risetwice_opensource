/**
 * API endpoint to generate printable summary sheets from conversation history
 * Used to create shareable documents for providers or support people
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { anthropic } from '@/lib/anthropic';
import { logWarmHandoffServer } from '@/utils/server-logger';

interface GenerateSummaryRequest {
  userId: string;
  formatOptions?: {
    includeCategories?: string[];
    title?: string;
    footer?: string;
    customNotes?: string;
  };
}

// Define summary content interface - used when creating summary sheets
export interface SummaryContent {
  title: string;
  generatedAt: string;
  userId: string;
  content: string;
  categories: string[];
  stats: {
    conversationCount: number;
    messageCount: number;
  };
  footer: string;
  customNotes: string;
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

// Define type for job insights to avoid using 'any'
interface JobSummaryData {
  summaryContent?: SummaryContent;
  sharingToken?: string;
  url?: string;
  warning?: string;
}

async function updateJob(
  jobId: string,
  updates: {
    status?: JobStatus;
    progress?: number;
    processed_conversations?: number;
    insights?: JobSummaryData;
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
    // If job not found, try to find a completed summary sheet based on this job ID
    if (jobId.startsWith('summary-')) {
      try {
        const sharingToken = `summarysheet-${jobId}-`;
        const { data: summary, error } = await supabase
          .from('user_summary_sheets')
          .select('*')
          .ilike('sharing_token', `${sharingToken}%`)
          .single();

        if (!error && summary) {
          // If we found a matching summary, return it as a completed job
          return NextResponse.json({
            jobId,
            status: 'completed',
            progress: 100,
            summaryContent: summary.summary_content,
            url: `/share/summary/${summary.sharing_token}`,
            sharingToken: summary.sharing_token,
            lastUpdated: new Date(summary.generated_at || new Date())
          });
        }
      } catch (e) {
        console.error('Error checking for completed summary:', e);
      }
    }

    return NextResponse.json({
      error: 'Invalid or expired job ID. Try refreshing the page and starting again.'
    }, { status: 404 });
  }

  // Job exists in database, return its details
  return NextResponse.json({
    jobId,
    status: job.status,
    progress: job.progress,
    totalConversations: job.total_conversations,
    processedConversations: job.processed_conversations,
    summaryContent: job.status === 'completed' && job.insights ? job.insights.summaryContent : undefined,
    error: job.error,
    lastUpdated: job.updated_at,
    url: job.insights?.url,
    sharingToken: job.insights?.sharingToken
  });
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const jobId = `summary-${requestId}`;
  const logPrefix = `[SUMMARY-SHEET-${requestId}]`;

  // Helper function for consistent logging
  const logWarmHandoff = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS === 'true') {
      console.log(`[warm_handoff] ${message}`, ...args);
    }
  };

  try {
    // Parse request
    const body: GenerateSummaryRequest = await req.json();
    const { userId, formatOptions } = body;

    if (!userId) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'VALIDATION',
        operation: 'missing-user-id',
        data: { jobId, requestId }
      });
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    logWarmHandoff('Starting summary sheet generation for user', userId);
    logWarmHandoffServer({
      level: 'INFO',
      category: 'HANDOFF_START',
      operation: 'summary-sheet-generation-started',
      userId,
      data: { jobId, requestId, formatOptions }
    });

    // Check user privacy settings
    logWarmHandoff('Checking user privacy settings');
    const { data: privacySettings, error: privacyError } = await supabase
      .from('user_privacy_settings')
      .select('insights_opt_in, insights_categories')
      .eq('user_id', userId)
      .single();

    if (privacyError && privacyError.code !== 'PGRST116') {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'PRIVACY_CHECK',
        operation: 'privacy-settings-fetch-failed',
        userId,
        data: { jobId, error: privacyError.message, code: privacyError.code }
      });
      return NextResponse.json({
        error: 'Failed to verify privacy settings',
        details: privacyError.message
      }, { status: 500 });
    }

    // Only require opt-in to insights since that's the data source
    if (!privacySettings || !privacySettings.insights_opt_in) {
      logWarmHandoffServer({
        level: 'WARN',
        category: 'PRIVACY_CHECK',
        operation: 'user-not-opted-in',
        userId,
        data: { jobId, hasSettings: !!privacySettings, optedIn: privacySettings?.insights_opt_in }
      });
      return NextResponse.json({
        error: 'User has not opted in to insights analysis, which is required for summary sheets',
        requiresOptIn: true
      }, { status: 403 });
    }

    logWarmHandoffServer({
      level: 'INFO',
      category: 'PRIVACY_CHECK',
      operation: 'privacy-settings-verified',
      userId,
      data: {
        jobId,
        optedIn: privacySettings.insights_opt_in,
        categories: privacySettings.insights_categories
      }
    });

    // Fetch conversations for this user
    logWarmHandoff('Fetching conversations for user');
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, created_at')
      .eq('human_id', userId)
      .order('created_at', { ascending: false });

    if (convError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_FETCH',
        operation: 'conversations-fetch-failed',
        userId,
        data: { jobId, error: convError.message }
      });
      return NextResponse.json({
        error: 'Failed to fetch conversations',
        details: convError.message
      }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      logWarmHandoffServer({
        level: 'WARN',
        category: 'DATA_FETCH',
        operation: 'no-conversations-found',
        userId,
        data: { jobId }
      });
      return NextResponse.json({
        error: 'No conversations found for this user'
      }, { status: 404 });
    }

    logWarmHandoffServer({
      level: 'INFO',
      category: 'DATA_FETCH',
      operation: 'conversations-fetched',
      userId,
      data: { jobId, conversationCount: conversations.length }
    });

    // Create a new job in the database
    logWarmHandoff('Creating job in database');
    const jobCreated = await createJob(jobId, userId, conversations.length);

    if (!jobCreated) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'JOB_MANAGEMENT',
        operation: 'job-creation-failed',
        userId,
        data: { jobId }
      });
      return NextResponse.json({
        error: 'Failed to create job in database',
      }, { status: 500 });
    }

    logWarmHandoffServer({
      level: 'INFO',
      category: 'JOB_MANAGEMENT',
      operation: 'job-created',
      userId,
      data: { jobId, totalConversations: conversations.length }
    });

    // Start the processing in the background
    processWarmHandoff(
      jobId,
      logPrefix,
      userId,
      conversations,
      privacySettings.insights_categories || [],
      formatOptions
    );

    // Return immediately with the job ID
    logWarmHandoffServer({
      level: 'INFO',
      category: 'API_RESPONSE',
      operation: 'job-started-response',
      userId,
      data: { jobId, totalConversations: conversations.length }
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Summary sheet processing started',
      totalConversations: conversations.length
    });
  } catch (error) {
    logWarmHandoffServer({
      level: 'ERROR',
      category: 'API_ERROR',
      operation: 'unexpected-api-error',
      data: { 
        jobId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    return NextResponse.json({
      error: 'Failed to generate summary sheet',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Define conversation interface
interface Conversation {
  id: string;
  created_at: string;
  [key: string]: string | number | boolean | null | undefined;
}

// Background processing function
async function processWarmHandoff(
  jobId: string,
  logPrefix: string,
  userId: string,
  conversations: Conversation[],
  allowedCategories: string[],
  formatOptions?: GenerateSummaryRequest['formatOptions']
) {
  // Helper function for consistent logging
  const logWarmHandoff = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS === 'true') {
      console.log(`[warm_handoff] ${message}`, ...args);
    }
  };

  try {
    logWarmHandoffServer({
      level: 'INFO',
      category: 'PROCESSING_START',
      operation: 'background-processing-started',
      userId,
      data: { jobId, conversationCount: conversations.length, allowedCategories }
    });

    // Update job status to processing
    await updateJob(jobId, {
      status: 'processing'
    });

    logWarmHandoff('Job status updated to processing');

    // Fetch messages from these conversations
    const conversationIds = conversations.map(conv => conv.id);
    logWarmHandoff('Fetching messages from conversations');

    const messagesQuery = supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    const { data: messages, error: msgError } = await messagesQuery;

    if (msgError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_FETCH',
        operation: 'messages-fetch-failed',
        userId,
        data: { jobId, error: msgError.message }
      });
      await updateJob(jobId, {
        status: 'failed',
        error: `Failed to fetch messages: ${msgError.message}`
      });
      return;
    }

    if (!messages || messages.length === 0) {
      logWarmHandoffServer({
        level: 'WARN',
        category: 'DATA_FETCH',
        operation: 'no-messages-found',
        userId,
        data: { jobId }
      });
      await updateJob(jobId, {
        status: 'failed',
        error: 'No messages found for this user'
      });
      return;
    }

    logWarmHandoffServer({
      level: 'INFO',
      category: 'DATA_FETCH',
      operation: 'messages-fetched',
      userId,
      data: { jobId, messageCount: messages.length }
    });

    // Define message interface
    // interface Message {
    //   id: string;
    //   role: string;
    //   content: string;
    //   created_at: string;
    //   conversation_id: string;
    // }

    // Define grouped message interface
    interface GroupedMessage {
      id: string;
      role: string;
      content: string;
      created_at: string;
    }

    // Process messages by conversation
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

    // Format all conversations for analysis
    let allConversationsText = '';
    let processedCount = 0;
    const totalConversations = Object.keys(conversationGroups).length;

    for (const [convId, msgs] of Object.entries(conversationGroups)) {
      processedCount++;

      // Update progress
      const progress = Math.floor((processedCount / totalConversations) * 50); // First half of progress
      await updateJob(jobId, {
        progress,
        processed_conversations: processedCount
      });

      console.log(`${logPrefix} Processing conversation ${processedCount}/${totalConversations}: ${convId}`);

      // Format conversation for analysis
      const conversationText = msgs.map(msg =>
        `${msg.role.toUpperCase()} (${new Date(msg.created_at).toISOString()}): ${msg.content}`
      ).join('\n\n');

      // Skip empty conversations or those too short to analyze
      if (conversationText.length < 50) {
        console.log(`${logPrefix} Skipping conversation ${convId} - too short`);
        continue;
      }

      allConversationsText += `--- CONVERSATION ${processedCount} (${convId}) ---\n${conversationText}\n\n`;
    }

    // Prepare categories to include based on user privacy settings
    const categoriesToInclude = formatOptions?.includeCategories || allowedCategories;

    // Fetch custom warm handoff prompt if available
    const { fetchUserWarmHandoffPrompt } = await import('@/lib/prompts');
    const customWarmHandoffPrompt = await fetchUserWarmHandoffPrompt(userId);

    // Use custom prompt if available, otherwise use default
    const systemPrompt = customWarmHandoffPrompt || `You are creating a trauma-informed warm hand-off summary sheet based on conversation history. Your task is to extract relevant information that would be helpful for a human service provider, while maintaining the user's privacy and dignity.

Follow these guidelines:
1. Maintain a non-clinical, warm, and supportive tone throughout
2. Focus on strengths and user-identified priorities
3. Use the user's own words where appropriate
4. Only include information in the categories the user has explicitly consented to share
5. Keep each section concise, relevant, and helpful for continuity of care
6. Present information in a way that empowers the user and preserves their agency
7. Do not include direct quotes that could identify the user
8. Do not attempt to diagnose or label the user
9. Only include information with high confidence that was explicitly discussed`;

    // Log which prompt we're using
    console.log(`${logPrefix} ${customWarmHandoffPrompt ? 'Using custom warm handoff prompt' : 'Using default warm handoff prompt'}`);

    // Create user prompt with categories to include
    const userPrompt = `Please create a warm hand-off summary sheet with ONLY the following sections that the user has consented to include:

${categoriesToInclude.includes('strength') ? '- My Identified Strengths: Highlight strengths demonstrated or mentioned during conversations, focusing on resilience, coping abilities, and positive qualities.' : ''}
${categoriesToInclude.includes('goal') ? '- My Current Goals/Priorities: Summarize specific goals or priorities explicitly discussed.' : ''}
${categoriesToInclude.includes('coping') ? '- Helpful Coping Strategies: List specific skills, techniques, or approaches found beneficial or of interest.' : ''}
${categoriesToInclude.includes('resource') ? '- Resources Explored: Compile specific resources, services, or support options engaged with or of interest.' : ''}
${categoriesToInclude.includes('risk') ? '- Safety Plan Highlights: Key elements of any safety planning that was discussed.' : ''}
${categoriesToInclude.includes('safety') ? '- My Notes for My Support Person: Any specific notes or questions the user wants to share.' : ''}

Format each section with a clear heading and bullet points for readability. Keep the language warm and non-clinical. Ensure the summary reflects the user's perspective and priorities.

The user has ONLY consented to share information in the sections listed above. DO NOT include any other sections.

Here are the conversation transcripts to analyze:

${allConversationsText}`;

    // Update progress
    await updateJob(jobId, {
      progress: 50 // Half way point
    });

    // Call Claude API for analysis
    logWarmHandoffServer({
      level: 'INFO',
      category: 'AI_ANALYSIS',
      operation: 'claude-analysis-started',
      userId,
      data: { 
        jobId, 
        promptLength: userPrompt.length, 
        systemPromptLength: systemPrompt.length,
        categoriesToInclude
      }
    });

    try {
      const { content } = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000, // increased max tokens because user profile gets too big. LT solution is better manage user profile length
        temperature: 0.2,  // Keep temperature low for factual analysis
        system: systemPrompt,
        messages: [{
          role: "user",
          content: userPrompt
        }]
      });

      logWarmHandoffServer({
        level: 'INFO',
        category: 'AI_ANALYSIS',
        operation: 'claude-analysis-completed',
        userId,
        data: { jobId, contentBlocks: content.length }
      });

      // Extract text from Claude response
      let summaryText = '';

      // Loop through content blocks to find text content
      for (const block of content) {
        if ('text' in block) {
          summaryText = block.text;
          break;
        }
      }

      // Update progress
      await updateJob(jobId, {
        progress: 75 // Progress after AI response
      });

      // Process the summary into a structured format
      // For now, we'll keep the content as raw text and structure it in the frontend
      const summaryContent = {
        title: formatOptions?.title || 'Warm Hand-off Summary',
        generatedAt: new Date().toISOString(),
        userId: userId,
        content: summaryText,
        categories: categoriesToInclude,
        stats: {
          conversationCount: totalConversations,
          messageCount: messages.length,
        },
        footer: formatOptions?.footer || 'This summary was generated based on your conversations with the AI companion.',
        customNotes: formatOptions?.customNotes || '',
      };

      // Generate a unique token for sharing
      const sharingToken = `summarysheet-${jobId}-${Date.now()}`;

      // Fetch the user's latest insight ID (required for the foreign key)
      const { data: latestInsight, error: insightError } = await supabase
        .from('user_insights')
        .select('id')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      if (insightError) {
        console.error(`${logPrefix} Error fetching latest insight:`, insightError);
        await updateJob(jobId, {
          status: 'failed',
          error: `Failed to find user insights: ${insightError.message || JSON.stringify(insightError)}`
        });
        return;
      }

      if (!latestInsight || !latestInsight.id) {
        console.error(`${logPrefix} No insights found for user`);
        await updateJob(jobId, {
          status: 'failed',
          error: 'No insights found for this user. Please generate insights first.'
        });
        return;
      }

      // Store the summary for later retrieval
      // Log the data we're about to insert for debugging
      console.log(`${logPrefix} Saving summary sheet with:`, {
        user_id: userId,
        insight_id: latestInsight.id,
        token: sharingToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });

      const { data: savedSummary, error: saveError } = await supabase
        .from('user_summary_sheets')
        .insert({
          user_id: userId,
          insight_id: latestInsight.id,
          summary_content: summaryContent,
          generated_at: new Date().toISOString(),
          sharing_token: sharingToken,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Expires in 30 days
        })
        .select('id, sharing_token')
        .single();

      if (saveError) {
        // Log detailed error information
        console.error(`${logPrefix} Error saving summary sheet:`, saveError);
        console.error(`${logPrefix} Error code:`, saveError.code);
        console.error(`${logPrefix} Error details:`, saveError.details);
        console.error(`${logPrefix} Error hint:`, saveError.hint);

        await updateJob(jobId, {
          status: 'failed',
          error: `Failed to save summary sheet: ${saveError.message || saveError.details || JSON.stringify(saveError)}`
        });
        return;
      }

      // Generate URL for the summary sheet
      const summaryUrl = `/share/summary/${savedSummary.sharing_token}`;

      // Update job status to completed with summary
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        processed_conversations: totalConversations,
        insights: {
          summaryContent: summaryContent,
          sharingToken: savedSummary.sharing_token,
          url: summaryUrl
        }
      });

      logWarmHandoffServer({
        level: 'INFO',
        category: 'PROCESSING_COMPLETE',
        operation: 'summary-sheet-completed',
        userId,
        data: { 
          jobId, 
          totalConversations,
          messageCount: messages.length,
          summaryUrl,
          sharingToken: savedSummary.sharing_token,
          contentLength: summaryContent.content.length
        }
      });

      logWarmHandoff('Summary sheet processing completed - created summary from conversations', {
        conversations: totalConversations,
        messages: messages.length,
        url: summaryUrl
      });
    } catch (analysisError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'AI_ANALYSIS',
        operation: 'claude-analysis-failed',
        userId,
        data: { 
          jobId, 
          error: analysisError instanceof Error ? analysisError.message : String(analysisError),
          stack: analysisError instanceof Error ? analysisError.stack : undefined
        }
      });
      await updateJob(jobId, {
        status: 'failed',
        error: `Error analyzing conversations: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`
      });
    }
  } catch (error) {
    logWarmHandoffServer({
      level: 'ERROR',
      category: 'PROCESSING_ERROR',
      operation: 'unexpected-error',
      userId,
      data: { 
        jobId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    // Update job status to failed
    await updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}