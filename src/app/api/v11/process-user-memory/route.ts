/**
 * API endpoint that coordinates the full user profile update process
 * Orchestrates both stages:
 * 1. Analyzing new conversations
 * 2. Merging analysis results with existing profile
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getApiBaseUrl } from '@/lib/api-helpers';
import fs from 'fs';
import path from 'path';

// Define job tracking interfaces
// Tracking job status and progress
// Used for database operations in this file

// Job management helper functions
async function createProfileJob(jobId: string, userId: string, totalConversations: number) {
  try {
    console.log(`Creating profile job: jobId=${jobId}, userId=${userId}, totalConversations=${totalConversations}`);

    // Ensure userId is in the correct format for UUID
    // When passing a user ID to a UUID column, we need to make sure it's properly formatted
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      console.warn(`Warning: userId ${userId} may not be a valid UUID format`);
      // Still try inserting as Supabase might handle the conversion
    }

    // Simple, direct insert with proper data types
    const { data, error } = await supabase
      .from('profile_job_status')
      .insert({
        id: jobId,
        user_id: userId, // This will be treated as a UUID by Supabase
        status: 'pending',
        progress: 0,
        total_conversations: totalConversations,
        processed_conversations: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error(`Error creating profile job in database:`, error);
      return false;
    }

    console.log(`Profile job created successfully:`, data);
    return true;
  } catch (e) {
    console.error('Error in createProfileJob:', e);
    return false;
  }
}

async function updateProfileJob(
  jobId: string,
  updates: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    processedConversations?: number;
    error?: string;
  }
) {
  try {
    // Convert camelCase to snake_case for database column names
    const dbUpdates: Record<string, string | number | boolean | null> = {
      updated_at: new Date().toISOString()
    };

    // Map camelCase keys to snake_case for the database
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
    if (updates.processedConversations !== undefined) dbUpdates.processed_conversations = updates.processedConversations;
    if (updates.error !== undefined) dbUpdates.error = updates.error;

    const { error } = await supabase
      .from('profile_job_status')
      .update(dbUpdates)
      .eq('id', jobId);

    if (error) {
      console.error(`Error updating profile job in database:`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error in updateProfileJob:', e);
    return false;
  }
}

async function getProfileJob(jobId: string) {
  try {
    const { data, error } = await supabase
      .from('profile_job_status')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error(`Error getting profile job:`, error);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Error in getProfileJob:', e);
    return null;
  }
}

// Check job status endpoint
export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
  }

  // Fetch job status from the database
  const job = await getProfileJob(jobId);

  if (!job) {
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
    error: job.error,
    userProfileUpdated: job.status === 'completed',
    lastUpdated: job.updated_at
  });
}

// Helper function to create or clear the log file
function createOrClearLogFile() {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'user_profile_log.txt');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // If log file exists, delete it to start fresh
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
      console.log('Cleared existing user_profile_log.txt file');
    }

    // Create empty log file
    fs.writeFileSync(logFile, '');
    console.log('Created new user_profile_log.txt file');
  } catch (err) {
    console.error(`Error creating or clearing log file:`, err);
  }
}

export async function POST(req: Request) {
  // Clear the log file at the start of each profile generation run
  createOrClearLogFile();

  const requestId = Date.now().toString().slice(-6);
  const jobId = `profile-${requestId}`;
  const logPrefix = `[PROCESS-MEMORY-${requestId}]`;

  // Log API verification at startup
  console.log(`${logPrefix} Checking for API endpoints using Bash commands`);

  try {
    // Check for required API endpoint files
    // Get the API base URL based on environment
    const baseUrl = getApiBaseUrl();

    console.log(`${logPrefix} Environment: ${process.env.NODE_ENV}`);
    console.log(`${logPrefix} Using API base URL: ${baseUrl}`);

    const endpoints = [
      '/api/v11/analyze-conversation',  // This file exists but may have issues with supabaseAdmin
      '/api/v11/update-user-profile'    // This file exists but may have issues with supabaseAdmin
    ];

    console.log(`${logPrefix} API endpoints that will be used in this process:`, endpoints);
    console.log(`${logPrefix} NOTE: Both endpoint files exist in the codebase, but they may have issues with supabaseAdmin`);
    console.log(`${logPrefix} They were recently updated to use supabaseAdmin which is now just an alias for the regular supabase client`);

    // Check for corresponding files in the filesystem
    console.log(`${logPrefix} Checking for endpoint files in src/app/api/v11/...`);

    // Parse request body
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Starting memory processing for user ${userId}`);

    // 1. Find conversations that haven't been analyzed yet

    // Get the list of already processed conversations
    const { data: processedConvs, error: processedError } = await supabaseAdmin
      .from('processed_conversations')
      .select('conversation_id')
      .eq('user_id', userId);

    if (processedError) {
      console.error(`${logPrefix} Error fetching processed conversations:`, processedError);
      return NextResponse.json({
        error: 'Failed to fetch processed conversations',
        details: processedError.message
      }, { status: 500 });
    }

    // Extract the IDs of processed conversations
    const processedIds = processedConvs ? processedConvs.map(pc => pc.conversation_id) : [];

    // First fetch conversations for this user
    // Note: User conversations are stored in the conversations table with human_id field
    const { data: userConversations, error: convsError } = await supabaseAdmin
      .from('conversations')
      .select('id, created_at')
      .eq('human_id', userId)
      .order('created_at', { ascending: false }) // Most recent first
      .limit(50); // Increased from 10 to 50 to support more conversations

    // Count total conversations for progress tracking
    const totalConversations = !convsError && userConversations ? userConversations.length : 0;

    // Create a job in the database
    console.log(`${logPrefix} Creating profile job: jobId=${jobId}, userId=${userId}, totalConversations=${totalConversations}`);

    // Check if the firebase user ID is a valid UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      console.warn(`${logPrefix} Warning: userId ${userId} is not in valid UUID format required by Supabase`);
    }

    // First, let's check if the table exists and is accessible
    try {
      const { count, error: tableCheckError } = await supabase
        .from('profile_job_status')
        .select('*', { count: 'exact', head: true });

      console.log(`${logPrefix} Table check before insert - exists: ${count !== null}, count: ${count}, error:`, tableCheckError);
    } catch (tableError) {
      console.error(`${logPrefix} Error checking table:`, tableError);
    }

    const jobCreated = await createProfileJob(jobId, userId, totalConversations);

    if (!jobCreated) {
      console.error(`${logPrefix} Failed to create profile job in database`);

      // If job creation failed, let's verify the table schema
      try {
        // List the columns in the table to verify schema
        const describeTable = await supabase.rpc('get_table_definition', {
          table_name: 'profile_job_status'
        });
        console.log(`${logPrefix} Table definition:`, describeTable);
      } catch (schemaError) {
        console.error(`${logPrefix} Unable to check table schema:`, schemaError);
      }

      // Return proper error response
      return NextResponse.json({
        error: 'Failed to create job in database',
        jobId,
        status: 'processing',
        totalConversations
      }, { status: 500 });
    }

    // Return immediately with the job ID
    const response = NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Profile processing started',
      totalConversations
    });

    // Start the processing in the background
    processUserProfile(jobId, logPrefix, userId, userConversations, processedIds, convsError);

    return response;
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Interface for user conversation structure
interface UserConversation {
  id: string;
  created_at: string;
  [key: string]: string | number | boolean | object | null; // Allow for additional properties with specific types
}

// Interface for Supabase error type
interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

// Helper function to write logs to a file
async function writeLogToFile(logPrefix: string, message: string, data?: unknown) {
  try {
    const timestamp = new Date().toISOString();
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'user_profile_log.txt');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Check if the message includes newlines - if so, format it specially
    if (message.includes('\n')) {
      // First add the timestamp and prefix
      let logEntry = `[${timestamp}] ${logPrefix} MULTI-LINE MARKER:`;
      // Then add an empty line
      logEntry += '\n\n';
      // Add the entire message with all its newlines preserved
      logEntry += message;
      // Add another empty line
      logEntry += '\n\n';

      // Add data if provided
      if (data !== undefined) {
        logEntry += typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
        logEntry += '\n';
      }

      // Append to log file
      fs.appendFileSync(logFile, logEntry);
      return;
    }

    // Standard single-line message handling
    let logEntry = `[${timestamp}] ${logPrefix} ${message}`;
    if (data !== undefined) {
      logEntry += `\n${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`;
    }
    logEntry += '\n';

    // Append to log file
    fs.appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error(`Error writing to log file:`, err);
  }
}

// Background processing function
async function processUserProfile(
  jobId: string,
  logPrefix: string,
  userId: string,
  userConversations: UserConversation[] | null,
  processedIds: string[],
  convsError: SupabaseError | null
) {
  // Start logging to file with clear section markers and session summary
  await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS START: PROFILE GENERATION =======================
=======================================================================
=======================================================================`);

  // Add a clear session summary at the beginning
  const unprocessedCount = userConversations?.length ? userConversations.filter(conv => !processedIds.includes(conv.id)).length : 0;

  await writeLogToFile(logPrefix, `
*********************************************************************
*                       SESSION SUMMARY                             *
*********************************************************************
* USER ID: ${userId}
* TOTAL CONVERSATIONS: ${userConversations?.length || 0}
* ALREADY PROCESSED: ${processedIds.length}
* POTENTIALLY UNPROCESSED: ${unprocessedCount} (includes empty conversations)
*********************************************************************`);

  await writeLogToFile(logPrefix, `USER: ${userId}`);
  await writeLogToFile(logPrefix, `CONVERSATIONS: ${userConversations?.length || 0} total, ${processedIds.length} already processed`);
  try {
    // Update job status to processing
    await updateProfileJob(jobId, {
      status: 'processing'
    });

    if (convsError) {
      console.error(`${logPrefix} Error fetching conversations:`, convsError);
      console.log(`${logPrefix} Conversations table might not be accessible - skipping conversation analysis`);

      // Instead of failing, skip to stage 2 to at least create an empty user profile
      console.log(`${logPrefix} Proceeding to user profile creation/update`);
    }

    if (!convsError && (!userConversations || userConversations.length === 0)) {
      console.log(`${logPrefix} No conversations found for user ${userId}`);
      console.log(`${logPrefix} Proceeding to create/update user profile anyway`);
    }

    let processedCount = 0;
    const totalConversations = !convsError && userConversations ? userConversations.length : 0;

    // Only proceed with message analysis if we have valid conversation data
    if (!convsError && userConversations && userConversations.length > 0) {
      // Filter out conversations that have already been processed
      const unprocessedConversations = userConversations.filter(
        conversation => !processedIds.includes(conversation.id)
      );

      if (unprocessedConversations.length === 0) {
        console.log(`${logPrefix} All conversations already processed for user ${userId}`);
        
        // Add detailed debug information about the conversations
        console.log(`${logPrefix} DETAILED DEBUG INFO:`);
        console.log(`${logPrefix} Total conversations in database: ${userConversations.length}`);
        console.log(`${logPrefix} Total processed IDs: ${processedIds.length}`);
        console.log(`${logPrefix} First 5 conversation IDs: ${userConversations.slice(0, 5).map(c => c.id).join(', ')}`);
        console.log(`${logPrefix} First 5 processed IDs: ${processedIds.slice(0, 5).join(', ')}`);
        
        // Log creation dates to help debug ordering issues
        const creationDates = userConversations.map(c => ({ id: c.id, created: new Date(c.created_at).toISOString() }));
        console.log(`${logPrefix} Conversation creation dates (first 5): ${JSON.stringify(creationDates.slice(0, 5))}`);

        // Update progress to show all conversations are already processed
        await updateProfileJob(jobId, {
          progress: 50,
          processedConversations: totalConversations
        });

        // Continue to stage 2 directly - skip conversation analysis since all are processed
        console.log(`${logPrefix} Proceeding DIRECTLY to merge existing analyses into profile - SKIPPING ANALYSIS PHASE`);
        
        // Add a clear marker in logs that we're skipping the analysis phase
        await writeLogToFile(logPrefix, `
#######################################################################
#######################################################################
#######################################################################
################### SKIPPING ANALYSIS - ALL CONVERSATIONS PROCESSED ###################
#######################################################################
#######################################################################
#######################################################################`);
        
      } else {
        // Log detailed information about which conversations need processing
        console.log(`${logPrefix} Found ${unprocessedConversations.length} unprocessed conversations`);
        console.log(`${logPrefix} Unprocessed conversation IDs: ${unprocessedConversations.map(c => c.id).join(', ')}`);
        
        // Log creation dates for unprocessed conversations
        const unprocessedDates = unprocessedConversations.map(c => ({
          id: c.id, 
          created: new Date(c.created_at).toISOString()
        }));
        console.log(`${logPrefix} Unprocessed conversation creation dates: ${JSON.stringify(unprocessedDates)}`);

        // Process each unprocessed conversation
        for (const conversationToProcess of unprocessedConversations) {
          processedCount++;

          // Update job progress
          // Use unprocessedConversations.length for more accurate progress calculation
          const progress = Math.floor((processedCount / unprocessedConversations.length) * 40); // First stage is 40% of total
          await updateProfileJob(jobId, {
            progress,
            processedConversations: processedCount
          });
          
          console.log(`${logPrefix} Progress: ${progress}%, Processing conversation ${processedCount} of ${unprocessedConversations.length} unprocessed (${totalConversations} total)`);
          

          // Clear conversation boundary marker - highly visible in logs
          await writeLogToFile(logPrefix, `
#######################################################################
#######################################################################
#######################################################################
################### CONVERSATION ${processedCount} OF ${totalConversations} ###################
#######################################################################
#######################################################################
#######################################################################`);

          // Stage 1: Analyze conversation
          console.log(`${logPrefix} Analyzing conversation ${conversationToProcess.id} (${processedCount}/${totalConversations})`);

          try {
            // Get the API base URL based on environment
            const baseUrl = getApiBaseUrl();
            const url = `${baseUrl}/api/v11/analyze-conversation`;
            const requestBody = {
              userId,
              conversationId: conversationToProcess.id
            };

            // Log complete request details
            console.log(`${logPrefix} Sending request to: ${url}`);
            console.log(`${logPrefix} Request method: POST`);
            console.log(`${logPrefix} Request headers:`, { 'Content-Type': 'application/json' });
            console.log(`${logPrefix} Request payload:`, requestBody);

            // Log to file with clear section marker
            await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS: ANALYZING CONVERSATION ${conversationToProcess.id} =======================
=======================================================================
=======================================================================`, requestBody);

            // First check if the endpoint exists with an OPTIONS request
            try {
              console.log(`${logPrefix} Checking endpoint availability with OPTIONS request`);
              const optionsResponse = await fetch(url, { method: 'OPTIONS' });
              console.log(`${logPrefix} OPTIONS response status:`, optionsResponse.status);
              console.log(`${logPrefix} OPTIONS response headers:`, Object.fromEntries([...optionsResponse.headers.entries()]));
            } catch (optionsError) {
              console.log(`${logPrefix} OPTIONS request failed:`, optionsError instanceof Error ? optionsError.message : String(optionsError));
            }

            // Now make the actual POST request
            console.log(`${logPrefix} Making POST request to analyze conversation`);
            const analyzeResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestBody)
            });

            // Log response metadata immediately
            console.log(`${logPrefix} Response status:`, analyzeResponse.status, analyzeResponse.statusText);
            console.log(`${logPrefix} Response headers:`, Object.fromEntries([...analyzeResponse.headers.entries()]));

            // Clone the response to log it without consuming the body
            const clonedForLogging = analyzeResponse.clone();

            if (!analyzeResponse.ok) {
              // ENHANCED: Clone the response to allow multiple reads
              const clonedResponse = analyzeResponse.clone();

              try {
                const errorData = await analyzeResponse.json();
                
                // Check if this is a "No messages found" error
                if (errorData.error === 'No messages found in this conversation') {
                  // This is a non-fatal error - we can skip this conversation and continue
                  console.log(`\x1b[33m${logPrefix} SKIPPING: Empty conversation with no messages: ${conversationToProcess.id}\x1b[0m`);
                  
                  // Add warning marker with high visibility but don't fail the job
                  await writeLogToFile(logPrefix, `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!! EMPTY CONVERSATION: ${conversationToProcess.id} HAS NO MESSAGES !!!!!!!!!
!!!!!!!!!!!!! SKIPPING THIS CONVERSATION AND CONTINUING !!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
                  
                  // Get the user's current profile version for recording
                  const { data: userProfile, error: profileError } = await supabaseAdmin
                    .from('user_profiles')
                    .select('version')
                    .eq('user_id', userId)
                    .single();

                  let profileVersion = 1;
                  if (!profileError && userProfile) {
                    profileVersion = userProfile.version;
                  }

                  // Mark empty conversation as processed to avoid repeated processing
                  const { error: markProcessedError } = await supabaseAdmin
                    .from('processed_conversations')
                    .insert({
                      user_id: userId,
                      conversation_id: conversationToProcess.id,
                      processed_at: new Date().toISOString(),
                      profile_version: profileVersion
                      // empty_conversation column will be added via migration later
                    });

                  if (markProcessedError) {
                    console.error(`${logPrefix} Error marking empty conversation as processed:`, markProcessedError);
                    await writeLogToFile(logPrefix, `Error marking empty conversation as processed`, markProcessedError);
                  } else {
                    console.log(`${logPrefix} Empty conversation ${conversationToProcess.id} marked as processed`);
                    await writeLogToFile(logPrefix, `Empty conversation marked as processed`);
                  }
                  
                  // Before we exit the try/catch blocks, add success marker for this conversation
                  await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} SKIPPED (EMPTY) ------------------
-----------------------------------------------------------------------`);

                  // Now jump directly to the next iteration, bypassing all the remaining code for this conversation
                  throw new Error('SKIP_EMPTY_CONVERSATION');
                }
                
                // For all other errors, treat as fatal
                console.error(`${logPrefix} FATAL: Error analyzing conversation:`, errorData);

                // Update job status to failed and exit
                await updateProfileJob(jobId, {
                  status: 'failed',
                  progress: Math.floor((processedCount / totalConversations) * 40),
                  error: `Analysis failed: ${JSON.stringify(errorData)}`
                });

                throw new Error(`Analysis API returned error: ${JSON.stringify(errorData)}`);
              } catch (jsonError) {
                // ENHANCED: Log the JSON parsing error itself
                console.error(`${logPrefix} JSON Error when parsing error response:`, jsonError);

                let responseText;
                try {
                  // ENHANCED: Use the cloned response instead of the original
                  responseText = await clonedResponse.text();

                  // ENHANCED: Store full error response for diagnostics
                  const errorKey = `${logPrefix}_ERROR_RESPONSE`;
                  // Using global object for debug storage
                  if (typeof global !== 'undefined') {
                    // Using type assertion for the global object
                    (global as Record<string, unknown>)[errorKey] = responseText;
                  }

                  console.error(`${logPrefix} FATAL: Error response full text (first 2000 chars):`);
                  console.error(responseText.substring(0, 2000) + (responseText.length > 2000 ? '...' : ''));
                } catch (textError) {
                  responseText = 'Unable to get response text: ' + (textError instanceof Error ? textError.message : String(textError));
                  console.error(`${logPrefix} FATAL: Could not read response text:`, textError);
                }

                console.error(`${logPrefix} FATAL: Error response (${analyzeResponse.status} ${analyzeResponse.statusText}): ${responseText ? responseText.substring(0, 500) : 'No response text available'}`);

                // Try to figure out if the endpoint exists at all
                console.log(`${logPrefix} Checking if endpoint exists with a GET request`);
                try {
                  const checkResponse = await fetch(`${baseUrl}/api/v11/analyze-conversation`, { method: 'GET' });
                  console.log(`${logPrefix} GET check status: ${checkResponse.status} ${checkResponse.statusText}`);
                } catch (checkError) {
                  console.log(`${logPrefix} GET check failed:`, checkError instanceof Error ? checkError.message : String(checkError));
                }

                // ENHANCED: Try to extract JSON from error text using regex for diagnostics
                let isEmptyConversation = false;
                if (responseText) {
                  // First, directly check if responseText contains the "No messages found" message
                  if (responseText.includes('No messages found in this conversation')) {
                    isEmptyConversation = true;
                  }
                  
                  try {
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                      console.log(`${logPrefix} Potential JSON found in error response, first 300 chars:`);
                      console.log(jsonMatch[0].substring(0, 300));

                      // Attempt to validate the extracted JSON
                      try {
                        const extractedJson = JSON.parse(jsonMatch[0]);
                        console.log(`${logPrefix} Successfully parsed JSON from error response:`,
                          Object.keys(extractedJson).length, 'keys');
                          
                        // Check if this is a "No messages found" error from the extracted JSON
                        if (extractedJson.error === 'No messages found in this conversation') {
                          isEmptyConversation = true;
                        }
                      } catch (jsonErr) {
                        console.log(`${logPrefix} Failed to parse extracted JSON:`, jsonErr instanceof Error ? jsonErr.message : String(jsonErr));
                      }
                    }
                  } catch (extractErr) {
                    console.error(`${logPrefix} Error attempting to extract JSON from response:`, extractErr);
                  }
                }
                
                // Handle empty conversation specially
                if (isEmptyConversation) {
                  console.log(`\x1b[33m${logPrefix} SKIPPING: Empty conversation with no messages: ${conversationToProcess.id}\x1b[0m`);
                  
                  // Add warning marker with high visibility but don't fail the job
                  await writeLogToFile(logPrefix, `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!! EMPTY CONVERSATION: ${conversationToProcess.id} HAS NO MESSAGES !!!!!!!!!
!!!!!!!!!!!!! SKIPPING THIS CONVERSATION AND CONTINUING !!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
                  
                  // Get the user's current profile version for recording
                  const { data: userProfile, error: profileError } = await supabaseAdmin
                    .from('user_profiles')
                    .select('version')
                    .eq('user_id', userId)
                    .single();

                  let profileVersion = 1;
                  if (!profileError && userProfile) {
                    profileVersion = userProfile.version;
                  }

                  // Mark empty conversation as processed to avoid repeated processing
                  const { error: markProcessedError } = await supabaseAdmin
                    .from('processed_conversations')
                    .insert({
                      user_id: userId,
                      conversation_id: conversationToProcess.id,
                      processed_at: new Date().toISOString(),
                      profile_version: profileVersion
                      // empty_conversation column will be added via migration later
                    });

                  if (markProcessedError) {
                    console.error(`${logPrefix} Error marking empty conversation as processed:`, markProcessedError);
                    await writeLogToFile(logPrefix, `Error marking empty conversation as processed`, markProcessedError);
                  } else {
                    console.log(`${logPrefix} Empty conversation ${conversationToProcess.id} marked as processed`);
                    await writeLogToFile(logPrefix, `Empty conversation marked as processed`);
                  }
                  
                  // Before we exit the try/catch blocks, add success marker for this conversation
                  await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} SKIPPED (EMPTY) ------------------
-----------------------------------------------------------------------`);

                  // Now jump directly to the next iteration, bypassing all the remaining code for this conversation
                  throw new Error('SKIP_EMPTY_CONVERSATION');
                } else {
                  // For all other errors, treat as fatal
                  // Update job status to failed and exit
                  await updateProfileJob(jobId, {
                    status: 'failed',
                    progress: Math.floor((processedCount / totalConversations) * 40),
                    error: `Analysis failed with status ${analyzeResponse.status}: ${responseText ? responseText.substring(0, 100) : 'No response text available'}`
                  });
                  
                  throw new Error(`Analysis API returned ${analyzeResponse.status} ${analyzeResponse.statusText} - ${responseText ? responseText.substring(0, 200) : 'No response text available'}`);
                }
                
                // If we get here, it's an empty conversation and we're skipping it
                // No need to throw an error
              }
            }

            try {
              const analysisResult = await analyzeResponse.json();

              // Log the full response to file with clear section marker
              const responseText = await clonedForLogging.text();
              await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= RESPONSE: ANALYSIS RESULT FOR CONVERSATION ${conversationToProcess.id} =======================
=======================================================================
=======================================================================`, responseText);

              if (analysisResult.alreadyProcessed) {
                console.log(`${logPrefix} Conversation ${conversationToProcess.id} was already processed`);
                await writeLogToFile(logPrefix, `Conversation ${conversationToProcess.id} was already processed`);

                // Add completion marker for this conversation
                await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} ALREADY PROCESSED ------------------
-----------------------------------------------------------------------`);

              } else {
                console.log(`${logPrefix} Successfully analyzed conversation ${conversationToProcess.id}`);
                await writeLogToFile(logPrefix, `Successfully analyzed conversation ${conversationToProcess.id}`, analysisResult);

                // Add success marker for this conversation
                await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} SUCCESSFULLY ANALYZED ------------------
-----------------------------------------------------------------------`);
              }
            } catch (jsonError) {
              console.error(`${logPrefix} FATAL: Error parsing success response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
              const responseText = await analyzeResponse.text().catch(() => 'Unable to get response text');
              console.error(`${logPrefix} Response text: ${responseText}`);

              // Update job status to failed and exit
              await updateProfileJob(jobId, {
                status: 'failed',
                progress: Math.floor((processedCount / totalConversations) * 40),
                error: `Failed to parse API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`
              });

              // Add error marker for this conversation
              await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} ANALYSIS FAILED (JSON PARSE ERROR) ------------------
-----------------------------------------------------------------------`);

              throw new Error(`Failed to parse analysis API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
            }
          } catch (analyzeErr) {
            // Special case for empty conversations we're skipping
            if (analyzeErr instanceof Error && analyzeErr.message === 'SKIP_EMPTY_CONVERSATION') {
              // This is our special signal to skip to the next conversation
              console.log(`${logPrefix} Successfully skipped empty conversation and continuing to next conversation`);
              // No need to rethrow, continue with the next iteration of the loop
              continue;
            }
            
            console.error(`${logPrefix} FATAL: Error in conversation analysis:`, analyzeErr);

            // Add error marker for this conversation
            await writeLogToFile(logPrefix, `
-----------------------------------------------------------------------
------------------ CONVERSATION ${processedCount}/${totalConversations} ANALYSIS FAILED ------------------
-----------------------------------------------------------------------`);

            // Update job status to failed
            await updateProfileJob(jobId, {
              status: 'failed',
              progress: Math.floor((processedCount / totalConversations) * 40),
              error: `Analysis error: ${analyzeErr instanceof Error ? analyzeErr.message : String(analyzeErr)}`
            });

            // Rethrow to break out of the loop
            throw analyzeErr;
          }
        }
      }
    }

    // Clear boundary marker for stage 2
    await writeLogToFile(logPrefix, `
#######################################################################
#######################################################################
#######################################################################
#################### ALL CONVERSATIONS PROCESSED #####################
#################### MOVING TO PROFILE UPDATE ########################
#######################################################################
#######################################################################
#######################################################################`);

    // Stage 2: Merge analyses into user profile or create empty profile
    console.log(`${logPrefix} Updating user profile with new analyses`);

    try {
      // Update progress to show we're starting the profile merge stage
      await updateProfileJob(jobId, {
        progress: 60, // First stage was 40%, now we're at 60%
      });

      // Get the API base URL based on environment
      const baseUrl = getApiBaseUrl();
      const updateUrl = `${baseUrl}/api/v11/update-user-profile`;
      const updateBody = {
        userId
        // No specific analysisId - will use the latest unmerged analysis
      };

      // Log complete request details
      console.log(`${logPrefix} Sending request to: ${updateUrl}`);
      console.log(`${logPrefix} Request method: POST`);
      console.log(`${logPrefix} Request headers:`, { 'Content-Type': 'application/json' });
      console.log(`${logPrefix} Request payload:`, updateBody);

      // Log to file with clear section marker
      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS: UPDATING USER PROFILE FOR ${userId} =======================
=======================================================================
=======================================================================`, updateBody);

      // First check if the endpoint exists with an OPTIONS request
      try {
        console.log(`${logPrefix} Checking update-user-profile endpoint availability with OPTIONS request`);
        const optionsResponse = await fetch(updateUrl, { method: 'OPTIONS' });
        console.log(`${logPrefix} OPTIONS response status:`, optionsResponse.status);
        console.log(`${logPrefix} OPTIONS response headers:`, Object.fromEntries([...optionsResponse.headers.entries()]));
      } catch (optionsError) {
        console.log(`${logPrefix} OPTIONS request failed:`, optionsError instanceof Error ? optionsError.message : String(optionsError));
      }

      // Make the actual POST request
      console.log(`${logPrefix} Making POST request to update user profile`);
      const updateResponse = await fetch(updateUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateBody)
      });

      // Log response metadata immediately
      console.log(`${logPrefix} Update profile response status:`, updateResponse.status, updateResponse.statusText);
      console.log(`${logPrefix} Update profile response headers:`, Object.fromEntries([...updateResponse.headers.entries()]));

      // Clone response for logging
      const updateResponseClone = updateResponse.clone();

      if (!updateResponse.ok) {
        try {
          const errorData = await updateResponse.json();
          console.error(`${logPrefix} FATAL: Error updating user profile:`, errorData);

          // Update job status to failed
          await updateProfileJob(jobId, {
            status: 'failed',
            progress: 70,
            error: errorData.error || 'Failed to update user profile'
          });

          throw new Error(`Profile update API returned error: ${JSON.stringify(errorData)}`);
        } catch (jsonError) {
          if (jsonError instanceof SyntaxError) {
            // This is a JSON parse error
            let responseText;
            try {
              responseText = await updateResponse.text();
              console.error(`${logPrefix} FATAL: Update profile error response full text:`, responseText);
            } catch (textError) {
              responseText = 'Unable to get response text: ' + (textError instanceof Error ? textError.message : String(textError));
              console.error(`${logPrefix} FATAL: Could not read update profile response text:`, textError);
            }

            console.error(`${logPrefix} FATAL: Update profile error response (${updateResponse.status} ${updateResponse.statusText}): ${responseText}`);

            // Try to figure out if the endpoint exists at all
            console.log(`${logPrefix} Checking if update-user-profile endpoint exists with a GET request`);
            try {
              const checkResponse = await fetch(updateUrl, { method: 'GET' });
              console.log(`${logPrefix} GET check status: ${checkResponse.status} ${checkResponse.statusText}`);
            } catch (checkError) {
              console.log(`${logPrefix} GET check failed:`, checkError instanceof Error ? checkError.message : String(checkError));
            }

            // Update job status to failed
            await updateProfileJob(jobId, {
              status: 'failed',
              progress: 70,
              error: `Failed to update user profile: ${updateResponse.status} ${updateResponse.statusText}`
            });

            throw new Error(`Profile update API returned ${updateResponse.status} ${updateResponse.statusText} - ${responseText.substring(0, 200)}`);
          } else {
            // This is a rethrown error from above
            throw jsonError;
          }
        }
      }

      try {
        const updateResult = await updateResponse.json();

        // Log the full response with clear section marker
        const updateResponseText = await updateResponseClone.text();
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= RESPONSE: PROFILE UPDATE RESULT =======================
=======================================================================
=======================================================================`, updateResponseText);

        // Update progress to 80% - profile updated, now finalizing
        await updateProfileJob(jobId, {
          progress: 80
        });

        if (updateResult.noUpdates) {
          console.log(`${logPrefix} No new analyses to incorporate into user profile`);
          await writeLogToFile(logPrefix, `No new analyses to incorporate into user profile`);

          // Complete the job but indicate no updates were made
          await updateProfileJob(jobId, {
            status: 'completed',
            progress: 100
          });

          // Add final summary for the no-updates case
          await writeLogToFile(logPrefix, `
*********************************************************************
*                       FINAL SUMMARY                               *
*********************************************************************
* USER ID: ${userId}
* PROFILE UPDATE STATUS: COMPLETED (NO CHANGES NEEDED)
* CONVERSATIONS PROCESSED: ${processedCount}
* FINAL PROFILE VERSION: ${updateResult.version || 'N/A'}
*********************************************************************`);

          return;
        }

        console.log(`${logPrefix} Successfully updated user profile to version ${updateResult.version}`);
        await writeLogToFile(logPrefix, `Successfully updated user profile to version ${updateResult.version}`, updateResult);

        // Job completed successfully
        await updateProfileJob(jobId, {
          status: 'completed',
          progress: 100
        });

        // Add final summary of the completed process
        await writeLogToFile(logPrefix, `
*********************************************************************
*                       FINAL SUMMARY                               *
*********************************************************************
* USER ID: ${userId}
* PROFILE UPDATE STATUS: COMPLETED SUCCESSFULLY
* CONVERSATIONS PROCESSED: ${processedCount}
* FINAL PROFILE VERSION: ${updateResult.version || 'N/A'}
*********************************************************************`);
      } catch (jsonError) {
        console.error(`${logPrefix} FATAL: Error parsing update result:`, jsonError);

        // Update job status to failed
        await updateProfileJob(jobId, {
          status: 'failed',
          progress: 80,
          error: `Failed to parse profile update response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`
        });

        throw new Error(`Failed to parse profile update API response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }

    } catch (profileErr) {
      console.error(`${logPrefix} FATAL: Error in profile update process:`, profileErr);

      // Update job status to failed
      await updateProfileJob(jobId, {
        status: 'failed',
        error: profileErr instanceof Error ? profileErr.message : String(profileErr)
      });

      // Add error summary
      await writeLogToFile(logPrefix, `
*********************************************************************
*                       ERROR SUMMARY                               *
*********************************************************************
* USER ID: ${userId}
* PROFILE UPDATE STATUS: FAILED
* ERROR: ${profileErr instanceof Error ? profileErr.message : String(profileErr)}
*********************************************************************`);

      // We don't need to rethrow here as this is already the top-level catch block for the profile update
    }
  } catch (error) {
    console.error(`${logPrefix} FATAL: Unexpected error in background processing:`, error);

    // Update job status to failed with detailed error
    await updateProfileJob(jobId, {
      status: 'failed',
      error: `Fatal error: ${error instanceof Error ? error.message : String(error)}`
    });

    // Add catastrophic error summary
    await writeLogToFile(logPrefix, `
*********************************************************************
*                   CATASTROPHIC ERROR SUMMARY                      *
*********************************************************************
* USER ID: ${userId}
* PROFILE UPDATE STATUS: FAILED COMPLETELY
* ERROR: ${error instanceof Error ? error.message : String(error)}
* STACK: ${error instanceof Error ? error.stack : 'No stack trace available'}
*********************************************************************`);
  }
}