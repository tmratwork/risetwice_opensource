/**
 * V15 API endpoint to generate user insights following warm handoff pattern
 * - Tracks processed conversations in user_insights_conversations table
 * - Updates single growing insights record per user in user_insights table
 * - Processes up to 10 unprocessed conversations per batch
 * - Fetches prompts from admin database
 * - Filters out conversations that are too short
 * 
 * IMPORTANT: Firebase user IDs are TEXT strings (e.g., "NbewAuSvZNgrb64yNDkUebjMHa23"), not UUIDs!
 * Always use TEXT type for user_id columns in database tables when working with Firebase auth.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { anthropic } from '@/lib/anthropic';
import { PostgrestError } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface GenerateInsightsRequest {
  userId: string;
  insightTypes?: string[];
}

interface UserInsight {
  type: 'strength' | 'goal' | 'coping' | 'resource' | 'risk' | 'engagement';
  content: string;
  source: string;
  timestamp?: string;
  confidence: number;
}

interface GroupedInsights {
  strengths: UserInsight[];
  goals: UserInsight[];
  coping: UserInsight[];
  resources: UserInsight[];
  risks: UserInsight[];
  engagement: UserInsight[];
}

interface UserInsightData {
  id: string;
  user_id: string;
  generated_at: string;
  insights: GroupedInsights;
  conversation_count: number;
  message_count: number;
  approved: boolean;
  approved_at?: string;
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
async function fetchUserInsightPrompts(): Promise<{
  systemPrompt: string;
  userPromptTemplate: string;
  error?: string;
}> {
  try {
    // Fetch system prompt
    const { data: systemPromptsArray, error: systemError } = await supabase
      .from('prompts')
      .select(`
        id, category, created_at,
        prompt_versions:prompt_versions(
          id, content, version_number, created_at
        )
      `)
      .eq('category', 'insights_system')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (systemError || !systemPromptsArray || systemPromptsArray.length === 0) {
      console.error(`[user_insights] Failed to fetch system prompt: ${systemError?.message || 'No system prompt found'}`);
      throw new Error(`Failed to fetch system prompt: ${systemError?.message || 'No system prompt found'}`);
    }

    const systemPromptData = systemPromptsArray[0];

    // Fetch user prompt template
    const { data: userPromptsArray, error: userError } = await supabase
      .from('prompts')
      .select(`
        id, category, created_at,
        prompt_versions:prompt_versions(
          id, content, version_number, created_at
        )
      `)
      .eq('category', 'insights_user')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (userError || !userPromptsArray || userPromptsArray.length === 0) {
      console.error(`[user_insights] Failed to fetch user prompt: ${userError?.message || 'No user prompt found'}`);
      throw new Error(`Failed to fetch user prompt: ${userError?.message || 'No user prompt found'}`);
    }

    const userPromptData = userPromptsArray[0];

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

    console.log(`[user_insights] Fetched prompts successfully - system v${latestSystemVersion.version_number}, user v${latestUserVersion.version_number}`);

    return {
      systemPrompt: latestSystemVersion.content,
      userPromptTemplate: latestUserVersion.content
    };

  } catch (error) {
    console.error(`[user_insights] Critical error fetching prompts:`, error);
    return {
      systemPrompt: '',
      userPromptTemplate: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Process conversations and update/create insights (like memory system profile updating)
async function processConversationsAndUpdateInsights(
  userId: string,
  conversations: QualityConversation[],
  messages: ConversationMessage[],
  existingInsights: UserInsightData | null,
  insightTypes: string[]
): Promise<{
  success: boolean;
  insights?: UserInsightData;
  error?: string;
  details?: string;
}> {
  try {
    // Fetch prompts from database (BREAKING ERROR if not found)
    const { systemPrompt, userPromptTemplate, error: promptError } = await fetchUserInsightPrompts();
    
    if (promptError || !systemPrompt || !userPromptTemplate) {
      const errorMessage = promptError || 'Failed to retrieve user insights prompts from database';
      console.error(`[user_insights] CRITICAL ERROR: ${errorMessage}`);
      throw new Error(`CRITICAL ERROR: ${errorMessage}. User insights generation cannot proceed without database prompts.`);
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
      /\$\{existingInsights \? '([^']+)' : '([^']+)'\}/g,
      existingInsights ? '$1' : '$2'
    );

    // Process user prompt template (replace variables)
    let processedUserPrompt = userPromptTemplate.replace(
      /\$\{existingInsights \? '([^']+)' : '([^']+)'\}/g,
      existingInsights ? '$1' : '$2'
    );

    // Replace insight type conditionals
    const typeReplacements: Record<string, string> = {
      strength: 'Strengths: Personal qualities, resilience, courage, and skills demonstrated',
      goal: 'Goals: Specific objectives, aspirations, and priorities mentioned',
      coping: 'Coping: Strategies, techniques, and approaches that help manage stress',
      resource: 'Resources: Support systems, services, and helpful tools discovered',
      risk: 'Risk factors: Signs of distress, challenges, or concerning patterns',
      engagement: 'Communication patterns: How the user engages in conversations'
    };

    for (const [type, description] of Object.entries(typeReplacements)) {
      const regex = new RegExp(`\\$\\{insightTypes\\.includes\\('${type}'\\) \\? '([^']+)' : ''\\}`, 'g');
      processedUserPrompt = processedUserPrompt.replace(regex, insightTypes.includes(type) ? description : '');
    }

    // Replace conversation data placeholders
    const existingInsightsText = existingInsights ? JSON.stringify(existingInsights.insights, null, 2) : '';
    processedUserPrompt = processedUserPrompt.replace(/\$\{existingInsights\?\.insights\}/g, existingInsightsText);
    processedUserPrompt = processedUserPrompt.replace(/\$\{conversationsText\}/g, conversationsText);
    
    // Always append conversation data to ensure Claude has the data to analyze
    processedUserPrompt = processedUserPrompt + '\n\nConversations to analyze:\n' + conversationsText;
    
    // Add request for JSON format to ensure proper response format
    processedUserPrompt = processedUserPrompt + '\n\nPlease analyze these conversations and respond with a JSON array of insights using the format specified in the system prompt.';

    // Call Claude API for analysis/merging
    console.log(`[user_insights] Starting Claude analysis for ${conversations.length} conversations`);

    const { content } = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      temperature: 0.2,
      system: processedSystemPrompt,
      messages: [{
        role: "user",
        content: processedUserPrompt
      }]
    });

    // Extract text from Claude response
    let insightsText = '';
    for (const block of content) {
      if ('text' in block) {
        insightsText = block.text;
        break;
      }
    }

    // Parse the insights JSON response
    let parsedInsights: GroupedInsights;
    try {
      // Clean markdown formatting that Claude AI commonly adds
      const cleanedInsightsText = insightsText
        .replace(/```json\s*/g, '')  // Remove opening ```json
        .replace(/```\s*$/g, '')     // Remove closing ```
        .trim();

      const insightsArray = JSON.parse(cleanedInsightsText);
      
      // Convert array format to grouped format
      parsedInsights = {
        strengths: insightsArray.filter((insight: UserInsight) => insight.type === 'strength'),
        goals: insightsArray.filter((insight: UserInsight) => insight.type === 'goal'),
        coping: insightsArray.filter((insight: UserInsight) => insight.type === 'coping'),
        resources: insightsArray.filter((insight: UserInsight) => insight.type === 'resource'),
        risks: insightsArray.filter((insight: UserInsight) => insight.type === 'risk'),
        engagement: insightsArray.filter((insight: UserInsight) => insight.type === 'engagement')
      };
      
      console.log(`[user_insights] Parsed ${insightsArray.length} insights into grouped format`);
    } catch (parseError) {
      console.error('[user_insights] Failed to parse Claude response as JSON:', parseError);
      console.error('[user_insights] Claude response text:', insightsText.substring(0, 200) + '...');
      throw new Error('Failed to parse insights from AI response');
    }

    // Create updated insights data
    const updatedInsights: UserInsightData = {
      id: existingInsights?.id || crypto.randomUUID(),
      user_id: userId,
      generated_at: new Date().toISOString(),
      insights: parsedInsights,
      conversation_count: (existingInsights?.conversation_count || 0) + conversations.length,
      message_count: (existingInsights?.message_count || 0) + messages.length,
      approved: false,
      approved_at: undefined
    };

    // Upsert the insights (create new or update existing)
    const { data: savedInsights, error: saveError } = await supabase
      .from('user_insights')
      .upsert({
        id: updatedInsights.id,
        user_id: userId,
        generated_at: updatedInsights.generated_at,
        insights: updatedInsights.insights,
        conversation_count: updatedInsights.conversation_count,
        message_count: updatedInsights.message_count,
        approved: updatedInsights.approved
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (saveError) {
      console.error(`[user_insights] Failed to save insights: ${saveError.message}`);
      return {
        success: false,
        error: 'Failed to save insights',
        details: saveError.message
      };
    }

    console.log(`[user_insights] Successfully updated insights for user ${userId}`);

    return {
      success: true,
      insights: savedInsights as UserInsightData
    };

  } catch (error) {
    console.error('[user_insights] Error processing conversations:', error);
    return {
      success: false,
      error: 'Failed to analyze conversations and update insights',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function POST(req: Request) {

  try {
    // Parse request
    const body: GenerateInsightsRequest = await req.json();
    const { userId, insightTypes } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`[user_insights] Starting insights processing for user ${userId}`);

    // Check user privacy settings
    const { data: privacySettings, error: privacyError } = await supabase
      .from('user_privacy_settings')
      .select('insights_opt_in, insights_categories')
      .eq('user_id', userId)
      .single();

    if (privacyError && privacyError.code !== 'PGRST116') {
      console.error(`[user_insights] Privacy settings fetch failed: ${privacyError.message}`);
      return NextResponse.json({
        error: 'Failed to verify privacy settings',
        details: privacyError.message
      }, { status: 500 });
    }

    if (!privacySettings || !privacySettings.insights_opt_in) {
      console.warn(`[user_insights] User ${userId} has not opted in to insights`);
      return NextResponse.json({
        error: 'User has not opted in to insights analysis',
        requiresOptIn: true
      }, { status: 403 });
    }

    // Step 1: Find all quality conversations for this user
    console.log(`[user_insights] Finding quality conversations for user ${userId}`);
    const { data: allConversations, error: convError } = await supabase
      .rpc('get_quality_conversations', {
        p_user_id: userId,
        p_since_date: '1900-01-01T00:00:00Z',
        p_min_total_messages: 6,
        p_min_user_messages: 3,
        p_min_user_content_length: 200
      }) as { data: QualityConversation[] | null; error: PostgrestError | null };

    if (convError) {
      console.error(`[user_insights] Failed to fetch conversations: ${convError.message}`);
      return NextResponse.json({
        error: 'Failed to fetch conversations',
        details: convError.message
      }, { status: 500 });
    }

    if (!allConversations || allConversations.length === 0) {
      console.warn(`[user_insights] No quality conversations found for user ${userId}`);
      return NextResponse.json({
        error: 'No conversations found for this user'
      }, { status: 404 });
    }

    // Step 2: Find conversations already processed for insights
    console.log(`[user_insights] Finding already processed conversations`);
    const { data: processedConversations, error: processedError } = await supabase
      .from('user_insights_conversations')
      .select('conversation_id')
      .eq('user_id', userId); // IMPORTANT: userId is Firebase TEXT string, not UUID!

    if (processedError) {
      console.error(`[user_insights] Failed to fetch processed conversations: ${processedError.message}`);
      return NextResponse.json({
        error: 'Failed to fetch processed conversations',
        details: processedError.message
      }, { status: 500 });
    }

    const processedConversationIds = new Set(processedConversations?.map(pc => pc.conversation_id) || []);

    // Step 3: Filter to unprocessed conversations
    const unprocessedConversations = allConversations.filter(conv => 
      !processedConversationIds.has(conv.id)
    );

    console.log(`[user_insights] Found ${allConversations.length} quality conversations, ${processedConversationIds.size} already processed, ${unprocessedConversations.length} remaining`);

    if (unprocessedConversations.length === 0) {
      console.log(`[user_insights] All conversations already processed for user ${userId}`);
      
      // Return existing insights if available
      const { data: existingInsights } = await supabase
        .from('user_insights')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        success: true,
        message: 'All conversations have been processed',
        insights: existingInsights,
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

    console.log(`[user_insights] Processing ${conversationsToProcess.length} conversations this batch`);

    // Fetch messages for conversations to process
    const conversationIds = conversationsToProcess.map(conv => conv.id);
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true });

    if (msgError || !messages || messages.length === 0) {
      console.error(`[user_insights] Failed to fetch messages: ${msgError?.message || 'No messages found'}`);
      return NextResponse.json({
        error: 'Failed to fetch messages for conversations',
        details: msgError?.message || 'No messages found'
      }, { status: 500 });
    }

    // Step 5: Get existing insights to merge with
    const { data: existingInsights } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    // Step 6: Analyze new conversations and merge with existing insights
    const result = await processConversationsAndUpdateInsights(
      userId,
      conversationsToProcess,
      messages,
      existingInsights,
      insightTypes || privacySettings.insights_categories || []
    );

    if (!result.success) {
      return NextResponse.json({
        error: result.error,
        details: result.details
      }, { status: 500 });
    }

    // Step 7: Mark conversations as processed
    const { error: markError } = await supabase
      .from('user_insights_conversations')
      .insert(
        conversationIds.map(convId => ({
          user_id: userId, // Firebase TEXT string (not UUID!)
          conversation_id: convId, // UUID string will be converted to UUID
          processed_at: new Date().toISOString()
        }))
      );

    if (markError) {
      console.error(`[user_insights] Failed to mark conversations as processed: ${markError.message}`);
      // Don't fail the request - insights were created successfully
    }

    console.log(`[user_insights] Successfully processed batch for user ${userId}`);

    return NextResponse.json({
      success: true,
      insights: result.insights,
      stats: {
        totalConversationsFound: allConversations.length,
        alreadyProcessed: processedConversationIds.size + conversationsToProcess.length,
        processedThisBatch: conversationsToProcess.length,
        remainingConversations: remainingAfterBatch,
        hasMore: remainingAfterBatch > 0
      }
    });

  } catch (error) {
    console.error('[user_insights] Unexpected API error:', error);
    return NextResponse.json({
      error: 'Failed to generate user insights',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}