// src/app/api/v15/update-user-profile/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { anthropic } from '@/lib/anthropic';
import { getClaudeModel } from '@/config/models';

export const dynamic = 'force-dynamic';

interface UpdateUserProfileRequest {
  userId: string;
  analysisData: Record<string, unknown>;
  analysisId?: string;
  conversationId?: string;
  overrideMergePrompts?: {
    systemPrompt?: string;
    userPrompt?: string;
  };
}

/**
 * V15 User Profile Update Endpoint
 * Updates user profiles by merging conversation analysis data with existing profile
 */
export async function POST(req: Request) {
  try {
    console.log('[memory] Starting V15 user profile update');

    const body = await req.json() as UpdateUserProfileRequest;
    const { userId, analysisData, analysisId, conversationId, overrideMergePrompts } = body;

    console.log(`[memory] Starting profile update for user_id: ${userId}`);

    if (!userId || !analysisData) {
      console.log('[memory] ERROR: Missing required parameters:', { userId: !!userId, analysisData: !!analysisData });
      return NextResponse.json(
        { error: 'userId and analysisData are required' },
        { status: 400 }
      );
    }

    console.log('[memory] Updating profile for user:', userId);
    console.log('[memory] Analysis data keys:', Object.keys(analysisData));

    // Get existing user profile
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('profile_data, version, last_analyzed_timestamp')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[memory] Error fetching existing profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch existing profile', details: profileError },
        { status: 500 }
      );
    }

    const existingProfileData = existingProfile?.profile_data || {};
    const currentVersion = existingProfile?.version || 0;

    console.log(`[memory] Existing profile data: ${JSON.stringify(existingProfileData, null, 2)}`);
    console.log(`[memory] New analysis to merge: ${JSON.stringify(analysisData, null, 2)}`);
    console.log('[memory] Existing profile version:', currentVersion);
    console.log('[memory] Existing profile data keys:', Object.keys(existingProfileData));

    // Get merge prompts - V15: get newest prompt for each category
    let systemPrompt = overrideMergePrompts?.systemPrompt;
    let userPrompt = overrideMergePrompts?.userPrompt;

    if (!systemPrompt || !userPrompt) {
      console.log('[memory] Fetching newest merge prompts from database');

      // Fetch newest prompts for each category
      const promptsByCategory: { [key: string]: string } = {};
      const categories = ['profile_merge_system', 'profile_merge_user'];

      for (const category of categories) {
        console.log(`[memory] Fetching newest prompt for category: ${category}`);

        const response = await supabase
          .from('prompts')
          .select(`
            id,
            category,
            created_at,
            prompt_versions:prompt_versions(
              id,
              content,
              version_number,
              created_at
            )
          `)
          .eq('category', category)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (response.error) {
          console.error(`[memory] Error fetching prompts for ${category}:`, response.error);
          continue;
        }

        console.log(`[memory] Query result for ${category}:`, {
          found: response.data?.length || 0,
          data: response.data?.map(p => ({
            id: p.id,
            created_at: p.created_at,
            versions_count: p.prompt_versions?.length || 0
          }))
        });

        if (response.data && response.data.length > 0) {
          const prompt = response.data[0];
          const versions = prompt.prompt_versions as Array<{
            id: string;
            content: string;
            version_number: string;
            created_at: string;
          }>;

          if (versions && versions.length > 0) {
            // Get the latest version
            const latestVersion = versions.sort((a, b) => {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })[0];

            const content = latestVersion.content;

            promptsByCategory[category] = content;
            console.log(`[memory] Successfully assigned newest prompt for ${category}`);
          }
        } else {
          console.log(`[memory] No prompts found for category: ${category}`);
        }
      }

      systemPrompt = promptsByCategory['profile_merge_system'];
      userPrompt = promptsByCategory['profile_merge_user'];

      // V15: NO FALLBACKS - database prompts are required
      if (!systemPrompt) {
        console.error('[memory] ERROR: No profile_merge_system prompt found in database');
        return NextResponse.json(
          { error: 'Profile merge system prompt not found in database. Please configure prompts in V15 admin.' },
          { status: 500 }
        );
      }

      if (!userPrompt) {
        console.error('[memory] ERROR: No profile_merge_user prompt found in database');
        return NextResponse.json(
          { error: 'Profile merge user prompt not found in database. Please configure prompts in V15 admin.' },
          { status: 500 }
        );
      }
    }

    console.log('[memory] Using profile merge prompts from database');
    console.log(`[memory] Full profile merge system prompt: ${systemPrompt}`);
    console.log(`[memory] Full profile merge user prompt: ${userPrompt}`);
    console.log('[memory] Using merge system prompt length:', systemPrompt.length);
    console.log('[memory] Using merge user prompt length:', userPrompt.length);

    // Prepare full content for Claude
    const fullUserContent = `${userPrompt}

EXISTING USER PROFILE:
${JSON.stringify(existingProfileData, null, 2)}

NEW CONVERSATION ANALYSIS:
${JSON.stringify(analysisData, null, 2)}

Please merge this information intelligently and return the updated profile as JSON.`;

    // Enhanced logging for Claude API debugging
    console.log('[memory] ===== CLAUDE API REQUEST DEBUG =====');
    console.log('[memory] System prompt character count:', systemPrompt.length);
    console.log('[memory] User content character count:', fullUserContent.length);
    console.log('[memory] Existing profile data size (chars):', JSON.stringify(existingProfileData, null, 2).length);
    console.log('[memory] New analysis data size (chars):', JSON.stringify(analysisData, null, 2).length);
    console.log('[memory] COMPLETE EXISTING PROFILE DATA:');
    console.log(JSON.stringify(existingProfileData, null, 2));
    console.log('[memory] COMPLETE NEW ANALYSIS DATA:');
    console.log(JSON.stringify(analysisData, null, 2));
    console.log('[memory] COMPLETE SYSTEM PROMPT:');
    console.log(systemPrompt);
    console.log('[memory] COMPLETE USER CONTENT SENT TO CLAUDE:');
    console.log(fullUserContent);
    console.log('[memory] ===== END CLAUDE REQUEST DEBUG =====');

    // Call Claude Sonnet for intelligent profile merging
    let anthropicResponse;
    try {
      anthropicResponse = await anthropic.messages.create({
        model: getClaudeModel(),
        max_tokens: 16000,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: fullUserContent
          }
        ],
      });
    } catch (anthropicError) {
      console.error('[memory] Anthropic API error:', anthropicError);
      return NextResponse.json(
        { error: 'Failed to merge profile with AI', details: anthropicError instanceof Error ? anthropicError.message : String(anthropicError) },
        { status: 500 }
      );
    }

    const mergedContent = anthropicResponse.content[0]?.type === 'text' ? anthropicResponse.content[0].text : undefined;

    // Enhanced logging for Claude API response debugging
    console.log('[memory] ===== CLAUDE API RESPONSE DEBUG =====');
    console.log('[memory] Response object structure:', JSON.stringify(anthropicResponse, null, 2));
    console.log('[memory] Response content array length:', anthropicResponse.content?.length || 0);
    console.log('[memory] First content type:', anthropicResponse.content?.[0]?.type || 'none');
    console.log('[memory] Merged content character count:', mergedContent?.length || 0);
    console.log('[memory] COMPLETE CLAUDE RESPONSE:');
    console.log(mergedContent || 'NO CONTENT RECEIVED');
    console.log('[memory] ===== END CLAUDE RESPONSE DEBUG =====');

    if (!mergedContent) {
      console.error('[memory] ERROR: No merged content received from Anthropic');
      return NextResponse.json(
        { error: 'No merged content received from AI' },
        { status: 500 }
      );
    }

    console.log('[memory] Received merged profile content length:', mergedContent.length);

    // Parse JSON from AI response (handle markdown code blocks)
    let mergedProfileData;
    try {
      // Clean markdown formatting that Claude AI commonly adds
      const cleanedContent = mergedContent
        .replace(/```json\s*/g, '')  // Remove opening ```json
        .replace(/```\s*$/g, '')     // Remove closing ```
        .trim();

      console.log('[memory] Cleaned content for parsing (first 200 chars):', cleanedContent.substring(0, 200));
      mergedProfileData = JSON.parse(cleanedContent);
      console.log(`[memory] Updated comprehensive profile: ${JSON.stringify(mergedProfileData, null, 2)}`);
    } catch (parseError) {
      console.error('[memory] ERROR: Failed to parse AI merged profile JSON:', parseError);
      console.log('[memory] Raw AI response:', mergedContent);
      return NextResponse.json(
        { error: 'Failed to parse AI merged profile response', details: mergedContent },
        { status: 500 }
      );
    }

    // Generate AI instructions summary
    console.log('[memory] Generating AI instructions summary...');

    // Fetch AI summary prompt from database - V15: NO FALLBACKS
    console.log('[memory] Fetching newest ai_summary_prompt from database');

    const summaryPromptResponse = await supabase
      .from('prompts')
      .select(`
        id,
        category,
        created_at,
        prompt_versions:prompt_versions(
          id,
          content,
          version_number,
          created_at
        )
      `)
      .eq('category', 'ai_summary_prompt')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (summaryPromptResponse.error) {
      console.error('[memory] ERROR: Database error fetching ai_summary_prompt:', summaryPromptResponse.error);
      return NextResponse.json(
        { error: 'Failed to fetch AI summary prompt from database', details: summaryPromptResponse.error },
        { status: 500 }
      );
    }

    if (!summaryPromptResponse.data || summaryPromptResponse.data.length === 0) {
      console.error('[memory] ERROR: No ai_summary_prompt found in database');
      return NextResponse.json(
        { error: 'AI summary prompt not found in database. Please configure prompts in V15 admin.' },
        { status: 500 }
      );
    }

    const summaryPrompt = summaryPromptResponse.data[0];
    const summaryVersions = summaryPrompt.prompt_versions as Array<{
      id: string;
      content: string;
      version_number: string;
      created_at: string;
    }>;

    if (!summaryVersions || summaryVersions.length === 0) {
      console.error('[memory] ERROR: No versions found for ai_summary_prompt');
      return NextResponse.json(
        { error: 'No versions found for AI summary prompt in database. Please configure prompts in V15 admin.' },
        { status: 500 }
      );
    }

    const latestSummaryVersion = summaryVersions.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];

    const aiSummaryPrompt = latestSummaryVersion.content;
    console.log('[memory] Using ai_summary_prompt from database');

    console.log(`[memory] Using AI summary generation prompt: ${aiSummaryPrompt}`);

    // Prepare the complete AI summary content
    const summaryUserContent = `${aiSummaryPrompt}

COMPREHENSIVE USER PROFILE:
${JSON.stringify(mergedProfileData, null, 2)}`;

    // Log the complete AI summary payload
    const summaryPayload = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.1,
      messages: [
        {
          role: 'user' as const,
          content: summaryUserContent
        }
      ]
    };

    console.log('[memory] ===== COMPLETE AI SUMMARY API PAYLOAD =====');
    console.log(`[memory] Claude AI summary payload: ${JSON.stringify(summaryPayload, null, 2)}`);
    console.log('[memory] ===== END AI SUMMARY API PAYLOAD =====');

    let aiInstructionsSummary = '';

    try {
      const summaryResponse = await anthropic.messages.create(summaryPayload);

      const summaryContent = summaryResponse.content[0]?.type === 'text' ? summaryResponse.content[0].text : undefined;

      console.log(`[memory] Claude AI summary response: ${summaryContent}`);

      if (summaryContent) {
        aiInstructionsSummary = summaryContent.trim();
        console.log(`[memory] Generated AI instructions summary: ${aiInstructionsSummary}`);
      } else {
        console.warn('[memory] No AI summary content received, using empty summary');
      }
    } catch (summaryError) {
      console.error('[memory] ERROR generating AI summary:', summaryError);
      console.warn('[memory] Proceeding without AI summary');
    }

    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();

    // Update existing user profile (with proper conflict resolution)
    const { data: updatedProfile, error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        profile_data: mergedProfileData,
        ai_instructions_summary: aiInstructionsSummary,
        version: newVersion,
        last_analyzed_timestamp: now,
        updated_at: now,
      }, {
        onConflict: 'user_id'
      })
      .select('id, version')
      .single();

    if (upsertError) {
      console.error('[memory] ERROR: Error upserting user profile:', upsertError);
      return NextResponse.json(
        { error: 'Failed to update user profile', details: upsertError },
        { status: 500 }
      );
    }

    // CRITICAL: Only NOW store the conversation analysis after successful profile update
    let finalAnalysisId = analysisId;

    if (conversationId) {
      console.log(`[memory] Storing conversation analysis for conversation: ${conversationId}`);

      const { data: storedAnalysis, error: storeError } = await supabase
        .from('conversation_analyses')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          analysis_result: analysisData,
        })
        .select('id')
        .single();

      if (storeError) {
        console.error('[memory] ERROR: Failed to store conversation analysis after successful profile update:', storeError);
        // This is a critical error - profile updated but conversation not marked as processed
        // Return error so the conversation can be retried
        return NextResponse.json(
          { error: 'Profile updated but failed to mark conversation as processed', details: storeError },
          { status: 500 }
        );
      }

      finalAnalysisId = storedAnalysis.id;
      console.log(`[memory] Conversation analysis stored with id: ${finalAnalysisId}`);
    }

    console.log(`[memory] Profile update completed and stored with AI summary`);
    console.log('[memory] Successfully updated user profile:', {
      userId,
      profileId: updatedProfile.id,
      newVersion: updatedProfile.version,
      analysisId: finalAnalysisId,
      aiSummaryLength: aiInstructionsSummary.length
    });

    return NextResponse.json({
      success: true,
      profileId: updatedProfile.id,
      profileVersion: updatedProfile.version,
      mergedDataKeys: Object.keys(mergedProfileData),
      analysisId: finalAnalysisId,
    });

  } catch (error) {
    console.error('[memory] ERROR in update-user-profile:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: 'Internal server error during profile update',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

