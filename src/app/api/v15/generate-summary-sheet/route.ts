/**
 * V15 API endpoint to generate warm handoff summary sheets following memory system pattern
 * - Tracks processed conversations in warm_handoff_conversations table
 * - Updates single growing summary per user in user_summary_sheets table
 * - Processes up to 10 unprocessed conversations per batch
 * - No client-side offset tracking needed
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { anthropic } from '@/lib/anthropic';
import { logWarmHandoffServer } from '@/utils/server-logger';
import { PostgrestError } from '@supabase/supabase-js';
import { getClaudeModel } from '@/config/models';

export const dynamic = 'force-dynamic';

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
    totalConversationsFound: number;
    filteredConversations: number;
    filteringReasons: {
      tooShort: number;
      insufficientUserMessages: number;
      insufficientUserContent: number;
    };
  };
  footer: string;
  customNotes: string;
}

interface QualityConversation {
  id: string;
  created_at: string;
  total_messages: number;
  user_messages: number;
  user_content_length: number;
}

interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}


// Helper function to fetch prompts from database following V15 pattern
async function fetchWarmHandoffPrompts(requestId: string): Promise<{
  systemPrompt: string;
  userPromptTemplate: string;
  error?: string;
}> {
  try {
    // Fetch system prompt
    const { data: systemPromptData, error: systemError } = await supabase
      .from('prompts')
      .select(`
        id, category, created_at,
        prompt_versions:prompt_versions(
          id, content, version_number, created_at
        )
      `)
      .eq('category', 'warm_handoff_system')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (systemError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'PROMPT_FETCH',
        operation: 'system-prompt-fetch-failed',
        data: { requestId, error: systemError.message }
      });
      throw new Error(`Failed to fetch system prompt: ${systemError.message}`);
    }

    // Fetch user prompt template
    const { data: userPromptData, error: userError } = await supabase
      .from('prompts')
      .select(`
        id, category, created_at,
        prompt_versions:prompt_versions(
          id, content, version_number, created_at
        )
      `)
      .eq('category', 'warm_handoff_user')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (userError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'PROMPT_FETCH',
        operation: 'user-prompt-fetch-failed',
        data: { requestId, error: userError.message }
      });
      throw new Error(`Failed to fetch user prompt: ${userError.message}`);
    }

    // Get latest versions
    const systemVersions = systemPromptData.prompt_versions || [];
    const userVersions = userPromptData.prompt_versions || [];

    if (systemVersions.length === 0) {
      throw new Error('No system prompt versions found');
    }
    if (userVersions.length === 0) {
      throw new Error('No user prompt versions found');
    }

    const latestSystemVersion = systemVersions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    const latestUserVersion = userVersions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];

    logWarmHandoffServer({
      level: 'INFO',
      category: 'PROMPT_FETCH',
      operation: 'prompts-fetched-successfully',
      data: {
        requestId,
        systemPromptVersion: latestSystemVersion.version_number,
        userPromptVersion: latestUserVersion.version_number
      }
    });

    return {
      systemPrompt: latestSystemVersion.content,
      userPromptTemplate: latestUserVersion.content
    };

  } catch (error) {
    logWarmHandoffServer({
      level: 'ERROR',
      category: 'PROMPT_FETCH',
      operation: 'prompt-fetch-critical-error',
      data: { 
        requestId, 
        error: error instanceof Error ? error.message : String(error)
      }
    });
    return {
      systemPrompt: '',
      userPromptTemplate: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Process conversations and update/create summary (like memory system profile updating)
async function processConversationsAndUpdateSummary(
  userId: string,
  conversations: QualityConversation[],
  messages: ConversationMessage[],
  existingSummary: SummaryContent | null,
  categories: string[],
  formatOptions: GenerateSummaryRequest['formatOptions'],
  requestId: string
): Promise<{
  success: boolean;
  summaryContent?: SummaryContent;
  url?: string;
  sharingToken?: string;
  error?: string;
  details?: string;
}> {
  try {
    // Fetch prompts from database (BREAKING ERROR if not found)
    const { systemPrompt, userPromptTemplate, error: promptError } = await fetchWarmHandoffPrompts(requestId);
    
    if (promptError || !systemPrompt || !userPromptTemplate) {
      const errorMessage = promptError || 'Failed to retrieve warm handoff prompts from database';
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'PROMPT_FETCH',
        operation: 'prompts-missing-critical-error',
        userId,
        data: { requestId, error: errorMessage }
      });
      throw new Error(`CRITICAL ERROR: ${errorMessage}. Warm handoff generation cannot proceed without database prompts.`);
    }

    // Group messages by conversation
    const conversationGroups: Record<string, ConversationMessage[]> = {};
    messages.forEach(msg => {
      if (!conversationGroups[msg.conversation_id]) {
        conversationGroups[msg.conversation_id] = [];
      }
      conversationGroups[msg.conversation_id].push(msg);
    });

    // Format conversations for analysis
    let conversationsText = '';
    let processedCount = 0;

    for (const [convId, msgs] of Object.entries(conversationGroups)) {
      processedCount++;
      const conversationText = msgs.map(msg =>
        `${msg.role.toUpperCase()} (${new Date(msg.created_at).toISOString()}): ${msg.content}`
      ).join('\n\n');

      conversationsText += `--- NEW CONVERSATION ${processedCount} (${convId}) ---\n${conversationText}\n\n`;
    }

    // Process system prompt template (replace variables)
    const processedSystemPrompt = systemPrompt.replace(
      /\$\{existingSummary \? '([^']+)' : '([^']+)'\}/g,
      existingSummary ? '$1' : '$2'
    );

    // Process user prompt template (replace variables)
    let processedUserPrompt = userPromptTemplate.replace(
      /\$\{existingSummary \? '([^']+)' : '([^']+)'\}/g,
      existingSummary ? '$1' : '$2'
    );

    // Replace category conditionals
    const categoryReplacements: Record<string, string> = {
      strength: '- My Identified Strengths: Highlight strengths demonstrated or mentioned during conversations, focusing on resilience, coping abilities, and positive qualities.',
      goal: '- My Current Goals/Priorities: Summarize specific goals or priorities explicitly discussed.',
      coping: '- Helpful Coping Strategies: List specific skills, techniques, or approaches found beneficial or of interest.',
      resource: '- Resources Explored: Compile specific resources, services, or support options engaged with or of interest.',
      risk: '- Safety Plan Highlights: Key elements of any safety planning that was discussed.',
      safety: '- My Notes for My Support Person: Any specific notes or questions the user wants to share.'
    };

    for (const [category, replacement] of Object.entries(categoryReplacements)) {
      const regex = new RegExp(`\\$\\{categories\\.includes\\('${category}'\\) \\? '([^']+)' : ''\\}`, 'g');
      processedUserPrompt = processedUserPrompt.replace(regex, categories.includes(category) ? replacement : '');
    }

    // Replace conversation data placeholders
    processedUserPrompt = processedUserPrompt.replace(/\$\{existingSummary\?\.content\}/g, existingSummary?.content || '');
    processedUserPrompt = processedUserPrompt.replace(/\$\{conversationsText\}/g, conversationsText);

    // Call Claude API for analysis/merging
    logWarmHandoffServer({
      level: 'INFO',
      category: 'AI_ANALYSIS',
      operation: 'claude-analysis-started',
      userId,
      data: {
        requestId,
        hasExistingSummary: !!existingSummary,
        newConversationsCount: conversations.length,
        promptLength: processedUserPrompt.length
      }
    });

    const { content } = await anthropic.messages.create({
      model: getClaudeModel(),
      max_tokens: 16000,
      temperature: 0.2,
      system: processedSystemPrompt,
      messages: [{
        role: "user",
        content: processedUserPrompt
      }]
    });

    // Extract text from Claude response
    let summaryText = '';
    for (const block of content) {
      if ('text' in block) {
        summaryText = block.text;
        break;
      }
    }

    // Create updated summary content
    const updatedSummaryContent: SummaryContent = {
      title: formatOptions?.title || 'Warm Hand-off Summary',
      generatedAt: new Date().toISOString(),
      userId: userId,
      content: summaryText,
      categories: categories,
      stats: {
        conversationCount: (existingSummary?.stats.conversationCount || 0) + conversations.length,
        messageCount: (existingSummary?.stats.messageCount || 0) + messages.length,
        totalConversationsFound: 0, // Will be updated by caller
        filteredConversations: 0,    // Will be updated by caller
        filteringReasons: {
          tooShort: 0,
          insufficientUserMessages: 0,
          insufficientUserContent: 0
        }
      },
      footer: formatOptions?.footer || 'This summary was generated based on your conversations with the AI companion.',
      customNotes: formatOptions?.customNotes || '',
    };

    // Generate sharing token
    const sharingToken = `warmhandoff-v15-${requestId}-${Date.now()}`;

    // Get or create insight ID for foreign key
    const { data: latestInsight } = await supabase
      .from('user_insights')
      .select('id')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestInsight) {
      return {
        success: false,
        error: 'No insights found for this user. Please generate insights first.',
        details: 'user_insights table entry required for foreign key'
      };
    }

    // Upsert the summary (create new or update existing)
    const { data: savedSummary, error: saveError } = await supabase
      .from('user_summary_sheets')
      .upsert({
        user_id: userId,
        insight_id: latestInsight.id,
        summary_content: updatedSummaryContent,
        generated_at: new Date().toISOString(),
        sharing_token: sharingToken,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select('id, sharing_token')
      .single();

    if (saveError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_SAVE',
        operation: 'summary-save-failed',
        userId,
        data: { requestId, error: saveError.message }
      });
      return {
        success: false,
        error: 'Failed to save summary sheet',
        details: saveError.message
      };
    }

    const summaryUrl = `/share/summary/${savedSummary.sharing_token}`;

    logWarmHandoffServer({
      level: 'INFO',
      category: 'AI_ANALYSIS',
      operation: 'claude-analysis-completed',
      userId,
      data: {
        requestId,
        summaryUrl,
        contentLength: summaryText.length
      }
    });

    return {
      success: true,
      summaryContent: updatedSummaryContent,
      url: summaryUrl,
      sharingToken: savedSummary.sharing_token
    };

  } catch (error) {
    logWarmHandoffServer({
      level: 'ERROR',
      category: 'AI_ANALYSIS',
      operation: 'claude-analysis-failed',
      userId,
      data: {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      }
    });
    return {
      success: false,
      error: 'Failed to analyze conversations and update summary',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);

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
        data: { requestId }
      });
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    logWarmHandoff('Starting warm handoff processing following memory system pattern for user', userId);
    logWarmHandoffServer({
      level: 'INFO',
      category: 'HANDOFF_START',
      operation: 'warm-handoff-processing-started',
      userId,
      data: { requestId, formatOptions }
    });

    // Check user privacy settings
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
        data: { requestId, error: privacyError.message }
      });
      return NextResponse.json({
        error: 'Failed to verify privacy settings',
        details: privacyError.message
      }, { status: 500 });
    }

    if (!privacySettings || !privacySettings.insights_opt_in) {
      logWarmHandoffServer({
        level: 'WARN',
        category: 'PRIVACY_CHECK',
        operation: 'user-not-opted-in',
        userId,
        data: { requestId }
      });
      return NextResponse.json({
        error: 'User has not opted in to insights analysis, which is required for summary sheets',
        requiresOptIn: true
      }, { status: 403 });
    }

    // Step 1: Find all quality conversations for this user
    logWarmHandoff('Finding quality conversations for user');
    const { data: allConversations, error: convError } = await supabase
      .rpc('get_quality_conversations', {
        p_user_id: userId,
        p_since_date: '1900-01-01T00:00:00Z',
        p_min_total_messages: 6,
        p_min_user_messages: 3,
        p_min_user_content_length: 200
      }) as { data: QualityConversation[] | null; error: PostgrestError | null };

    if (convError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_FETCH',
        operation: 'conversations-fetch-failed',
        userId,
        data: { requestId, error: convError.message }
      });
      return NextResponse.json({
        error: 'Failed to fetch conversations',
        details: convError.message
      }, { status: 500 });
    }

    if (!allConversations || allConversations.length === 0) {
      logWarmHandoffServer({
        level: 'WARN',
        category: 'DATA_FETCH',
        operation: 'no-conversations-found',
        userId,
        data: { requestId }
      });
      return NextResponse.json({
        error: 'No conversations found for this user'
      }, { status: 404 });
    }

    // Step 2: Find conversations already processed for warm handoff (like memory system)
    logWarmHandoff('Finding already processed conversations for warm handoff');
    const { data: processedConversations, error: processedError } = await supabase
      .from('warm_handoff_conversations')
      .select('conversation_id')
      .eq('user_id', userId);

    if (processedError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_FETCH',
        operation: 'processed-conversations-fetch-failed',
        userId,
        data: { requestId, error: processedError.message }
      });
      return NextResponse.json({
        error: 'Failed to fetch processed conversations',
        details: processedError.message
      }, { status: 500 });
    }

    const processedConversationIds = new Set(processedConversations?.map(pc => pc.conversation_id) || []);

    // Step 3: Filter to unprocessed conversations (like memory system)
    const unprocessedConversations = allConversations.filter(conv => 
      !processedConversationIds.has(conv.id)
    );

    logWarmHandoffServer({
      level: 'INFO',
      category: 'CONVERSATION_FILTERING',
      operation: 'conversations-filtered',
      userId,
      data: {
        requestId,
        totalQualityConversations: allConversations.length,
        alreadyProcessed: processedConversationIds.size,
        unprocessedFound: unprocessedConversations.length
      }
    });

    if (unprocessedConversations.length === 0) {
      logWarmHandoffServer({
        level: 'INFO',
        category: 'PROCESSING_COMPLETE',
        operation: 'no-unprocessed-conversations',
        userId,
        data: { requestId }
      });
      
      // Return existing summary if available
      const { data: existingSummary } = await supabase
        .from('user_summary_sheets')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        success: true,
        message: 'All conversations have been processed',
        summaryContent: existingSummary?.summary_content || null,
        url: existingSummary ? `/share/summary/${existingSummary.sharing_token}` : null,
        sharingToken: existingSummary?.sharing_token || null,
        stats: {
          totalConversationsFound: allConversations.length,
          alreadyProcessed: processedConversationIds.size,
          processedThisBatch: 0,
          remainingConversations: 0,
          hasMore: false
        }
      });
    }

    // Step 4: Process up to 10 unprocessed conversations
    const conversationsToProcess = unprocessedConversations.slice(0, 10);
    const remainingAfterBatch = unprocessedConversations.length - conversationsToProcess.length;

    logWarmHandoff(`Processing ${conversationsToProcess.length} conversations this batch`);

    // Fetch messages for conversations to process
    const conversationIds = conversationsToProcess.map(conv => conv.id);
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    if (msgError || !messages || messages.length === 0) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_FETCH',
        operation: 'messages-fetch-failed',
        userId,
        data: { requestId, error: msgError?.message || 'No messages found' }
      });
      return NextResponse.json({
        error: 'Failed to fetch messages for conversations',
        details: msgError?.message || 'No messages found'
      }, { status: 500 });
    }

    // Step 5: Get existing summary to merge with (like memory system profile merging)
    const { data: existingSummary } = await supabase
      .from('user_summary_sheets')
      .select('summary_content')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Step 6: Analyze new conversations and merge with existing summary
    const result = await processConversationsAndUpdateSummary(
      userId,
      conversationsToProcess,
      messages,
      existingSummary?.summary_content || null,
      formatOptions?.includeCategories || privacySettings.insights_categories || [],
      formatOptions,
      requestId
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        details: result.details
      }, { status: 500 });
    }

    // Step 7: Mark conversations as processed (like memory system)
    const { error: markError } = await supabase
      .from('warm_handoff_conversations')
      .insert(
        conversationIds.map(convId => ({
          user_id: userId,
          conversation_id: convId,
          processed_at: new Date().toISOString()
        }))
      );

    if (markError) {
      logWarmHandoffServer({
        level: 'ERROR',
        category: 'DATA_SAVE',
        operation: 'mark-conversations-processed-failed',
        userId,
        data: { requestId, error: markError.message }
      });
      // Don't fail the request - summary was created successfully
    }

    logWarmHandoffServer({
      level: 'INFO',
      category: 'PROCESSING_COMPLETE',
      operation: 'warm-handoff-batch-completed',
      userId,
      data: {
        requestId,
        totalQualityConversations: allConversations.length,
        alreadyProcessed: processedConversationIds.size,
        processedThisBatch: conversationsToProcess.length,
        remainingConversations: remainingAfterBatch,
        summaryUrl: result.url
      }
    });

    return NextResponse.json({
      success: true,
      summaryContent: result.summaryContent,
      url: result.url,
      sharingToken: result.sharingToken,
      stats: {
        totalConversationsFound: allConversations.length,
        alreadyProcessed: processedConversationIds.size + conversationsToProcess.length,
        processedThisBatch: conversationsToProcess.length,
        remainingConversations: remainingAfterBatch,
        hasMore: remainingAfterBatch > 0
      }
    });

  } catch (error) {
    logWarmHandoffServer({
      level: 'ERROR',
      category: 'API_ERROR',
      operation: 'unexpected-api-error',
      data: {
        requestId,
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