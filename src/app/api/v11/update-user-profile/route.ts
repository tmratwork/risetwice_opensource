/**
 * API endpoint for updating user profiles with newly analyzed conversation data
 * Stage 2 of the user profile building process - merges new insights with existing profile
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { anthropic } from '@/lib/anthropic';
import fs from 'fs';
import path from 'path';
import { getClaudeModel } from '@/config/models';

// Interface for profile prompt response
// interface ProfilePromptsResponse {
//   analysisSystemPrompt?: string;
//   analysisSystemSource?: 'user' | 'global' | 'default';
//   analysisUserPrompt?: string;
//   analysisUserSource?: 'user' | 'global' | 'default';
//   mergeSystemPrompt?: string;
//   mergeSystemSource?: 'user' | 'global' | 'default';
//   mergeUserPrompt?: string;
//   mergeUserSource?: 'user' | 'global' | 'default';
// }

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

// Default merge system prompt template as fallback
const defaultMergeSystemPrompt = "You are an expert in building and maintaining user profiles from conversation analysis. Carefully merge information, preserving important details while updating with new insights. Your response MUST be ONLY valid JSON with absolutely no additional text, explanations, or conversation. Format your entire response as a single JSON object and nothing else.";

// Default merge user prompt template as fallback
const defaultMergeUserPrompt = `Update this user profile with newly extracted information from their recent conversation:

Current User Profile:
{current_profile_json}

Newly Extracted Information:
{extracted_information_json}

When updating:
1. Prioritize new factual information over old
2. **CONSOLIDATE similar entries by merging insights rather than creating duplicates**
3. **REPLACE lower-confidence entries with higher-confidence updates**
4. **ENHANCE existing entries with new details instead of adding separate entries**
5. **MAINTAIN maximum limits per category (e.g., 8 entries max per section)**
6. Track confidence levels for all information
7. Note any contradictions between new and existing information

**CRITICAL CONSOLIDATION RULES:**
- If new insight relates to existing entry, MERGE don't duplicate
- If new entry has higher confidence, REPLACE the lower confidence version  
- Keep profile sections under reasonable size limits
- Prioritize recency and importance when deciding what to keep

CRITICAL: Return ONLY the complete valid JSON object, with no additional explanation or text.
`;

// Function to fetch both merge system and user prompts
async function getMergePrompts(userId: string): Promise<{
  systemPrompt: string;
  userPrompt: string;
  systemSource: 'user' | 'global' | 'default';
  userSource: 'user' | 'global' | 'default';
}> {
  try {
    console.log(`Fetching merge prompts for user ${userId}`);

    // First check for user-specific system prompt for 'profile_merge_system'
    const userSystemQuery = supabaseAdmin
      .from('prompts')
      .select(`
        id,
        prompt_versions:prompt_versions(
          id,
          content,
          version_number,
          created_at
        )
      `)
      .eq('category', 'profile_merge_system')
      .eq('created_by', userId)
      .eq('is_active', true);

    // Then check for user-specific user prompt for 'profile_merge_user'
    const userUserQuery = supabaseAdmin
      .from('prompts')
      .select(`
        id,
        prompt_versions:prompt_versions(
          id,
          content,
          version_number,
          created_at
        )
      `)
      .eq('category', 'profile_merge_user')
      .eq('created_by', userId)
      .eq('is_active', true);

    // Run these queries in parallel
    const [userSystemResult, userUserResult] = await Promise.all([
      userSystemQuery,
      userUserQuery
    ]);

    // Initialize with default values
    let systemPrompt = defaultMergeSystemPrompt;
    let userPrompt = defaultMergeUserPrompt;
    let systemSource: 'user' | 'global' | 'default' = 'default';
    let userSource: 'user' | 'global' | 'default' = 'default';

    // Process user-specific system prompt if available
    if (!userSystemResult.error && userSystemResult.data && userSystemResult.data.length > 0) {
      const versions = userSystemResult.data[0].prompt_versions as Array<{
        id: string;
        content: string;
        version_number: string;
      }>;

      if (versions && versions.length > 0) {
        // Find the latest version
        const latestVersion = versions.sort((a, b) => {
          return parseInt(b.version_number) - parseInt(a.version_number);
        })[0];

        systemPrompt = latestVersion.content;
        systemSource = 'user';
      }
    }

    // Process user-specific user prompt if available
    if (!userUserResult.error && userUserResult.data && userUserResult.data.length > 0) {
      const versions = userUserResult.data[0].prompt_versions as Array<{
        id: string;
        content: string;
        version_number: string;
      }>;

      if (versions && versions.length > 0) {
        // Find the latest version
        const latestVersion = versions.sort((a, b) => {
          return parseInt(b.version_number) - parseInt(a.version_number);
        })[0];

        userPrompt = latestVersion.content;
        userSource = 'user';
      }
    }

    // If we don't have user-specific prompts, check for global prompts
    if (systemSource === 'default') {
      const globalSystemQuery = await supabaseAdmin
        .from('prompts')
        .select(`
          id,
          prompt_versions:prompt_versions(
            id,
            content,
            version_number,
            created_at
          )
        `)
        .eq('category', 'profile_merge_system')
        .eq('is_global', true)
        .eq('is_active', true);

      if (!globalSystemQuery.error && globalSystemQuery.data && globalSystemQuery.data.length > 0) {
        const versions = globalSystemQuery.data[0].prompt_versions as Array<{
          id: string;
          content: string;
          version_number: string;
        }>;

        if (versions && versions.length > 0) {
          // Find the latest version
          const latestVersion = versions.sort((a, b) => {
            return parseInt(b.version_number) - parseInt(a.version_number);
          })[0];

          systemPrompt = latestVersion.content;
          systemSource = 'global';
        }
      }
    }

    // If we don't have user-specific user prompt, check for global
    if (userSource === 'default') {
      const globalUserQuery = await supabaseAdmin
        .from('prompts')
        .select(`
          id,
          prompt_versions:prompt_versions(
            id,
            content,
            version_number,
            created_at
          )
        `)
        .eq('category', 'profile_merge_user')
        .eq('is_global', true)
        .eq('is_active', true);

      if (!globalUserQuery.error && globalUserQuery.data && globalUserQuery.data.length > 0) {
        const versions = globalUserQuery.data[0].prompt_versions as Array<{
          id: string;
          content: string;
          version_number: string;
        }>;

        if (versions && versions.length > 0) {
          // Find the latest version
          const latestVersion = versions.sort((a, b) => {
            return parseInt(b.version_number) - parseInt(a.version_number);
          })[0];

          userPrompt = latestVersion.content;
          userSource = 'global';
        }
      }
    }

    console.log(`Using ${systemSource} merge system prompt and ${userSource} merge user prompt`);

    return {
      systemPrompt,
      userPrompt,
      systemSource,
      userSource
    };
  } catch (error) {
    console.error('Error fetching merge prompts:', error);
    return {
      systemPrompt: defaultMergeSystemPrompt,
      userPrompt: defaultMergeUserPrompt,
      systemSource: 'default',
      userSource: 'default'
    };
  }
}

export async function POST(req: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[UPDATE-PROFILE-${requestId}]`;

  // Start logging to file with clear section markers
  await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS START: PROFILE UPDATE =======================
=======================================================================
=======================================================================`);
  await writeLogToFile(logPrefix, "Profile update process started");

  try {
    // Parse request body
    const requestData = await req.json();
    const { userId, analysisId } = requestData;

    if (!userId) {
      await writeLogToFile(logPrefix, "Missing userId in request", requestData);
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Starting profile update for user ${userId}`);
    await writeLogToFile(logPrefix, `Starting profile update`, { userId, analysisId });

    // Interface for analysis result structure
    interface AnalysisResult {
      [category: string]: Array<Record<string, string | number | boolean | object | null>>;
    }

    // If an analysis ID was provided, use that specific analysis
    // Otherwise, fetch the most recent unprocessed analysis
    let analysisResult: AnalysisResult = {};

    if (analysisId) {
      try {
        // Fetch the specific analysis
        const { data, error } = await supabaseAdmin
          .from('conversation_analyses')
          .select('analysis_result, conversation_id')
          .eq('id', analysisId)
          .eq('user_id', userId)
          .single();

        if (error) {
          console.error(`${logPrefix} Error fetching analysis:`, error);
          return NextResponse.json({
            error: 'Failed to fetch specified analysis',
            details: error.message
          }, { status: 500 });
        } else if (data) {
          analysisResult = data.analysis_result;
          console.log(`${logPrefix} Using specified analysis ${analysisId} for conversation ${data.conversation_id}`);
        }
      } catch (err) {
        console.error(`${logPrefix} Exception fetching analysis:`, err);
        return NextResponse.json({
          error: 'Exception when fetching analysis',
          details: err instanceof Error ? err.message : String(err)
        }, { status: 500 });
      }
    } else {
      // Find analyses that haven't been incorporated into the user profile yet

      try {
        // First, get the list of processed conversations for this profile version
        const { data: userProfile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('version, last_analyzed_timestamp')
          .eq('user_id', userId)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error(`${logPrefix} Error fetching user profile:`, profileError);
          return NextResponse.json({
            error: 'Failed to fetch user profile',
            details: profileError.message
          }, { status: 500 });
        }

        // If no profile exists yet, create one
        if (profileError && profileError.code === 'PGRST116') {
          console.log(`${logPrefix} No existing profile found - will create new profile`);
        }

        // Get the current profile version or use 1 if it doesn't exist
        // Version is used in profile updates throughout this file
        const lastAnalyzed = userProfile?.last_analyzed_timestamp;

        try {
          // Try to find new analyses since the last profile update
          const result = await supabaseAdmin
            .from('conversation_analyses')
            .select('id, analysis_result, conversation_id, analyzed_at')
            .eq('user_id', userId)
            .gt('analyzed_at', lastAnalyzed || '1970-01-01')
            .order('analyzed_at', { ascending: true })
            .limit(1);

          if (result.error) {
            console.error(`${logPrefix} Error fetching new analyses:`, result.error);
            return NextResponse.json({
              error: 'Failed to fetch new analyses',
              details: result.error.message
            }, { status: 500 });
          } else if (result.data && result.data.length > 0) {
            // Use the first new analysis found
            analysisResult = result.data[0].analysis_result;
            console.log(`${logPrefix} Using newest analysis ${result.data[0].id} for conversation ${result.data[0].conversation_id}`);
          } else {
            console.log(`${logPrefix} No new analyses found`);
          }
        } catch (analysesErr) {
          console.error(`${logPrefix} Exception when fetching analyses:`, analysesErr);
          return NextResponse.json({
            error: 'Exception when fetching analyses',
            details: analysesErr instanceof Error ? analysesErr.message : String(analysesErr)
          }, { status: 500 });
        }
      } catch (err) {
        console.error(`${logPrefix} Error in analysis lookup:`, err);
        return NextResponse.json({
          error: 'Error in analysis lookup',
          details: err instanceof Error ? err.message : String(err)
        }, { status: 500 });
      }
    }

    // Profile data structure that matches the database schema
    interface ProfileData {
      [category: string]: Array<Record<string, string | number | boolean | object | null>>;
    }

    let mergedProfile: ProfileData;

    try {
      // Get the current user profile
      const { data: currentProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('profile_data, version')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(`${logPrefix} Error fetching current profile:`, profileError);
        return NextResponse.json({
          error: 'Failed to fetch current profile',
          details: profileError.message
        }, { status: 500 });
      }

      // If no profile exists or it's empty, create a new one with just the analysis results
      if (profileError && profileError.code === 'PGRST116') {
        console.log(`${logPrefix} No existing profile - creating new with initial data`);

        // For very first profile, just use the analysis results directly
        mergedProfile = analysisResult;

        // Insert a new profile with the analysis results
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('user_profiles')
          .insert({
            user_id: userId,
            profile_data: mergedProfile,
            version: 1,
            last_analyzed_timestamp: new Date().toISOString()
          })
          .select('id, version')
          .single();

        if (insertError) {
          console.error(`${logPrefix} Error creating new profile:`, insertError);
          return NextResponse.json({
            error: 'Failed to create new profile',
            details: insertError.message
          }, { status: 500 });
        }

        console.log(`${logPrefix} Created new profile for user ${userId} with initial data`);

        // Add completion marker for new profile creation
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS COMPLETE: NEW PROFILE CREATED =======================
=======================================================================
=======================================================================`);

        return NextResponse.json({
          success: true,
          profileId: newProfile.id,
          version: newProfile.version,
          message: 'Created new profile with initial data'
        });
      }

      // For an existing profile, check if we need to merge with new analysis
      console.log(`${logPrefix} Merging new analysis with existing profile (version ${currentProfile?.version || 0})`);

      // Check if the analysis result has actual content
      let hasActualContent = false;
      const contentDetails = [];

      if (analysisResult) {
        // Look through all categories (personal_details, health_information, etc.)
        for (const category in analysisResult) {
          // Log the structure of each category
          console.log(`${logPrefix} Category ${category} structure:`,
            typeof analysisResult[category] === 'object' && analysisResult[category] !== null ?
              `type=${typeof analysisResult[category]}, isArray=${Array.isArray(analysisResult[category])}, keys=${Object.keys(analysisResult[category]).length}` :
              `type=${typeof analysisResult[category]}${analysisResult[category] === null ? ' (null)' : ''}`);

          // Log detailed category structure to file
          await writeLogToFile(logPrefix, `Category structure: ${category}`, analysisResult[category]);

          // If it's an object but not an array and not null, check if it has any non-empty properties
          if (typeof analysisResult[category] === 'object' && analysisResult[category] !== null && !Array.isArray(analysisResult[category])) {
            const objCategory = analysisResult[category] as Record<string, unknown>;
            let hasNonEmptyProps = false;

            for (const subcategory in objCategory) {
              const value = objCategory[subcategory];
              const isEmpty = Array.isArray(value) ? value.length === 0 :
                (typeof value === 'object' && value !== null) ? Object.keys(value).length === 0 :
                  (value === null || value === undefined);

              console.log(`${logPrefix}   - Subcategory ${subcategory}: type=${typeof value}, isEmpty=${isEmpty}`);

              if (!isEmpty) {
                hasNonEmptyProps = true;
                contentDetails.push(`${category}.${subcategory} has content`);
                break;
              }
            }

            if (hasNonEmptyProps) {
              hasActualContent = true;
            }
          } else if (Array.isArray(analysisResult[category]) && analysisResult[category].length > 0) {
            hasActualContent = true;
            contentDetails.push(`${category} has ${analysisResult[category].length} items`);
          }
        }
      }

      // If we have an existing profile but no new content, just return the current profile
      if (!hasActualContent) {
        console.log(`${logPrefix} No new analysis data - keeping existing profile unchanged`);
        console.log(`${logPrefix} Analysis content details: ${contentDetails.join(', ') || 'All categories empty'}`);

        // Still update the timestamp to avoid reprocessing
        const { data: updatedProfile, error: updateError } = await supabaseAdmin
          .from('user_profiles')
          .update({
            version: ((currentProfile?.version || 1) + 1),
            last_analyzed_timestamp: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select('id, version')
          .single();

        if (updateError) {
          console.error(`${logPrefix} Error updating profile timestamp:`, updateError);
          return NextResponse.json({
            error: 'Failed to update profile timestamp',
            details: updateError.message
          }, { status: 500 });
        }

        // Add completion marker for no-updates case
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS COMPLETE: NO NEW DATA TO MERGE =======================
=======================================================================
=======================================================================`);

        return NextResponse.json({
          success: true,
          profileId: updatedProfile.id,
          version: updatedProfile.version,
          noUpdates: true,
          message: 'Profile timestamp updated, no new data'
        });
      }

      // If we have actual content, use Claude to merge
      console.log(`${logPrefix} Analysis contains actual content - performing merge with Claude`);

      // Get the appropriate merge prompts (system and user prompts - user-specific, global, or default)
      const { systemPrompt, userPrompt, systemSource, userSource } = await getMergePrompts(userId);

      // Prepare the user prompt by replacing placeholders with the actual data
      const formattedUserPrompt = userPrompt
        .replace('{current_profile_json}', JSON.stringify(currentProfile?.profile_data || {}, null, 2))
        .replace('{extracted_information_json}', JSON.stringify(analysisResult, null, 2));

      // Log which prompt sources we're using
      console.log(`${logPrefix} Using ${systemSource} system prompt and ${userSource} user prompt for merge`);

      // Log current profile and analysis result to file with clear section markers
      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= MERGE INPUT: CURRENT PROFILE DATA =======================
=======================================================================
=======================================================================`, currentProfile?.profile_data || {});

      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= MERGE INPUT: NEW ANALYSIS RESULT =======================
=======================================================================
=======================================================================`, analysisResult);

      try {
        // Log the system prompt preview for console
        const systemPromptPreview = systemPrompt.substring(0, 50);
        console.log(`${logPrefix} SYSTEM PROMPT PREVIEW: "${systemPromptPreview}..."`);

        // Log full system prompt to file for better debugging
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE INPUT: SYSTEM PROMPT TEMPLATE =======================
=======================================================================
=======================================================================`, systemPrompt);

        // Log the user prompt preview for console
        const promptLength = formattedUserPrompt.length;
        const promptStart = formattedUserPrompt.substring(0, 50);
        const promptEnd = formattedUserPrompt.substring(Math.max(0, promptLength - 50));
        console.log(`${logPrefix} USER PROMPT (${promptLength} chars): ${promptStart}...${promptEnd}`);

        // Log template sizes for console
        const systemTemplateLength = systemPrompt.length;
        const userTemplateLength = userPrompt.length;
        console.log(`${logPrefix} SYSTEM TEMPLATE LENGTH: ${systemTemplateLength} chars, USER TEMPLATE LENGTH: ${userTemplateLength} chars`);

        // Log user prompt template to file with clear section markers
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE INPUT: USER PROMPT TEMPLATE =======================
=======================================================================
=======================================================================`, userPrompt);

        // Log formatted user prompt to file with clear section markers
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE INPUT: FORMATTED USER PROMPT SENT TO API =======================
=======================================================================
=======================================================================`, formattedUserPrompt);

        // Log the full Claude API configuration
        const claudeConfig = {
          model: getClaudeModel(),
          max_tokens: 16000,
          temperature: 0.2,
          system: systemPrompt,
          system_prompt_source: systemSource,
          user_prompt_source: userSource,
          system_prompt_length: systemPrompt.length,
          user_prompt_length: formattedUserPrompt.length
        };

        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE INPUT: API CONFIGURATION =======================
=======================================================================
=======================================================================`, claudeConfig);

        // Call Claude to merge the profiles
        const mergeResponse = await anthropic.messages.create({
          model: getClaudeModel(),
          max_tokens: 4000,
          temperature: 0.2,
          system: systemPrompt,
          messages: [
            { role: "user", content: formattedUserPrompt }
          ]
        });

        if (!mergeResponse) {
          throw new Error('Failed to get merged profile from Claude');
        }

        // Extract the merged profile JSON from the response
        const content = mergeResponse.content[0];

        // Check if the content is a text block
        let mergeText: string;
        if ('text' in content) {
          mergeText = content.text;
          console.log(`${logPrefix} Claude's complete merge response (first 500 chars):`);
          console.log(mergeText.substring(0, 500) + (mergeText.length > 500 ? '...' : ''));

          // Log the complete merge response to file with clear section marker
          await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE OUTPUT: COMPLETE RAW RESPONSE =======================
=======================================================================
=======================================================================`, mergeText);
        } else {
          console.error(`${logPrefix} Unexpected response format: content is not a text block`);
          return NextResponse.json({
            error: 'Unexpected response format from Claude',
            details: 'Response did not contain expected text content'
          }, { status: 500 });
        }

        // Find JSON in the response
        const jsonObjectMatch = mergeText.match(/\{[\s\S]*\}/);

        if (!jsonObjectMatch) {
          console.error(`${logPrefix} FATAL: Failed to extract JSON from Claude's merge response`);
          return NextResponse.json({
            error: 'Failed to parse merged profile - No JSON found in response',
            rawResponse: mergeText.substring(0, 1000) + '...' // First 1000 chars for debugging
          }, { status: 500 });
        }

        const jsonText = jsonObjectMatch[0];
        console.log(`${logPrefix} Extracted JSON (first 200 chars): ${jsonText.substring(0, 200)}...`);

        // Log full extracted JSON to file with clear section marker
        await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= CLAUDE OUTPUT: EXTRACTED JSON =======================
=======================================================================
=======================================================================`, jsonText);

        try {
          mergedProfile = JSON.parse(jsonText);
          console.log(`${logPrefix} Successfully parsed merged profile with ${Object.keys(mergedProfile).length} categories`);
        } catch (error) {
          // Type the error properly
          const parseError = error as Error;
          console.error(`${logPrefix} FATAL: JSON parsing error:`, parseError);

          // Log detailed diagnostics about the JSON text for debugging
          const errorPosition = (parseError instanceof SyntaxError)
            ? parseError.message.match(/position (\d+)/)?.[1]
            : null;

          if (errorPosition) {
            const pos = parseInt(errorPosition);
            const errorContext = jsonText.substring(
              Math.max(0, pos - 100),
              Math.min(jsonText.length, pos + 100)
            );

            console.error(`${logPrefix} JSON Error Context (100 chars before/after position ${pos}):`);
            console.error(`${logPrefix} ${errorContext}`);
            console.error(`${logPrefix} Error position marker: ${' '.repeat(Math.min(100, pos))}↓HERE↓`);
          }

          return NextResponse.json({
            error: `JSON parsing error: ${parseError.message}`,
            errorDetails: parseError.stack,
            jsonPreview: jsonText.substring(0, 1000) + '...' // First 1000 chars for debugging
          }, { status: 500 });
        }
      } catch (claudeErr) {
        console.error(`${logPrefix} FATAL: Error calling Claude for merging:`, claudeErr);
        return NextResponse.json({
          error: 'Error calling Claude for merging',
          details: claudeErr instanceof Error ? claudeErr.message : String(claudeErr)
        }, { status: 500 });
      }

      // Update the user profile with the merged data
      const newVersion = ((currentProfile?.version || 1) + 1);

      // Log the final merged profile that will be stored with clear section marker
      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= RESULT: FINAL MERGED PROFILE (v${newVersion}) =======================
=======================================================================
=======================================================================`, mergedProfile);

      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          profile_data: mergedProfile,
          version: newVersion,
          last_analyzed_timestamp: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select('id, version')
        .single();

      if (updateError) {
        console.error(`${logPrefix} Error updating profile:`, updateError);
        return NextResponse.json({
          error: 'Failed to update profile with merged data',
          details: updateError.message
        }, { status: 500 });
      }

      console.log(`${logPrefix} Successfully updated profile for user ${userId} to version ${newVersion}`);
      await writeLogToFile(logPrefix, `Successfully updated profile for user ${userId} to version ${newVersion}`, {
        profileId: updatedProfile.id,
        version: updatedProfile.version
      });

      // Add completion marker
      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS COMPLETE: PROFILE UPDATED SUCCESSFULLY =======================
=======================================================================
=======================================================================`);

      return NextResponse.json({
        success: true,
        profileId: updatedProfile.id,
        version: updatedProfile.version,
        noUpdates: false,
        message: 'Profile updated with new data'
      });
    } catch (profileErr) {
      console.error(`${logPrefix} Error in profile update process:`, profileErr);

      // Add error marker
      await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS ERROR: PROFILE UPDATE FAILED =======================
=======================================================================
=======================================================================`);
      await writeLogToFile(logPrefix, `Error in profile update process`, {
        error: profileErr instanceof Error ? profileErr.message : String(profileErr),
        stack: profileErr instanceof Error ? profileErr.stack : undefined
      });

      return NextResponse.json({
        error: 'Failed to update or create profile',
        details: profileErr instanceof Error ? profileErr.message : String(profileErr)
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);

    // Add error marker for unexpected errors
    await writeLogToFile(logPrefix, `
=======================================================================
=======================================================================
======================= PROCESS ERROR: UNEXPECTED FAILURE =======================
=======================================================================
=======================================================================`);
    await writeLogToFile(logPrefix, `Unexpected error in profile update`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}