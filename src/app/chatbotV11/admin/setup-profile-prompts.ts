/**
 * Helper functions for setting up profile prompts through the admin interface
 *
 * LOGGING LEVEL: DETAILED
 */

const DETAILED_LOGGING = true;

type ProfilePromptResponse = {
  success: boolean;
  message: string;
  promptId?: string;
};

/**
 * Sets up or updates the profile analysis system prompt for a specific user
 */
export async function setupProfileAnalysisSystemPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<ProfilePromptResponse> {
  return setupPromptForUser(userId, promptContent, 'profile_analysis_system', title, notes, isGlobal);
}

/**
 * Sets up or updates the profile analysis user prompt for a specific user
 */
export async function setupProfileAnalysisUserPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<ProfilePromptResponse> {
  return setupPromptForUser(userId, promptContent, 'profile_analysis_user', title, notes, isGlobal);
}

/**
 * Sets up or updates the profile merge system prompt for a specific user
 */
export async function setupProfileMergeSystemPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<ProfilePromptResponse> {
  return setupPromptForUser(userId, promptContent, 'profile_merge_system', title, notes, isGlobal);
}

/**
 * Sets up or updates the profile merge user prompt for a specific user
 */
export async function setupProfileMergeUserPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<ProfilePromptResponse> {
  return setupPromptForUser(userId, promptContent, 'profile_merge_user', title, notes, isGlobal);
}

/**
 * Generic function to set up any type of prompt for a user
 */
async function setupPromptForUser(
  userId: string,
  promptContent: string,
  category: 'profile_analysis_system' | 'profile_analysis_user' | 'profile_merge_system' | 'profile_merge_user',
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<ProfilePromptResponse> {
  console.log(`[SETUP-PROFILE-PROMPT] Starting setupPromptForUser for category: ${category}`);

  // Enhanced logging for debugging
  if (DETAILED_LOGGING) {
    console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Full setup parameters:`, {
      userId,
      contentLength: promptContent?.length,
      contentPreview: promptContent?.substring(0, 100) + '...',
      category,
      title,
      notes: notes || '(none)',
      isGlobal,
      isGlobalType: typeof isGlobal,
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`[SETUP-PROFILE-PROMPT] Parameters:`, {
      userId,
      contentLength: promptContent?.length,
      category,
      title,
      hasNotes: !!notes,
      isGlobal,
      isGlobalType: typeof isGlobal
    });
  }

  try {
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }

    if (!promptContent) {
      return { success: false, message: 'Prompt content is required' };
    }

    // Always create a new prompt - never reuse existing ones
    // This ensures global and user-specific prompts are completely separate
    console.log(`[SETUP-PROFILE-PROMPT] Creating new prompt with global flag:`, isGlobal);

    // Enhanced create prompt logging
    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Creating new prompt in database for userId=${userId}, category=${category}`);
    }

    // Use friendly names for the UI based on category
    let promptName = '';
    let promptDescription = '';

    if (category === 'profile_analysis_system') {
      promptName = 'User Profile Analysis System Prompt';
      promptDescription = 'System prompt for analyzing conversations to extract user information';
    } else if (category === 'profile_analysis_user') {
      promptName = 'User Profile Analysis User Prompt';
      promptDescription = 'User prompt for analyzing conversations to extract user information';
    } else if (category === 'profile_merge_system') {
      promptName = 'User Profile Merge System Prompt';
      promptDescription = 'System prompt for merging profile information';
    } else {
      promptName = 'User Profile Merge User Prompt';
      promptDescription = 'User prompt for merging profile information';
    }

    const requestBody = {
      name: isGlobal ? `Global ${promptName}` : `${userId} ${promptName}`,
      description: isGlobal 
        ? `${promptDescription} for all users`
        : `${promptDescription} for user ${userId}`,
      category,
      created_by: userId,
      is_active: true,
      is_global: isGlobal === true,
    };

      if (DETAILED_LOGGING) {
        console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Prompt creation request FULL DETAILS:`, {
          requestBody,
          endpoint: '/api/v11/prompts',
          method: 'POST',
          timestamp: new Date().toISOString(),
          category_validation: ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation'].includes(category) ? 'VALID' : 'INVALID'
        });
      } else {
        console.log(`[SETUP-PROFILE-PROMPT] Prompt creation request body:`, JSON.stringify(requestBody));
      }

      const createResponse = await fetch('/api/v11/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Log response status
      if (DETAILED_LOGGING) {
        console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Prompt creation response status: ${createResponse.status} ${createResponse.statusText}`);
      }

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch (e) {
          errorDetails = { rawText: errorText };
          console.log('error: ', e)
        }

        console.error(`[SETUP-PROFILE-PROMPT] Error creating prompt:`, {
          status: createResponse.status,
          statusText: createResponse.statusText,
          errorText
        });

        if (DETAILED_LOGGING) {
          console.error(`[SETUP-PROFILE-PROMPT-DETAILED] Failed to create prompt with ERROR DETAILS:`, {
            status: createResponse.status,
            statusText: createResponse.statusText,
            errorText,
            errorDetails,
            requestBody,
            category,
            timestamp: new Date().toISOString(),
            validationIssue: !['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation'].includes(category) ?
              'INVALID_CATEGORY - Database constraint violation' : 'OTHER_ERROR'
          });
        }

        throw new Error(`Error creating prompt: ${createResponse.statusText} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const promptId = createData.data.id;

    // 3. Create a new version of the prompt
    console.log('[SETUP-PROFILE-PROMPT] Creating prompt version for prompt ID:', promptId);

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Creating version for prompt:`, {
        promptId,
        contentLength: promptContent.length,
        contentPreview: promptContent.substring(0, 50) + '...',
        timestamp: new Date().toISOString(),
        category
      });
    }

    const versionRequestBody = {
      promptId: promptId,
      content: promptContent,
      createdBy: userId,
      notes: notes || `Updated via admin interface on ${new Date().toLocaleString()}`,
      title: title || `Version created on ${new Date().toLocaleString()}`,
    };

    if (DETAILED_LOGGING) {
      console.log('[SETUP-PROFILE-PROMPT-DETAILED] Version creation request FULL DETAILS:', {
        endpoint: '/api/v11/prompt-versions',
        method: 'POST',
        versionRequestBody,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('[SETUP-PROFILE-PROMPT] Prompt version request body:', JSON.stringify(versionRequestBody));
    }

    const versionResponse = await fetch('/api/v11/prompt-versions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(versionRequestBody),
    });

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Version creation response status: ${versionResponse.status} ${versionResponse.statusText}`);
    }

    if (!versionResponse.ok) {
      let errorDetails = '';
      let errorData;

      try {
        errorData = await versionResponse.json();
        errorDetails = errorData.error || errorData.details || '';
      } catch (e) {
        console.error('Error parsing response:', e);
      }

      if (DETAILED_LOGGING) {
        console.error(`[SETUP-PROFILE-PROMPT-DETAILED] Failed to create prompt version with ERROR DETAILS:`, {
          status: versionResponse.status,
          statusText: versionResponse.statusText,
          errorDetails: errorData || errorDetails || 'Could not parse error',
          requestBody: versionRequestBody,
          promptId,
          category,
          timestamp: new Date().toISOString(),
        });
      }

      throw new Error(`Error creating prompt version: ${versionResponse.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    const versionData = await versionResponse.json();

    if (!versionData || !versionData.data || !versionData.data.id) {
      console.error('[SETUP-PROFILE-PROMPT] Invalid version data:', versionData);
      throw new Error('Invalid response from prompt-versions API: No version ID returned');
    }

    const versionId = String(versionData.data.id);
    console.log('[SETUP-PROFILE-PROMPT] Got version ID:', versionId, 'type:', typeof versionId);

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Version creation successful:`, {
        versionId,
        promptId,
        category,
        timestamp: new Date().toISOString(),
        response: versionData
      });
    }

    // 4. Always assign this version to the user (even for global prompts)
    // This ensures the user sees the latest prompt content immediately
    console.log('[SETUP-PROFILE-PROMPT] Assigning prompt version', versionId, 'to user', userId, isGlobal ? '(global prompt)' : '(user-specific prompt)');

    const assignRequestBody = {
      userId: userId,
      promptVersionId: versionId,
      assignedBy: userId,
    };

    if (DETAILED_LOGGING) {
      console.log('[SETUP-PROFILE-PROMPT-DETAILED] Assigning prompt version FULL DETAILS:', {
        userId,
        promptVersionId: versionId,
        assignedBy: userId,
        requestBody: assignRequestBody,
        category,
        isGlobal,
        timestamp: new Date().toISOString(),
        endpoint: '/api/v11/assign-prompt'
      });
    } else {
      console.log('[SETUP-PROFILE-PROMPT] Assign request body type check:', {
        userId: typeof userId,
        promptVersionId: typeof versionId,
        assignedBy: typeof userId,
        bodyStringified: JSON.stringify(assignRequestBody)
      });
    }

    const assignResponse = await fetch('/api/v11/assign-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(assignRequestBody),
    });

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Assign prompt response status: ${assignResponse.status} ${assignResponse.statusText}`);
    }

    if (!assignResponse.ok) {
      let errorDetails = '';
      let errorData = null;

      try {
        errorData = await assignResponse.json();
        errorDetails = errorData.error || errorData.details || '';
      } catch (e) {
        console.error('Error parsing response:', e);
      }

      if (DETAILED_LOGGING) {
        console.error(`[SETUP-PROFILE-PROMPT-DETAILED] Failed to assign prompt version with ERROR DETAILS:`, {
          status: assignResponse.status,
          statusText: assignResponse.statusText,
          errorDetails: errorData || errorDetails || 'Could not parse error',
          requestBody: assignRequestBody,
          versionId,
          promptId,
          category,
          timestamp: new Date().toISOString(),
        });
      }

      throw new Error(`Error assigning prompt: ${assignResponse.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Successfully assigned prompt version:`, {
        userId,
        versionId,
        promptId,
        category,
        isGlobal,
        timestamp: new Date().toISOString()
      });
    }

    // Determine which prompt type was updated for the success message
    let promptType = '';
    if (category === 'profile_analysis_system') {
      promptType = 'Profile Analysis System Prompt';
    } else if (category === 'profile_analysis_user') {
      promptType = 'Profile Analysis User Prompt';
    } else if (category === 'profile_merge_system') {
      promptType = 'Profile Merge System Prompt';
    } else {
      promptType = 'Profile Merge User Prompt';
    }

    const successResponse = {
      success: true,
      message: `Successfully updated ${promptType} for user ${userId}${isGlobal ? ' (set as global)' : ''}`,
      promptId: promptId,
    };

    if (DETAILED_LOGGING) {
      console.log(`[SETUP-PROFILE-PROMPT-DETAILED] Setup completed successfully:`, {
        ...successResponse,
        category,
        versionId,
        userId,
        timestamp: new Date().toISOString(),
        flow: 'COMPLETE'
      });
    }

    return successResponse;
  } catch (error) {
    console.error('Error setting up profile prompt:', error);

    const errorResponse = {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };

    if (DETAILED_LOGGING) {
      console.error(`[SETUP-PROFILE-PROMPT-DETAILED] Setup failed with error:`, {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : String(error),
        category,
        userId,
        timestamp: new Date().toISOString(),
        flow: 'ERROR'
      });
    }

    return errorResponse;
  }
}