import { createPrompt, assignPromptToUser } from '@/lib/prompts';

/**
 * Script to create and assign a quest generation prompt for a specific user
 * To be run manually or via API
 * @param userId The user ID to assign the prompt to
 * @param promptContent The quest generation instructions
 * @param title Optional title for the prompt version
 * @param notes Optional notes for the prompt version
 * @param bookId Optional book ID for book-specific prompts
 * @param isGlobal Optional flag to set the prompt as global (default: false)
 */
export async function setupQuestGenerationPromptForUser(
  userId: string,
  promptContent: string,
  title?: string,
  notes?: string,
  bookId?: string,
  isGlobal: boolean = false
): Promise<{ success: boolean; message: string; promptId?: string }> {
  try {
    // Always create a new prompt - never reuse existing ones
    // This ensures global and user-specific prompts are completely separate
    let promptId;
    
    // Different description based on whether it's book-specific and/or global
    const description = bookId 
      ? (isGlobal 
          ? `Global book-specific quest generation prompt (book: ${bookId})` 
          : `Book-specific quest generation prompt for user ${userId} (book: ${bookId})`)
      : (isGlobal 
          ? `Global quest generation prompt` 
          : `Quest generation prompt for user ${userId}`);
    
    // If book ID is provided, use createBookQuestPrompt from lib/prompts
    if (bookId) {
      try {
        const { createBookQuestPrompt } = await import('@/lib/prompts');
        promptId = await createBookQuestPrompt(
          bookId,
          promptContent,
          userId,
          isGlobal, // Pass isGlobal parameter
          title || undefined,
          notes || undefined
        );
      } catch (err) {
        console.error('Error in createBookQuestPrompt:', err);
        return { 
          success: false, 
          message: err instanceof Error ? err.message : 'Error creating book-specific quest prompt' 
        };
      }
    } else {
      // Regular prompt creation for non-book-specific prompts
      promptId = await createPrompt(
        'Quest Generation', // Name
        description, // Description
        promptContent, // The quest generation instructions
        'quest_generation', // Category
        userId, // Created by
        isGlobal, // Global flag
        title, // Optional title
        notes // Optional notes
      );
    }

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
    }

    return { 
      success: true, 
      message: 'Quest generation prompt created and assigned successfully',
      promptId 
    };

  } catch (error) {
    console.error('Error setting up quest generation prompt for user:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}