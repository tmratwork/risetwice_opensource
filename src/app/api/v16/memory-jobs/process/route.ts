import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logV16MemoryServer } from '@/utils/server-logger';
import { generateAISummaryFromV16Profile, updateUserProfileAISummary } from '../../utils/ai-summary';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// Helper function for debug logging
const logV16Memory = (message: string, ...args: unknown[]) => {
  const timestamp = new Date().toISOString();
  
  // Console log for server terminal
  console.log(`[v16_memory] ${timestamp} ${message}`, ...args);
};

async function getPrompt(category: string): Promise<string> {
  logV16Memory(`Fetching prompt for category: ${category}`);
  
  // Get the most recent prompt with actual content
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
    contentLength: latestVersion.content.length
  });

  return latestVersion.content;
}

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'VALIDATION',
        operation: 'background-processor-missing-job-id',
        data: {}
      });
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    logV16Memory(`🚀 BACKGROUND PROCESSOR STARTED for job: ${jobId}`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'BACKGROUND_PROCESSING',
      operation: 'job-processing-initiated',
      data: { jobId, source: 'background-processor' }
    });

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('v16_memory_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      logV16MemoryServer({
        level: 'ERROR',
        category: 'BACKGROUND_PROCESSING',
        operation: 'fetch-job-failed',
        data: { jobId, error: jobError?.message || 'Job not found' }
      });
      return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
    }

    if (job.status !== 'pending') {
      logV16Memory(`Job ${jobId} is not in pending status: ${job.status}`);
      return NextResponse.json({ 
        success: true, 
        message: `Job is already ${job.status}` 
      });
    }

    // Mark job as processing
    await supabase
      .from('v16_memory_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    logV16Memory(`Job ${jobId} marked as processing`);
    logV16MemoryServer({
      level: 'INFO',
      category: 'BACKGROUND_PROCESSING',
      operation: 'job-marked-processing',
      data: { 
        jobId, 
        userId: job.user_id,
        totalConversations: job.total_conversations
      }
    });

    try {
      // Get all conversations for the user
      // Using RPC function to bypass RLS for scheduled system operations
      const { data: allConversations, error: allConversationsError } = await supabase
        .rpc('get_user_conversations_for_memory', { 
          target_user_id: job.user_id,
          days_limit: 365 // Get all conversations for memory processing
        });

      if (allConversationsError) {
        throw new Error(`Failed to fetch conversations: ${allConversationsError.message}`);
      }

      // Get already processed conversation IDs from v16_conversation_analyses
      logV16Memory(`[v16_memory] BACKGROUND PROCESSOR - FETCHING processed conversations for user: ${job.user_id}`);
      
      const { data: analysisRecords } = await supabase
        .from('v16_conversation_analyses')
        .select('conversation_id')
        .eq('user_id', job.user_id);

      const processedConversationIds = new Set();
      if (analysisRecords) {
        analysisRecords.forEach(record => {
          processedConversationIds.add(record.conversation_id);
        });
      }

      logV16Memory(`[v16_memory] BACKGROUND PROCESSOR - PROCESSED CONVERSATIONS RESULT:`, {
        userId: job.user_id,
        foundAnalysisRecords: analysisRecords?.length || 0,
        totalProcessedConversationIds: Array.from(processedConversationIds).slice(0, 10), // Show first 10
        processedCount: processedConversationIds.size
      });

      // Filter unprocessed conversations
      const unprocessedConversationIds = allConversations
        .filter((conv: { id: string }) => !processedConversationIds.has(conv.id))
        .map((conv: { id: string }) => conv.id);

      // Process the next 10 unprocessed conversations (most recent first)
      const batchSize = job.batch_size || 10;
      const conversationIdsToProcess = unprocessedConversationIds.slice(0, batchSize);
      
      logV16Memory(`🎯 CRITICAL: CONVERSATION SELECTION BREAKDOWN:`, {
        jobId,
        totalConversations: allConversations.length,
        unprocessedCount: unprocessedConversationIds.length,
        processingCount: conversationIdsToProcess.length,
        firstFew_AllConversationIds: allConversations.slice(0, 5).map((c: { id: string }) => c.id),
        firstFew_UnprocessedIds: unprocessedConversationIds.slice(0, 5),
        EXACT_ConversationIdsToProcess: conversationIdsToProcess
      });
      
      if (conversationIdsToProcess.length === 0) {
        // No conversations to process - mark as completed
        await supabase
          .from('v16_memory_jobs')
          .update({
            status: 'completed',
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            processing_details: { message: 'No conversations to process' }
          })
          .eq('id', jobId);

        logV16Memory(`Job ${jobId} completed - no conversations to process`);
        return NextResponse.json({ 
          success: true, 
          message: 'No conversations to process' 
        });
      }

      // Get full conversation data with messages
      // Using RPC function to bypass RLS for scheduled system operations
      const { data: conversationData, error: conversationsError } = await supabase
        .rpc('get_user_conversations_with_messages_for_memory', { 
          target_user_id: job.user_id,
          conversation_ids: conversationIdsToProcess
        });

      if (conversationsError || !conversationData) {
        throw new Error(`Failed to fetch conversation details: ${conversationsError?.message}`);
      }

      // Transform the flattened data back to nested structure
      const conversationsMap = new Map();
      conversationData.forEach((row: Record<string, unknown>) => {
        if (!conversationsMap.has(row.id)) {
          conversationsMap.set(row.id, {
            id: row.id,
            created_at: row.created_at,
            messages: []
          });
        }
        if (row.message_id) {
          conversationsMap.get(row.id).messages.push({
            id: row.message_id,
            content: row.message_content,
            role: row.message_role,
            created_at: row.message_created_at
          });
        }
      });
      
      const conversations = Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Filter quality conversations
      logV16Memory(`🔍 QUALITY FILTERING START:`, {
        jobId,
        fetchedConversations: conversations.length,
        conversationIds: conversations.map(c => c.id)
      });
      
      const qualityConversations = conversations.filter((conv, index) => {
        const messages = (conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || [];
        const userMessages = messages.filter(msg => msg.role === 'user');
        const userContent = userMessages.map(msg => msg.content || '').join(' ');
        
        const isQuality = messages.length >= 6 && 
                         userMessages.length >= 3 && 
                         userContent.length >= 200;
        
        logV16Memory(`🔍 CONVERSATION ${index + 1} QUALITY CHECK:`, {
          conversationId: conv.id,
          totalMessages: messages.length,
          userMessages: userMessages.length,
          userContentLength: userContent.length,
          passesQuality: isQuality,
          criteria: {
            needsMinMessages: 6,
            hasMessages: messages.length,
            needsMinUserMessages: 3,
            hasUserMessages: userMessages.length,
            needsMinContent: 200,
            hasContent: userContent.length
          }
        });
        
        return isQuality;
      });
      
      logV16Memory(`🔍 QUALITY FILTERING RESULT:`, {
        jobId,
        originalCount: conversations.length,
        qualityCount: qualityConversations.length,
        filteredOut: conversations.length - qualityConversations.length,
        qualityConversationIds: qualityConversations.map(c => c.id)
      });

      const progressPercentage = Math.min(
        Math.round(((job.processed_conversations + conversationIdsToProcess.length) / job.total_conversations) * 100),
        100
      );

      // Update progress
      await supabase
        .from('v16_memory_jobs')
        .update({
          processed_conversations: job.processed_conversations + conversationIdsToProcess.length,
          progress_percentage: progressPercentage,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (qualityConversations.length === 0) {
        logV16Memory(`Job ${jobId} batch completed - no quality conversations, but saving examined conversation IDs to prevent re-processing`);
        
        // Save each examined conversation as analyzed (with empty analysis) to prevent re-processing
        const skippedAnalysisRecords = conversationIdsToProcess.map((conversationId: string) => ({
          user_id: job.user_id,
          conversation_id: conversationId,
          analysis_result: { skipped: true, reason: 'insufficient_quality' }, // Mark as skipped
          extracted_at: new Date().toISOString()
        }));

        const { data: savedAnalyses, error: saveError } = await supabase
          .from('v16_conversation_analyses')
          .insert(skippedAnalysisRecords)
          .select();

        if (saveError) {
          logV16Memory(`[v16_memory] ❌ FAILED to save skipped conversation analyses:`, {
            jobId: jobId,
            userId: job.user_id,
            error: saveError,
            skippedConversationIds: conversationIdsToProcess
          });
          throw new Error(`Failed to save skipped conversation analyses: ${saveError.message}`);
        }

        logV16Memory(`[v16_memory] ✅ SAVED SKIPPED CONVERSATION ANALYSES:`, {
          jobId: jobId,
          userId: job.user_id,
          savedAnalyses: savedAnalyses?.length || 0,
          skippedConversationIds: conversationIdsToProcess,
          skippedCount: conversationIdsToProcess.length
        });
        
        // Update user profile timestamp even when no quality conversations found
        // This ensures the UI shows the correct "Generated on" date
        await supabase
          .from('user_profiles')
          .upsert({
            user_id: job.user_id,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: false
          });

        logV16Memory(`[v16_memory] ✅ UPDATED user profile timestamp for processed batch with no quality conversations:`, {
          jobId: jobId,
          userId: job.user_id,
          conversationsExamined: conversationIdsToProcess.length
        });
        
        // Each job processes exactly one batch, so mark as completed
        await supabase
          .from('v16_memory_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            processing_details: { 
              message: 'Completed - no quality conversations in this batch, but tracked as examined',
              conversationsExamined: conversationIdsToProcess.length,
              qualityConversationsFound: 0,
              conversationsMarkedAsSkipped: conversationIdsToProcess.length
            }
          })
          .eq('id', jobId);

        logV16Memory(`✅ Job ${jobId} completed - examined ${conversationIdsToProcess.length} conversations, found no quality conversations, but saved as skipped to prevent re-processing`);

        return NextResponse.json({ 
          success: true, 
          message: 'No quality conversations in this batch, but marked as examined',
          isComplete: true,
          profileId: 'skipped-batch',
          profileVersion: 0,
          skippedConversations: conversationIdsToProcess.length
        });
      }

      // Update progress: Starting AI analysis
      await supabase
        .from('v16_memory_jobs')
        .update({
          updated_at: new Date().toISOString(),
          processing_details: { 
            currentStep: 'Analyzing conversations with AI...',
            qualityConversationsFound: qualityConversations.length,
            conversationsExamined: conversationIdsToProcess.length
          }
        })
        .eq('id', jobId);

      // Get prompts for memory extraction
      const extractionSystemPrompt = await getPrompt('v16_what_ai_remembers_extraction_system');
      const extractionUserPrompt = await getPrompt('v16_what_ai_remembers_extraction_user');

      // Process conversations individually to avoid token limits
      const extractedInsights: Record<string, unknown>[] = [];
      let conversationsProcessedCount = 0;
      let conversationsSkippedCount = 0;
      let conversationsFailedCount = 0;
      let conversationsDuplicateCount = 0;
      let totalTokensProcessed = 0;
      const duplicateConversationIds: string[] = [];

      logV16Memory(`🔄 Processing ${qualityConversations.length} conversations individually - Job ${jobId}`);

      // Process each conversation separately
      for (let i = 0; i < qualityConversations.length; i++) {
        const conv = qualityConversations[i];
        const messages = (conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || [];
        const conversationText = messages
          .map(msg => `${msg.role}: ${msg.content}`)
          .join('\n');
        
        const messageCount = messages.length;
        const estimatedTokens = Math.ceil(conversationText.length / 4); // Rough token estimate
        
        logV16Memory(`📝 Processing conversation ${i + 1}/${qualityConversations.length} - ID: ${conv.id}`, {
          messageCount,
          estimatedTokens,
          conversationLength: conversationText.length
        });

        const processingStartTime = Date.now();
        let analysisResult: Record<string, unknown>;
        let processingStatus = 'processing';
        let errorDetails = null;
        let skipReason = null;

        try {
          // Skip if conversation is too short (less than 2 messages)
          if (messageCount < 2) {
            logV16Memory(`⏭️ Skipping conversation ${conv.id} - too short (${messageCount} messages)`);
            analysisResult = {
              skipped: true,
              reason: 'too_short',
              message_count: messageCount
            };
            processingStatus = 'skipped';
            skipReason = 'too_short';
            conversationsSkippedCount++;
          }
          // Skip if estimated tokens are too high (safety check)
          else if (estimatedTokens > 6000) {
            logV16Memory(`⏭️ Skipping conversation ${conv.id} - too long (${estimatedTokens} estimated tokens)`);
            analysisResult = {
              skipped: true,
              reason: 'too_long',
              estimated_tokens: estimatedTokens
            };
            processingStatus = 'skipped';
            skipReason = 'too_long';
            conversationsSkippedCount++;
          }
          else {
            // Call OpenAI for individual conversation extraction
            const extractionResponse = await openai.chat.completions.create({
              model: 'gpt-4',
              messages: [
                { role: 'system', content: extractionSystemPrompt },
                { role: 'user', content: `${extractionUserPrompt}\n\nConversation:\n${conversationText}` }
              ],
              temperature: 0.3,
            });

            const extractedText = extractionResponse.choices[0]?.message?.content;
            
            if (!extractedText) {
              throw new Error('Empty response from OpenAI');
            }

            // Parse extracted insights for this conversation
            let cleanedResponse = extractedText.trim();
            if (cleanedResponse.includes('```json')) {
              cleanedResponse = cleanedResponse
                .replace(/```json\s*/g, '')
                .replace(/```\s*$/g, '')
                .trim();
            }
            
            const conversationInsights = JSON.parse(cleanedResponse);
            
            // Check if AI determined this conversation has insufficient quality
            if (conversationInsights.skipped === true || conversationInsights.skip === true) {
              logV16Memory(`⏭️ AI skipped conversation ${conv.id} - ${conversationInsights.reason || 'insufficient_quality'}`);
              analysisResult = conversationInsights;
              processingStatus = 'skipped';
              skipReason = conversationInsights.reason || 'insufficient_quality';
              conversationsSkippedCount++;
            } else {
              // Valid insights extracted
              extractedInsights.push(conversationInsights);
              analysisResult = conversationInsights;
              processingStatus = 'completed';
              conversationsProcessedCount++;
              totalTokensProcessed += estimatedTokens;
              logV16Memory(`✅ Successfully extracted insights from conversation ${conv.id}`);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown extraction error';
          logV16Memory(`❌ Failed to process conversation ${conv.id}:`, errorMessage);
          
          analysisResult = {
            skipped: true,
            reason: 'processing_error',
            error: errorMessage
          };
          processingStatus = 'failed';
          errorDetails = { error: errorMessage, step: 'extraction' };
          conversationsFailedCount++;
        }

        const processingDuration = Date.now() - processingStartTime;

        // Save detailed analysis result to database
        // First check if conversation already exists
        const { data: existingAnalysis } = await supabase
          .from('v16_conversation_analyses')
          .select('id, analysis_result')
          .eq('conversation_id', conv.id)
          .single();

        if (existingAnalysis) {
          // Conversation already analyzed - track as duplicate
          conversationsDuplicateCount++;
          duplicateConversationIds.push(conv.id);
          
          logV16Memory(`⚠️ Conversation ${conv.id} already analyzed - skipping duplicate processing`, {
            existingAnalysisId: existingAnalysis.id,
            conversationIndex: i + 1,
            totalConversations: qualityConversations.length
          });

          // Update the existing record with duplicate processing metadata
          await supabase
            .from('v16_conversation_analyses')
            .update({
              extraction_metadata: {
                model: 'gpt-4',
                processing_duration_ms: processingDuration,
                job_id: jobId,
                duplicate_processing_attempt: true,
                duplicate_attempt_at: new Date().toISOString()
              }
            })
            .eq('id', existingAnalysis.id);
        } else {
          // New conversation - save analysis
          const { error: saveError } = await supabase
            .from('v16_conversation_analyses')
            .insert({
              user_id: job.user_id,
              conversation_id: conv.id,
              analysis_result: analysisResult,
              extracted_at: new Date().toISOString(),
              message_count: messageCount,
              total_tokens: estimatedTokens,
              processing_status: processingStatus,
              error_details: errorDetails,
              extraction_metadata: {
                model: 'gpt-4',
                processing_duration_ms: processingDuration,
                job_id: jobId
              },
              quality_score: processingStatus === 'completed' ? 8 : (processingStatus === 'skipped' ? 3 : 0),
              skip_reason: skipReason,
              processing_duration_ms: processingDuration
            });

          if (saveError) {
            logV16Memory(`❌ Failed to save conversation analysis for ${conv.id}:`, {
              error: saveError.message,
              conversationId: conv.id
            });
            // Track as failed but continue processing other conversations
            conversationsFailedCount++;
          }
        }

        // Update job progress with duplicate tracking
        const progressPercentage = Math.round(((i + 1) / qualityConversations.length) * 100);
        await supabase
          .from('v16_memory_jobs')
          .update({
            processed_conversations: i + 1,
            progress_percentage: progressPercentage,
            processing_details: {
              currentStep: `Processing conversation ${i + 1}/${qualityConversations.length}`,
              conversationsExamined: i + 1,
              conversationsProcessed: conversationsProcessedCount,
              conversationsSkipped: conversationsSkippedCount,
              conversationsFailed: conversationsFailedCount,
              conversationsDuplicate: conversationsDuplicateCount,
              duplicateConversationIds: duplicateConversationIds
            },
            conversations_skipped: conversationsSkippedCount,
            conversations_failed: conversationsFailedCount,
            total_tokens_processed: totalTokensProcessed
          })
          .eq('id', jobId);

        logV16Memory(`📊 Progress: ${i + 1}/${qualityConversations.length} conversations examined, ${conversationsProcessedCount} processed, ${conversationsSkippedCount} skipped, ${conversationsDuplicateCount} duplicate, ${conversationsFailedCount} failed`);
        
        // Small delay between conversations to prevent rate limiting
        if (i < qualityConversations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      logV16Memory(`✅ Individual processing complete - Job ${jobId}`, {
        totalExamined: qualityConversations.length,
        processed: conversationsProcessedCount,
        skipped: conversationsSkippedCount,
        duplicate: conversationsDuplicateCount,
        failed: conversationsFailedCount,
        extractedInsights: extractedInsights.length,
        duplicateConversationIds: duplicateConversationIds
      });

      // Combine all extracted insights into a single memory content object
      let memoryContent: Record<string, unknown> = {};
      
      if (extractedInsights.length === 0) {
        logV16Memory(`ℹ️ No valid insights extracted from any conversation - Job ${jobId}`);
        memoryContent = {
          message: 'No valid insights could be extracted from the processed conversations',
          processing_summary: {
            conversations_examined: qualityConversations.length,
            conversations_processed: conversationsProcessedCount,
            conversations_skipped: conversationsSkippedCount,
            conversations_failed: conversationsFailedCount
          }
        };
      } else {
        // Merge insights from all processed conversations
        logV16Memory(`🔄 Merging ${extractedInsights.length} conversation insights - Job ${jobId}`);
        
        // Simple merge strategy: combine arrays and deduplicate objects
        for (const insight of extractedInsights) {
          for (const [key, value] of Object.entries(insight)) {
            if (Array.isArray(value)) {
              if (!memoryContent[key]) memoryContent[key] = [];
              (memoryContent[key] as unknown[]).push(...value);
            } else if (typeof value === 'object' && value !== null) {
              if (!memoryContent[key]) memoryContent[key] = {};
              Object.assign(memoryContent[key] as Record<string, unknown>, value);
            } else {
              // For primitive values, take the last one
              memoryContent[key] = value;
            }
          }
        }
      }

      logV16Memory(`🔄 Memory content prepared - Job ${jobId}`, {
        hasContent: Object.keys(memoryContent).length > 0,
        contentKeys: Object.keys(memoryContent),
        totalInsights: extractedInsights.length
      });

      // Update job progress: Ready to merge with existing profile  
      await supabase
        .from('v16_memory_jobs')
        .update({
          updated_at: new Date().toISOString(),
          processing_details: { 
            currentStep: 'Merging with existing user profile...',
            qualityConversationsFound: qualityConversations.length,
            conversationsExamined: conversationIdsToProcess.length,
            extractionCompleted: true
          }
        })
        .eq('id', jobId);

      // Step 2: Fetch existing unified user profile
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', job.user_id)
        .single();

      let finalMemoryContent = memoryContent;

      // Step 3: Merge with existing profile if it exists
      if (existingProfile) {
        const mergeSystemPrompt = await getPrompt('v16_what_ai_remembers_profile_merge_system');
        const mergeUserPrompt = await getPrompt('v16_what_ai_remembers_profile_merge_user');

        const mergeResponse = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: mergeSystemPrompt },
            { 
              role: 'user', 
              content: `${mergeUserPrompt}\n\nExisting Profile:\n${JSON.stringify(existingProfile.profile_data, null, 2)}\n\nNew Memory Data:\n${JSON.stringify(memoryContent, null, 2)}` 
            }
          ],
          temperature: 0.3,
        });

        const mergedMemoryText = mergeResponse.choices[0]?.message?.content;
        
        if (mergedMemoryText) {
          try {
            let cleanedMergeResponse = mergedMemoryText.trim();
            if (cleanedMergeResponse.includes('```json')) {
              cleanedMergeResponse = cleanedMergeResponse
                .replace(/```json\s*/g, '')
                .replace(/```\s*$/g, '')
                .trim();
            }
            finalMemoryContent = JSON.parse(cleanedMergeResponse);
          } catch (parseError) {
            logV16Memory('Failed to parse merged memory, using new data only', {
              jobId,
              parseError: parseError instanceof Error ? parseError.message : String(parseError)
            });
          }
        }
      }

      // Step 4: Update or create unified user profile
      const currentMessageCount = qualityConversations.reduce((total, conv) => total + ((conv.messages as Array<{id: string, content: string, role: string, created_at: string}>) || []).length, 0);
      
      const existingConversationCount = existingProfile?.conversation_count || 0;
      const existingMessageCount = existingProfile?.message_count || 0;
      const existingVersion = existingProfile?.version || 0;
      
      const totalConversationCount = existingConversationCount + qualityConversations.length;
      const totalMessageCount = existingMessageCount + currentMessageCount;
      const newVersion = existingVersion + 1;
      
      // Update progress: Saving unified profile
      await supabase
        .from('v16_memory_jobs')
        .update({
          updated_at: new Date().toISOString(),
          processing_details: { 
            currentStep: 'Saving unified user profile...',
            qualityConversationsFound: qualityConversations.length,
            conversationsExamined: conversationIdsToProcess.length,
            extractionCompleted: true,
            mergeCompleted: true,
            newVersion: newVersion
          }
        })
        .eq('id', jobId);

      logV16Memory(`[v16_memory] 💾 STEP 4: PREPARING to update unified user profile:`, {
        jobId: jobId,
        userId: job.user_id,
        qualityConversationsProcessed: qualityConversations.length,
        currentMessageCount: currentMessageCount,
        totalConversationCount: totalConversationCount,
        totalMessageCount: totalMessageCount,
        newVersion: newVersion,
        memoryContentKeys: Object.keys(finalMemoryContent),
        memoryContentSize: JSON.stringify(finalMemoryContent).length
      });
      
      const { data: savedProfile, error: saveError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: job.user_id,
          profile_data: finalMemoryContent,
          conversation_count: totalConversationCount,
          message_count: totalMessageCount,
          version: newVersion,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (saveError) {
        logV16Memory(`[v16_memory] ❌ FAILED to save unified user profile:`, {
          jobId: jobId,
          userId: job.user_id,
          error: saveError,
          conversationIds: qualityConversations.map(c => c.id)
        });
        throw new Error(`Failed to save unified user profile: ${saveError.message}`);
      }

      logV16Memory(`[v16_memory] ✅ SUCCESSFULLY SAVED unified user profile:`, {
        jobId: jobId,
        profileId: savedProfile.id,
        userId: job.user_id,
        qualityConversationIds: qualityConversations.map(c => c.id),
        totalConversationCount: savedProfile.conversation_count,
        totalMessageCount: savedProfile.message_count,
        version: savedProfile.version,
        updatedAt: savedProfile.updated_at
      });

      // STEP 5: Generate AI Summary for Prompt Injection
      // Only generate AI summary if we processed quality conversations with actual content
      if (qualityConversations.length > 0 && Object.keys(finalMemoryContent).length > 0) {
        logV16Memory(`[v16_memory] 📝 STEP 5: GENERATING AI summary for prompt injection:`, {
          jobId: jobId,
          userId: job.user_id,
          profileDataKeys: Object.keys(finalMemoryContent),
          profileDataSize: JSON.stringify(finalMemoryContent).length
        });

        try {
          // Generate AI summary from V16 profile data
          const aiSummary = await generateAISummaryFromV16Profile(job.user_id, finalMemoryContent);

          // Update user_profiles table with the AI summary (bridges to V15 prompt injection system)
          await updateUserProfileAISummary(job.user_id, aiSummary);

          logV16Memory(`[v16_memory] ✅ SUCCESSFULLY GENERATED and SAVED AI summary:`, {
            jobId: jobId,
            userId: job.user_id,
            summaryLength: aiSummary.length,
            summaryPreview: aiSummary.substring(0, 100) + '...'
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logV16Memory(`[v16_memory] ❌ FAILED to generate AI summary:`, {
            jobId: jobId,
            userId: job.user_id,
            error: errorMessage
          });
          
          // Log error but don't fail the entire job - memory processing was successful
          logV16MemoryServer({
            level: 'ERROR',
            category: 'AI_SUMMARY_GENERATION',
            operation: 'summary-generation-failed-in-job',
            data: {
              jobId,
              userId: job.user_id,
              error: errorMessage
            }
          });
        }
      } else {
        logV16Memory(`[v16_memory] ⏭️ SKIPPING AI summary generation - no quality conversations processed:`, {
          jobId: jobId,
          userId: job.user_id,
          qualityConversationsCount: qualityConversations.length,
          memoryContentKeys: Object.keys(finalMemoryContent).length
        });
      }

      // Mark job as completed with detailed individual processing statistics
      const currentProgressPercentage = 100; // Individual processing always completes fully
      const processingEndTime = new Date().toISOString();
      
      // Determine if there were issues that should be visible
      const hasWarnings = conversationsDuplicateCount > 0 || conversationsFailedCount > 0;
      const warningMessage = hasWarnings ? 
        `Completed with warnings: ${conversationsDuplicateCount} duplicates, ${conversationsFailedCount} failed` : 
        null;
      
      await supabase
        .from('v16_memory_jobs')
        .update({
          status: 'completed',
          progress_percentage: currentProgressPercentage,
          completed_at: processingEndTime,
          updated_at: processingEndTime,
          processing_end_time: processingEndTime,
          conversations_skipped: conversationsSkippedCount,
          conversations_failed: conversationsFailedCount,
          average_quality_score: conversationsProcessedCount > 0 ? 8.0 : 0,
          total_tokens_processed: totalTokensProcessed,
          error_message: warningMessage, // Store warnings in error_message field for visibility
          processing_details: {
            conversationsExamined: qualityConversations.length,
            conversationsProcessed: conversationsProcessedCount,
            conversationsSkipped: conversationsSkippedCount,
            conversationsDuplicate: conversationsDuplicateCount,
            conversationsFailed: conversationsFailedCount,
            duplicateConversationIds: duplicateConversationIds,
            qualityConversationsProcessed: conversationsProcessedCount,
            profileId: savedProfile.id,
            profileVersion: savedProfile.version,
            profileUpdated: conversationsProcessedCount > 0,
            individualProcessing: true,
            processingMethod: 'individual_conversations',
            totalTokensProcessed: totalTokensProcessed,
            hasWarnings: hasWarnings
          }
        })
        .eq('id', jobId);

      logV16Memory(`✅ Job ${jobId} completed successfully`, {
        conversationsExamined: conversationIdsToProcess.length,
        qualityConversationsFound: qualityConversations.length,
        conversationsDuplicate: conversationsDuplicateCount,
        profileId: savedProfile.id,
        profileVersion: savedProfile.version,
        hasWarnings: hasWarnings,
        warningMessage: warningMessage
      });

      logV16MemoryServer({
        level: hasWarnings ? 'WARNING' : 'INFO',
        category: 'BACKGROUND_PROCESSING',
        operation: 'job-processing-completed',
        data: {
          jobId,
          userId: job.user_id,
          conversationsProcessed: qualityConversations.length,
          conversationsDuplicate: conversationsDuplicateCount,
          conversationsFailed: conversationsFailedCount,
          duplicateConversationIds: duplicateConversationIds,
          profileId: savedProfile.id,
          profileVersion: savedProfile.version,
          isComplete: true,
          progressPercentage: currentProgressPercentage,
          hasWarnings: hasWarnings,
          warningMessage: warningMessage
        }
      });

      return NextResponse.json({
        success: true,
        processed: qualityConversations.length,
        profileId: savedProfile.id,
        profileVersion: savedProfile.version,
        isComplete: true,
        progressPercentage: currentProgressPercentage
      });

    } catch (processingError) {
      // Mark job as failed
      await supabase
        .from('v16_memory_jobs')
        .update({
          status: 'failed',
          error_message: processingError instanceof Error ? processingError.message : String(processingError),
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      logV16Memory(`Job ${jobId} failed:`, processingError);
      logV16MemoryServer({
        level: 'ERROR',
        category: 'BACKGROUND_PROCESSING',
        operation: 'job-processing-failed',
        data: {
          jobId,
          error: processingError instanceof Error ? processingError.message : String(processingError),
          stack: processingError instanceof Error ? processingError.stack : undefined
        }
      });

      throw processingError;
    }

  } catch (error) {
    logV16Memory('❌ Critical error in background processor:', error);
    logV16MemoryServer({
      level: 'ERROR',
      category: 'BACKGROUND_PROCESSING_ERROR',
      operation: 'background-processor-critical-failure',
      data: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}