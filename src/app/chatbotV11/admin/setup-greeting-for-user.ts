import { createPrompt, assignPromptToUser } from '@/lib/prompts';

/**
 * Script to create and assign custom AI instructions for a specific user
 * To be run manually or via API
 * @param userId The user ID to assign the instructions to
 * @param instructionsContent The custom AI instructions
 * @param title Optional title for the prompt version
 * @param notes Optional notes for the prompt version
 */
export async function setupAIInstructionsForUser(
  userId: string,
  instructionsContent: string,
  title?: string,
  notes?: string,
  isGlobal: boolean = false
): Promise<{ success: boolean; message: string; promptId?: string }> {
  try {
    // Always create a new prompt - never reuse existing ones
    // This ensures global and user-specific prompts are completely separate
    const promptId = await createPrompt(
      'Custom AI Instructions', // Name
      isGlobal ? 'Global AI instructions' : 'Custom AI instructions for user ' + userId, // Description
      instructionsContent, // The AI instructions
      'ai_instructions', // Category
      userId, // Created by
      isGlobal, // Global flag from parameter
      title, // Optional title
      notes // Optional notes
    );

    if (!promptId) {
      return { success: false, message: 'Failed to create prompt' };
    }

    // Get the prompt version ID (first version)
    let versionId;
    try {
      const response = await fetch('/api/v11/prompt-versions?promptId=' + promptId);
      
      if (!response.ok) {
        console.error('Prompt versions API error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        return { success: false, message: `Failed to get prompt version ID: ${response.status} ${response.statusText}` };
      }
      
      const responseText = await response.text();
      console.log('Prompt versions API response text:', responseText);
      
      // Try to parse JSON, handle possible parsing errors
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error for prompt versions API:', parseError, 'Response was:', responseText);
        return { success: false, message: 'Failed to parse prompt versions response' };
      }
      
      if (!result.data || result.data.length === 0) {
        console.error('No prompt versions found:', result);
        return { success: false, message: 'No prompt versions found' };
      }
      
      versionId = result.data[0].id;
    } catch (error) {
      const fetchError = error as Error;
      console.error('Fetch error for prompt versions API:', fetchError);
      return { success: false, message: `Network error fetching prompt versions: ${fetchError.message || 'Unknown error'}` };
    }

    // Always assign the prompt to the user (both global and custom prompts need user assignments)
    const assigned = await assignPromptToUser(
      userId,
      versionId,
      userId // Assigned by
    );

    if (!assigned) {
      return { success: false, message: 'Failed to assign prompt to user' };
    }

    return { 
      success: true, 
      message: isGlobal 
        ? 'Global AI instructions created and assigned successfully' 
        : 'Custom AI instructions created and assigned successfully',
      promptId 
    };

  } catch (error) {
    console.error('Error setting up AI instructions for user:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Script to create and assign a custom greeting prompt for a specific user
 * To be run manually or via API
 * @param userId The user ID to assign the prompt to
 * @param promptContent The custom greeting instructions
 * @param title Optional title for the prompt version
 * @param notes Optional notes for the prompt version
 */
export async function setupGreetingForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  isGlobal: boolean = false,
  greetingType: 'default' | 'resources' | 'future_pathways' = 'default'
): Promise<{ success: boolean; message: string; promptId?: string }> {
  console.log('[admin] setupGreetingForUser called with:', {
    userId,
    contentPreview: promptContent.substring(0, 50) + '...',
    title,
    notes,
    isGlobal,
    greetingType
  });
  
  try {
    // Always create a new prompt - never reuse existing ones
    // This ensures global and user-specific prompts are completely separate
    const promptName = greetingType === 'resources' ? 'Resource Locator Greeting' :
                      greetingType === 'future_pathways' ? 'Future Pathways Greeting' :
                      'Custom Greeting';
    const description = greetingType === 'resources' ? 
                       (isGlobal ? 'Global resource locator greeting' : 'Custom resource locator greeting for user ' + userId) :
                       greetingType === 'future_pathways' ?
                       (isGlobal ? 'Global future pathways greeting' : 'Custom future pathways greeting for user ' + userId) :
                       (isGlobal ? 'Global greeting prompt' : 'Custom greeting prompt for user ' + userId);
    
    console.log('[admin] Creating new greeting prompt:', {
      name: promptName,
      greetingType,
      isGlobal,
      userId
    });
    
    const promptId = await createPrompt(
      promptName,
      description,
      promptContent, // The greeting instructions
      'greeting', // Category
      userId, // Created by
      isGlobal, // Global flag from parameter
      title, // Optional title
      notes, // Optional notes
      undefined, // book_id
      greetingType // greeting_type
    );

    if (!promptId) {
      return { success: false, message: 'Failed to create prompt' };
    }

    // Get the prompt version ID (first version)
    let versionId;
    try {
      const response = await fetch('/api/v11/prompt-versions?promptId=' + promptId);
      
      if (!response.ok) {
        console.error('Prompt versions API error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        return { success: false, message: `Failed to get prompt version ID: ${response.status} ${response.statusText}` };
      }
      
      const responseText = await response.text();
      console.log('Prompt versions API response text:', responseText);
      
      // Try to parse JSON, handle possible parsing errors
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON parse error for prompt versions API:', parseError, 'Response was:', responseText);
        return { success: false, message: 'Failed to parse prompt versions response' };
      }
      
      if (!result.data || result.data.length === 0) {
        console.error('No prompt versions found:', result);
        return { success: false, message: 'No prompt versions found' };
      }
      
      versionId = result.data[0].id;
    } catch (error) {
      const fetchError = error as Error;
      console.error('Fetch error for prompt versions API:', fetchError);
      return { success: false, message: `Network error fetching prompt versions: ${fetchError.message || 'Unknown error'}` };
    }

    // Only assign the prompt to the user if it's not global
    if (!isGlobal) {
      const assigned = await assignPromptToUser(
        userId,
        versionId,
        userId // Assigned by
      );

      if (!assigned) {
        return { success: false, message: 'Failed to assign prompt to user' };
      }
    } else {
      // If setting as global, we should remove any existing user-specific assignment
      // to ensure the global version is used
      console.log('[admin] Setting as global - checking for existing user assignments to remove');
      
      // Note: We would need to implement a removeUserPromptAssignment function
      // For now, log this as a known issue
      console.log('[admin] WARNING: Existing user-specific assignments may override global settings');
    }

    return { 
      success: true, 
      message: isGlobal 
        ? 'Global greeting prompt created successfully' 
        : 'Custom greeting prompt created and assigned successfully',
      promptId 
    };

  } catch (error) {
    console.error('Error setting up greeting for user:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}