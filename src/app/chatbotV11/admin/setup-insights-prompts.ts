/**
 * Helper functions for setting up insight prompts through the admin interface
 */

type r = {
  success: boolean;
  message: string;
};

/**
 * Sets up or updates a system prompt for insights generation for a specific user
 */
export async function setupInsightsSystemPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<r> {
  return setupPromptForUser(userId, promptContent, 'insights_system', title, notes, isGlobal);
}

/**
 * Sets up or updates a user prompt for insights generation for a specific user
 */
export async function setupInsightsUserPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<r> {
  return setupPromptForUser(userId, promptContent, 'insights_user', title, notes, isGlobal);
}

/**
 * Generic function to set up any type of prompt for a user
 */
async function setupPromptForUser(
  userId: string,
  promptContent: string,
  category: 'greeting' | 'ai_instructions' | 'insights_system' | 'insights_user',
  title?: string,
  notes?: string,
  isGlobal?: boolean
): Promise<r> {
  console.log(`[SETUP-PROMPT] Starting setupPromptForUser for category: ${category}`);
  console.log(`[SETUP-PROMPT] Parameters:`, {
    userId,
    contentLength: promptContent?.length,
    category,
    title,
    hasNotes: !!notes,
    isGlobal,
    isGlobalType: typeof isGlobal
  });
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required' };
    }

    if (!promptContent) {
      return { success: false, message: 'Prompt content is required' };
    }

    // Always create a new prompt - never reuse existing ones
    // This ensures global and user-specific prompts are completely separate
    console.log(`[SETUP-PROMPT] Creating new prompt with global flag:`, isGlobal);
    
    const promptName = isGlobal 
      ? `Global ${category.replace('_', ' ')}`
      : `${userId} ${category.replace('_', ' ')}`;
    
    const requestBody = {
      name: promptName,
      description: isGlobal 
        ? `Global ${category.replace('_', ' ')} for all users`
        : `Custom ${category.replace('_', ' ')} for user ${userId}`,
      category,
      created_by: userId,
      is_active: true, // Using boolean value directly for boolean column
      is_global: isGlobal === true, // Use boolean directly
    };
    console.log(`[SETUP-PROMPT] Prompt creation request body:`, JSON.stringify(requestBody));

    const createResponse = await fetch('/api/v11/prompts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[SETUP-PROMPT] Error creating prompt:`, {
        status: createResponse.status,
        statusText: createResponse.statusText,
        errorText
      });
      throw new Error(`Error creating prompt: ${createResponse.statusText} - ${errorText}`);
    }

    const createData = await createResponse.json();
    const promptId = createData.data.id;

    // 3. Create a new version of the prompt
    console.log('[SETUP-PROMPT] Creating prompt version for prompt ID:', promptId);

    const versionRequestBody = {
      promptId: promptId,
      content: promptContent,
      createdBy: userId,
      notes: notes || `Updated via admin interface on ${new Date().toLocaleString()}`,
      title: title || `Version created on ${new Date().toLocaleString()}`,
    };

    console.log('[SETUP-PROMPT] Prompt version request body:', JSON.stringify(versionRequestBody));

    const versionResponse = await fetch('/api/v11/prompt-versions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(versionRequestBody),
    });

    if (!versionResponse.ok) {
      // Get detailed error message if available
      let errorDetails = '';
      try {
        const errorData = await versionResponse.json();
        errorDetails = errorData.error || errorData.details || '';
      } catch (e) {
        // If we can't parse the response as JSON, just use the status text
        console.log('error e: ', e)
      }

      throw new Error(`Error creating prompt version: ${versionResponse.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    const versionData = await versionResponse.json();

    // Ensure we have a valid version ID as a string
    if (!versionData || !versionData.data || !versionData.data.id) {
      console.error('[SETUP-PROMPT] Invalid version data:', versionData);
      throw new Error('Invalid response from prompt-versions API: No version ID returned');
    }

    const versionId = String(versionData.data.id);
    console.log('[SETUP-PROMPT] Got version ID:', versionId, 'type:', typeof versionId);

    // 4. Only assign this version to the user if it's not global
    if (!isGlobal) {
      console.log('[SETUP-PROMPT] Assigning prompt version', versionId, 'to user', userId);

      const assignRequestBody = {
        userId: userId,
        promptVersionId: versionId,
        assignedBy: userId,
      };

      console.log('[SETUP-PROMPT] Assign request body type check:', {
        userId: typeof userId,
        promptVersionId: typeof versionId,
        assignedBy: typeof userId,
        bodyStringified: JSON.stringify(assignRequestBody)
      });

      console.log('[SETUP-PROMPT] Assign prompt request body:', JSON.stringify(assignRequestBody));

      const assignResponse = await fetch('/api/v11/assign-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignRequestBody),
      });

      if (!assignResponse.ok) {
        // Get detailed error message if available
        let errorDetails = '';
        try {
          const errorData = await assignResponse.json();
          errorDetails = errorData.error || errorData.details || '';
        } catch (e) {
          // If we can't parse the response as JSON, just use the status text
          console.log('error e: ', e)
        }

        throw new Error(`Error assigning prompt: ${assignResponse.statusText}${errorDetails ? ` - ${errorDetails}` : ''}`);
      }
    } else {
      console.log('[SETUP-PROMPT] Skipping assignment - prompt is global');
    }

    return {
      success: true,
      message: `Successfully updated ${category.replace('_', ' ')} for user ${userId}${isGlobal ? ' (set as global)' : ''}`,
    };
  } catch (error) {
    console.error('Error setting up prompt:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}