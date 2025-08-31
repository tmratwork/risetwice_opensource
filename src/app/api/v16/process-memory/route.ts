import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getGPT4Model } from '@/config/models';
import { logV16MemoryServer } from '@/utils/server-logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function for console logging
const logV16Memory = (message: string, ...args: unknown[]) => {
  if (process.env.NEXT_PUBLIC_ENABLE_V16_MEMORY_LOGS === 'true') {
    console.log(`[v16_memory] ${message}`, ...args);
  }
};

async function getPrompt(category: string): Promise<string> {
  logV16Memory(`Fetching prompt for category: ${category}`);
  
  // Get the most recent prompt with actual content (like V15 API does internally)
  const { data: promptData, error: promptError } = await supabase
    .from('prompts')
    .select(`
      id,
      name,
      created_at,
      prompt_versions!inner (
        content,
        created_at
      )
    `)
    .eq('category', category)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (promptError || !promptData) {
    logV16MemoryServer({
      level: 'ERROR',
      category: 'PROMPT_FETCH',
      operation: 'get-prompt-failed',
      data: { category, error: promptError?.message || 'No prompt data found' }
    });
    throw new Error(`Could not find active prompt for category: ${category}`);
  }

  // Get the latest version content
  const versions = promptData.prompt_versions as Array<{
    content: string;
    created_at: string;
  }>;

  if (!versions || versions.length === 0) {
    logV16MemoryServer({
      level: 'ERROR',
      category: 'PROMPT_FETCH',
      operation: 'get-prompt-no-versions',
      data: { category, promptId: promptData.id }
    });
    throw new Error(`No versions found for prompt in category: ${category}`);
  }

  // Get the most recent version
  const latestVersion = versions.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  logV16Memory(`Successfully fetched prompt for ${category}:`, {
    promptId: promptData.id,
    created_at: promptData.created_at,
    actualContentLength: latestVersion.content.length,
    titleLength: promptData.name.length
  });

  logV16MemoryServer({
    level: 'INFO',
    category: 'PROMPT_FETCH',
    operation: 'prompt-retrieved',
    data: { 
      category, 
      promptId: promptData.id,
      created_at: promptData.created_at,
      actualContentLength: latestVersion.content.length,
      titleLength: promptData.name.length,
      contentPreview: latestVersion.content.substring(0, 200) + '...'
    }
  });

  return latestVersion.content;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, offset = 0 } = await request.json();

    if (!userId) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'VALIDATION',
        operation: 'missing-user-id',
        data: { offset }
      });
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    logV16Memory(`Starting memory processing for user: ${userId}, offset: ${offset}`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'PROCESSING_START',
      operation: 'v16-memory-processing-initiated',
      userId,
      data: { offset, source: 'api-request' }
    });

    // First, get all conversations to understand total scope
    const { data: allConversations, error: allConversationsError } = await supabase
      .from('conversations')
      .select('id, created_at')
      .eq('human_id', userId)
      .order('created_at', { ascending: false });

    if (allConversationsError) {
      console.error('[v16_memory] Error fetching all conversations:', allConversationsError);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const totalConversations = allConversations?.length || 0;
    console.log(`[v16_memory] Total conversations found: ${totalConversations}`);

    // Get already processed conversation IDs from v16_memory table
    // Each memory entry stores which conversations were processed
    const { data: processedMemories } = await supabase
      .from('v16_memory')
      .select('conversation_ids')
      .eq('user_id', userId);

    const processedConversationIds = new Set();
    if (processedMemories) {
      processedMemories.forEach(memory => {
        if (memory.conversation_ids && Array.isArray(memory.conversation_ids)) {
          memory.conversation_ids.forEach(id => processedConversationIds.add(id));
        }
      });
    }

    console.log(`[v16_memory] Already processed conversations: ${processedConversationIds.size}`);

    // Filter out already processed conversations
    const unprocessedConversationIds = allConversations
      .filter(conv => !processedConversationIds.has(conv.id))
      .map(conv => conv.id);

    console.log(`[v16_memory] Unprocessed conversations found: ${unprocessedConversationIds.length}`);

    // Get the next batch of 10 conversations to process
    const batchSize = 10;
    const conversationIdsToProcess = unprocessedConversationIds.slice(offset, offset + batchSize);
    
    if (conversationIdsToProcess.length === 0) {
      console.log('[v16_memory] No conversations to process');
      return NextResponse.json({
        success: true,
        stats: {
          totalConversations,
          alreadyProcessed: processedConversationIds.size,
          unprocessedFound: unprocessedConversationIds.length,
          conversationsProcessed: 0,
          hasMore: false,
          remainingConversations: 0
        },
        message: 'No conversations to process'
      });
    }

    console.log(`[v16_memory] Processing batch: ${conversationIdsToProcess.length} conversations`);

    // Get full conversation data with messages for the batch
    const { data: conversations, error: conversationsError } = await supabase
      .from('conversations')
      .select(`
        id,
        created_at,
        messages (
          id,
          content,
          role,
          created_at
        )
      `)
      .in('id', conversationIdsToProcess)
      .order('created_at', { ascending: false });

    if (conversationsError) {
      console.error('[v16_memory] Error fetching conversation details:', conversationsError);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    if (!conversations || conversations.length === 0) {
      console.log('[v16_memory] No conversations found in batch');
      return NextResponse.json({
        success: true,
        stats: {
          totalConversations,
          alreadyProcessed: processedConversationIds.size,
          unprocessedFound: unprocessedConversationIds.length,
          conversationsProcessed: 0,
          hasMore: unprocessedConversationIds.length > offset + batchSize,
          remainingConversations: Math.max(0, unprocessedConversationIds.length - offset - batchSize)
        },
        message: 'No conversations in this batch'
      });
    }

    // Filter conversations with sufficient content (like V15 does)
    const qualityConversations = conversations.filter(conv => {
      const messages = (conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || [];
      const userMessages = messages.filter(msg => msg.role === 'user');
      const userContent = userMessages.map(msg => msg.content || '').join(' ');
      
      // Quality thresholds: at least 6 messages total, 3 user messages, 200 user characters
      const hasEnoughMessages = messages.length >= 6;
      const hasEnoughUserMessages = userMessages.length >= 3;
      const hasEnoughContent = userContent.length >= 200;
      
      return hasEnoughMessages && hasEnoughUserMessages && hasEnoughContent;
    });

    const skippedConversations = conversations.length - qualityConversations.length;
    console.log(`[v16_memory] Quality conversations: ${qualityConversations.length}, skipped: ${skippedConversations}`);

    if (qualityConversations.length === 0) {
      console.log('[v16_memory] No quality conversations to process in this batch');
      return NextResponse.json({
        success: true,
        stats: {
          totalConversations,
          alreadyProcessed: processedConversationIds.size,
          unprocessedFound: unprocessedConversationIds.length,
          conversationsProcessed: 0,
          skippedTooShort: skippedConversations,
          hasMore: unprocessedConversationIds.length > offset + batchSize,
          remainingConversations: Math.max(0, unprocessedConversationIds.length - offset - batchSize)
        },
        message: 'No quality conversations to process in this batch'
      });
    }

    // Get V16 memory extraction prompts
    logV16Memory('Fetching V16 extraction prompts...');
    logV16MemoryServer({
      level: 'INFO',
      category: 'PROMPT_FETCH',
      operation: 'fetching-extraction-prompts',
      userId,
      data: { totalQualityConversations: qualityConversations.length }
    });

    const extractionSystemPrompt = await getPrompt('v16_what_ai_remembers_extraction_system');
    const extractionUserPrompt = await getPrompt('v16_what_ai_remembers_extraction_user');

    logV16Memory('Successfully fetched both extraction prompts', {
      systemPromptLength: extractionSystemPrompt.length,
      userPromptLength: extractionUserPrompt.length
    });

    logV16MemoryServer({
      level: 'INFO',
      category: 'PROMPT_FETCH',
      operation: 'extraction-prompts-retrieved',
      userId,
      data: { 
        systemPromptLength: extractionSystemPrompt.length,
        userPromptLength: extractionUserPrompt.length
      }
    });

    // Process conversations to extract memory data
    const conversationTexts = qualityConversations.map(conv => {
      const messages = (conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || [];
      return messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    }).join('\n\n---\n\n');

    logV16Memory(`Processing ${qualityConversations.length} quality conversations for memory extraction`);

    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_PROCESSING',
      operation: 'starting-openai-extraction',
      userId,
      data: { 
        qualityConversations: qualityConversations.length,
        totalConversationTextLength: conversationTexts.length,
        model: getGPT4Model(),
        temperature: 0.3
      }
    });

    // Call OpenAI to extract memory data
    const extractionResponse = await openai.chat.completions.create({
      model: getGPT4Model(),
      messages: [
        { role: 'system', content: extractionSystemPrompt },
        { role: 'user', content: `${extractionUserPrompt}\n\nConversations:\n${conversationTexts}` }
      ],
      temperature: 0.3,
    });

    const extractedMemoryText = extractionResponse.choices[0]?.message?.content;
    
    logV16Memory(`OpenAI extraction completed`, {
      hasResponse: !!extractedMemoryText,
      responseLength: extractedMemoryText?.length || 0,
      usage: extractionResponse.usage
    });

    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_PROCESSING',
      operation: 'openai-extraction-completed',
      userId,
      data: { 
        hasResponse: !!extractedMemoryText,
        responseLength: extractedMemoryText?.length || 0,
        usage: extractionResponse.usage,
        responsePreview: extractedMemoryText?.substring(0, 500) + '...'
      }
    });

    if (!extractedMemoryText) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'AI_PROCESSING',
        operation: 'openai-extraction-no-response',
        userId,
        data: { extractionResponse }
      });
      throw new Error('Failed to extract memory data from conversations');
    }

    // CRITICAL: Log the raw AI response before parsing
    logV16Memory('Raw AI response received (first 1000 chars):', extractedMemoryText.substring(0, 1000));
    
    logV16MemoryServer({
      level: 'INFO',
      category: 'AI_RESPONSE_ANALYSIS',
      operation: 'raw-ai-response-received',
      userId,
      data: { 
        fullResponseLength: extractedMemoryText.length,
        startsWithBrace: extractedMemoryText.trim().startsWith('{'),
        endsWithBrace: extractedMemoryText.trim().endsWith('}'),
        containsJSON: extractedMemoryText.includes('{'),
        containsCodeBlock: extractedMemoryText.includes('```'),
        fullResponse: extractedMemoryText // Store full response for analysis
      }
    });

    // Parse the extracted memory (assuming it's JSON)
    let memoryContent: Record<string, unknown>;
    try {
      logV16Memory('Attempting to parse AI response as JSON...');
      
      // Check if response is wrapped in markdown code blocks
      let cleanedResponse = extractedMemoryText.trim();
      if (cleanedResponse.includes('```json')) {
        logV16Memory('Detected markdown JSON code block, cleaning...');
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/g, '')
          .replace(/```\s*$/g, '')
          .trim();
        
        logV16MemoryServer({
          level: 'INFO',
          category: 'AI_RESPONSE_ANALYSIS',
          operation: 'markdown-code-block-cleaned',
          userId,
          data: { 
            originalLength: extractedMemoryText.length,
            cleanedLength: cleanedResponse.length,
            cleanedResponse: cleanedResponse
          }
        });
      }
      
      memoryContent = JSON.parse(cleanedResponse);
      
      logV16Memory('✅ Successfully parsed AI response as JSON', {
        parsedKeys: Object.keys(memoryContent),
        keyCount: Object.keys(memoryContent).length
      });

      logV16MemoryServer({
        level: 'INFO',
        category: 'AI_RESPONSE_ANALYSIS',
        operation: 'json-parsing-successful',
        userId,
        data: { 
          parsedKeys: Object.keys(memoryContent),
          keyCount: Object.keys(memoryContent).length,
          parsedStructure: memoryContent
        }
      });
      
    } catch (parseError) {
      logV16Memory('❌ Failed to parse AI response as JSON, using fallback', {
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
        responseStart: extractedMemoryText.substring(0, 200)
      });

      logV16MemoryServer({
        level: 'ERROR',
        category: 'AI_RESPONSE_ANALYSIS',
        operation: 'json-parsing-failed-fallback-used',
        userId,
        data: { 
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          responseLength: extractedMemoryText.length,
          responseStart: extractedMemoryText.substring(0, 500),
          fullFailedResponse: extractedMemoryText
        }
      });

      // If not valid JSON, store as text
      memoryContent = { raw_memory: extractedMemoryText };
    }

    // Get existing memory data to merge with
    const { data: existingMemory } = await supabase
      .from('v16_memory')
      .select('*')
      .eq('user_id', userId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    let finalMemoryContent = memoryContent;

    // If we have existing memory, merge it
    if (existingMemory) {
      logV16Memory('Found existing memory, will merge with new data', {
        existingMemoryId: existingMemory.id,
        existingConversationCount: existingMemory.conversation_count,
        existingMessageCount: existingMemory.message_count
      });

      logV16MemoryServer({
        level: 'INFO',
        category: 'MEMORY_MERGE',
        operation: 'existing-memory-found-starting-merge',
        userId,
        data: { 
          existingMemoryId: existingMemory.id,
          existingConversationCount: existingMemory.conversation_count,
          existingMessageCount: existingMemory.message_count,
          newDataType: typeof memoryContent,
          newDataKeys: Object.keys(memoryContent)
        }
      });

      const mergeSystemPrompt = await getPrompt('v16_what_ai_remembers_profile_merge_system');
      const mergeUserPrompt = await getPrompt('v16_what_ai_remembers_profile_merge_user');

      const mergeResponse = await openai.chat.completions.create({
        model: getGPT4Model(),
        messages: [
          { role: 'system', content: mergeSystemPrompt },
          { 
            role: 'user', 
            content: `${mergeUserPrompt}\n\nExisting Memory:\n${JSON.stringify(existingMemory.memory_content, null, 2)}\n\nNew Memory Data:\n${JSON.stringify(memoryContent, null, 2)}` 
          }
        ],
        temperature: 0.3,
      });

      const mergedMemoryText = mergeResponse.choices[0]?.message?.content;
      
      logV16Memory('Merge response received', {
        hasResponse: !!mergedMemoryText,
        responseLength: mergedMemoryText?.length || 0
      });

      logV16MemoryServer({
        level: 'INFO',
        category: 'MEMORY_MERGE',
        operation: 'merge-ai-response-received',
        userId,
        data: { 
          hasResponse: !!mergedMemoryText,
          responseLength: mergedMemoryText?.length || 0,
          mergeResponsePreview: mergedMemoryText?.substring(0, 500) + '...'
        }
      });

      if (mergedMemoryText) {
        try {
          // Clean markdown code blocks if present  
          let cleanedMergeResponse = mergedMemoryText.trim();
          if (cleanedMergeResponse.includes('```json')) {
            cleanedMergeResponse = cleanedMergeResponse
              .replace(/```json\s*/g, '')
              .replace(/```\s*$/g, '')
              .trim();
          }

          finalMemoryContent = JSON.parse(cleanedMergeResponse);
          
          logV16Memory('✅ Successfully parsed merged memory', {
            mergedKeys: Object.keys(finalMemoryContent),
            mergedKeyCount: Object.keys(finalMemoryContent).length
          });

          logV16MemoryServer({
            level: 'INFO',
            category: 'MEMORY_MERGE',
            operation: 'merge-parsing-successful',
            userId,
            data: { 
              mergedKeys: Object.keys(finalMemoryContent),
              mergedKeyCount: Object.keys(finalMemoryContent).length,
              finalMemoryStructure: finalMemoryContent
            }
          });

        } catch (parseError) {
          logV16Memory('❌ Failed to parse merged memory, using new data only', {
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          });

          logV16MemoryServer({
            level: 'ERROR',
            category: 'MEMORY_MERGE',
            operation: 'merge-parsing-failed-using-new-data',
            userId,
            data: { 
              parseError: parseError instanceof Error ? parseError.message : String(parseError),
              fullMergeResponse: mergedMemoryText
            }
          });
        }
      }
    } else {
      logV16Memory('No existing memory found, using new data as-is');
      logV16MemoryServer({
        level: 'INFO',
        category: 'MEMORY_MERGE',
        operation: 'no-existing-memory-using-new-data',
        userId,
        data: { 
          newDataType: typeof memoryContent,
          newDataKeys: Object.keys(memoryContent)
        }
      });
    }

    // Save the processed memory data with conversation tracking
    const processedConversationIdsArray = qualityConversations.map(conv => conv.id);
    
    logV16Memory('Saving processed memory data to database', {
      conversationCount: qualityConversations.length,
      messageCount: qualityConversations.reduce((total, conv) => total + ((conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || []).length, 0),
      processedConversationIds: processedConversationIdsArray,
      finalMemoryContentType: typeof finalMemoryContent,
      finalMemoryKeys: Object.keys(finalMemoryContent)
    });

    logV16MemoryServer({
      level: 'INFO',
      category: 'DATABASE_SAVE',
      operation: 'saving-processed-memory',
      userId,
      data: { 
        conversationCount: qualityConversations.length,
        messageCount: qualityConversations.reduce((total, conv) => total + ((conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || []).length, 0),
        processedConversationIds: processedConversationIdsArray,
        finalMemoryContentType: typeof finalMemoryContent,
        finalMemoryKeys: Object.keys(finalMemoryContent),
        finalMemoryStructure: finalMemoryContent
      }
    });

    const { data: savedMemory, error: saveError } = await supabase
      .from('v16_memory')
      .insert({
        user_id: userId,
        memory_content: finalMemoryContent,
        conversation_count: qualityConversations.length,
        message_count: qualityConversations.reduce((total, conv) => total + ((conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || []).length, 0),
        conversation_ids: processedConversationIdsArray,
        generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (saveError) {
      logV16Memory('❌ Error saving memory data:', saveError);
      logV16MemoryServer({
        level: 'ERROR',
        category: 'DATABASE_SAVE',
        operation: 'save-memory-failed',
        userId,
        data: { 
          saveError: saveError.message,
          saveErrorDetails: saveError
        }
      });
      return NextResponse.json({ error: 'Failed to save memory data' }, { status: 500 });
    }

    const remainingAfterBatch = Math.max(0, unprocessedConversationIds.length - offset - batchSize);
    
    logV16Memory(`✅ Successfully processed ${qualityConversations.length} conversations`, {
      savedMemoryId: savedMemory.id,
      remainingConversations: remainingAfterBatch
    });

    logV16MemoryServer({
      level: 'INFO',
      category: 'PROCESSING_COMPLETE',
      operation: 'v16-memory-processing-completed',
      userId,
      data: { 
        conversationsProcessed: qualityConversations.length,
        savedMemoryId: savedMemory.id,
        remainingConversations: remainingAfterBatch,
        totalProcessingStats: {
          totalConversations,
          alreadyProcessed: processedConversationIds.size,
          unprocessedFound: unprocessedConversationIds.length,
          conversationsProcessed: qualityConversations.length,
          skippedTooShort: skippedConversations,
          hasMore: remainingAfterBatch > 0
        }
      }
    });

    return NextResponse.json({
      success: true,
      memory: savedMemory,
      stats: {
        totalConversations,
        alreadyProcessed: processedConversationIds.size,
        unprocessedFound: unprocessedConversationIds.length,
        conversationsProcessed: qualityConversations.length,
        skippedTooShort: skippedConversations,
        messagesProcessed: qualityConversations.reduce((total, conv) => total + ((conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || []).length, 0),
        hasMore: remainingAfterBatch > 0,
        remainingConversations: remainingAfterBatch
      }
    });

  } catch (error) {
    logV16Memory('❌ Critical error in process-memory API:', error);
    logV16MemoryServer({
      level: 'ERROR',
      category: 'PROCESSING_ERROR',
      operation: 'v16-memory-processing-failed',
      userId: 'unknown',
      data: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}