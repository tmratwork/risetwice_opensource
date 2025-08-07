// src/lib/prompts.ts

/**
 * Service for handling user prompt management
 * Contains functions for creating, fetching, and assigning prompts
 */

import { supabase } from '@/lib/supabase';

// Define a type for the debug storage object
interface PromptDebugStorage {
  promptType: string;
  [key: string]: string | number | boolean | object | null | undefined;
}

// Helper function to safely get or set the global debug object
// This handles both browser and Node.js environments
const getDebugStorage = (): PromptDebugStorage | undefined => {
  // Check for browser or Node.js environment
  if (typeof window !== 'undefined') {
    // Convert to unknown first as recommended by TypeScript
    const windowObj = window as unknown;
    return (windowObj as Record<string, unknown>).__selectedPrompt as PromptDebugStorage;
  } else if (typeof global !== 'undefined') {
    // Convert to unknown first as recommended by TypeScript
    const globalObj = global as unknown;
    return (globalObj as Record<string, unknown>).__selectedPrompt as PromptDebugStorage;
  }
  return undefined;
};

const setDebugStorage = (value: PromptDebugStorage): void => {
  if (typeof window !== 'undefined') {
    // Convert to unknown first as recommended by TypeScript
    const windowObj = window as unknown;
    (windowObj as Record<string, unknown>).__selectedPrompt = value;
  } else if (typeof global !== 'undefined') {
    // Convert to unknown first as recommended by TypeScript
    const globalObj = global as unknown;
    (globalObj as Record<string, unknown>).__selectedPrompt = value;
  }
};

// Initialize debug storage if needed
if (!getDebugStorage()) {
  setDebugStorage({ promptType: 'NOT_SET' });
}

/**
 * Fetch a custom greeting prompt for a specific user
 * @param userId The user ID to fetch the greeting for
 * @returns The greeting prompt text or null if not found
 */
export async function fetchUserGreetingPrompt(userId: string): Promise<string | null> {
  try {
    // Direct Supabase query rather than using the API endpoint
    // The LIMIT 1 and ORDER BY assigned_at DESC ensures we get only the most recent assignment
    const { data: assignments, error: assignmentError } = await supabase
      .from('user_prompt_assignments')
      .select(`
        prompt_version_id,
        assigned_at,
        prompt_versions!inner(
          id,
          content,
          prompts!inner(category)
        )
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', 'greeting')
      .order('assigned_at', { ascending: false })
      .limit(1);

    if (assignmentError) {
      console.error('Error fetching user prompt assignments:', assignmentError);
      return null;
    }

    // If we have a custom prompt content, return it
    if (assignments && assignments.length > 0 && assignments[0].prompt_versions && 'content' in assignments[0].prompt_versions) {
      console.log(`Found greeting prompt for user ${userId}, assigned at ${assignments[0].assigned_at}`);
      return assignments[0].prompt_versions.content as string;
    }

    // If no user-specific prompt was found, check for global prompts
    console.log(`No user-specific greeting prompt found for ${userId}, checking for global prompts...`);
    
    const { data: globalPrompts, error: globalError } = await supabase
      .from('prompts')
      .select(`
        id,
        prompt_versions!inner(
          id,
          content,
          created_at
        )
      `)
      .eq('category', 'greeting')
      .eq('is_global', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (globalError) {
      console.error('Error fetching global greeting prompts:', globalError);
      return null;
    }

    // If we found a global prompt, return its content
    if (globalPrompts && globalPrompts.length > 0 && 
        globalPrompts[0].prompt_versions && 
        globalPrompts[0].prompt_versions.length > 0 && 
        'content' in globalPrompts[0].prompt_versions[0]) {
      console.log(`Found global greeting prompt, created at ${globalPrompts[0].prompt_versions[0].created_at}`);
      return globalPrompts[0].prompt_versions[0].content as string;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user greeting prompt:', error);
    return null;
  }
}

/**
 * Fetch book-specific AI instructions for a given book ID
 * @param bookId The book ID to fetch AI instructions for
 * @returns The AI instructions text or null if not found
 */
export async function fetchBookAIInstructions(bookId: string): Promise<string | null> {
  try {
    console.log(`[sleep-book] 🔍 Fetching book-specific AI instructions for book: ${bookId}`);
    
    // Query for book-specific AI instructions
    const { data: bookPrompts, error: bookError } = await supabase
      .from('prompt_versions')
      .select(`
        id,
        content,
        created_at,
        prompts!inner(
          id,
          category,
          book_id,
          is_global
        )
      `)
      .eq('prompts.category', 'ai_instructions')
      .eq('prompts.book_id', bookId)
      .eq('prompts.is_global', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (bookError) {
      console.error(`[sleep-book] ❌ Error fetching book-specific AI instructions:`, bookError);
      return null;
    }

    // If we found book-specific instructions, return them
    if (bookPrompts && bookPrompts.length > 0 && bookPrompts[0].content) {
      console.log(`[sleep-book] ✅ Found book-specific AI instructions for book ${bookId}`);
      console.log(`[sleep-book] 📝 AI Instructions content:`);
      console.log(`[sleep-book] ${bookPrompts[0].content}`);
      console.log(`[sleep-book] 📝 End of AI instructions`);
      return bookPrompts[0].content as string;
    }

    console.log(`[sleep-book] ❌ No book-specific AI instructions found for book ${bookId}`);
    return null;
  } catch (error) {
    console.error(`[sleep-book] ❌ Error fetching book-specific AI instructions:`, error);
    return null;
  }
}

/**
 * Fetch custom AI instructions for a specific user
 * @param userId The user ID to fetch instructions for
 * @returns The AI instructions text or null if not found
 */
export async function fetchUserAIInstructions(userId: string): Promise<string | null> {
  try {
    // Direct Supabase query rather than using the API endpoint
    // The LIMIT 1 and ORDER BY assigned_at DESC ensures we get only the most recent assignment
    const { data: assignments, error: assignmentError } = await supabase
      .from('user_prompt_assignments')
      .select(`
        prompt_version_id,
        assigned_at,
        prompt_versions!inner(
          id,
          content,
          prompts!inner(category)
        )
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', 'ai_instructions')
      .order('assigned_at', { ascending: false })
      .limit(1);

    if (assignmentError) {
      console.error('Error fetching user prompt assignments:', assignmentError);
      return null;
    }

    // If we have a custom prompt content, return it
    if (assignments && assignments.length > 0 && assignments[0].prompt_versions && 'content' in assignments[0].prompt_versions) {
      console.log(`Found AI instructions for user ${userId}, assigned at ${assignments[0].assigned_at}`);
      return assignments[0].prompt_versions.content as string;
    }

    // If no user-specific prompt was found, check for global prompts
    console.log(`No user-specific AI instructions found for ${userId}, checking for global prompts...`);
    
    const { data: globalPrompts, error: globalError } = await supabase
      .from('prompts')
      .select(`
        id,
        prompt_versions!inner(
          id,
          content,
          created_at
        )
      `)
      .eq('category', 'ai_instructions')
      .eq('is_global', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (globalError) {
      console.error('Error fetching global AI instructions:', globalError);
      // Log more details about the error for debugging
      console.log('Query details:', {
        category: 'ai_instructions',
        isGlobal: 'true',
        orderBy: 'created_at'
      });
      return null;
    }

    // If we found a global prompt, return its content
    if (globalPrompts && globalPrompts.length > 0 && 
        globalPrompts[0].prompt_versions && 
        globalPrompts[0].prompt_versions.length > 0 && 
        'content' in globalPrompts[0].prompt_versions[0]) {
      console.log(`Found global AI instructions, created at ${globalPrompts[0].prompt_versions[0].created_at}`);
      return globalPrompts[0].prompt_versions[0].content as string;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user AI instructions:', error);
    return null;
  }
}

/**
 * Fetch custom warm handoff prompt for a specific user, falling back to global prompts if none found
 * @param userId The user ID to fetch the warm handoff prompt for
 * @returns The warm handoff prompt text or null if not found
 */
export async function fetchUserWarmHandoffPrompt(userId: string): Promise<string | null> {
  try {
    // Direct Supabase query rather than using the API endpoint
    // The LIMIT 1 and ORDER BY assigned_at DESC ensures we get only the most recent assignment
    const { data: assignments, error: assignmentError } = await supabase
      .from('user_prompt_assignments')
      .select(`
        prompt_version_id,
        assigned_at,
        prompt_versions!inner(
          id,
          content,
          prompts!inner(category)
        )
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', 'warm_handoff')
      .order('assigned_at', { ascending: false })
      .limit(1);

    if (assignmentError) {
      console.error('Error fetching warm handoff prompt assignments:', assignmentError);
      return null;
    }

    // If we have a custom prompt content, return it
    if (assignments && assignments.length > 0 && assignments[0].prompt_versions && 'content' in assignments[0].prompt_versions) {
      console.log(`Found warm handoff prompt for user ${userId}, assigned at ${assignments[0].assigned_at}`);
      return assignments[0].prompt_versions.content as string;
    }

    // If no user-specific prompt was found, check for global prompts
    console.log(`No user-specific warm handoff prompt found for ${userId}, checking for global prompts...`);
    
    const { data: globalPrompts, error: globalError } = await supabase
      .from('prompts')
      .select(`
        id,
        prompt_versions!inner(
          id,
          content,
          created_at
        )
      `)
      .eq('category', 'warm_handoff')
      .eq('is_global', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (globalError) {
      console.error('Error fetching global warm handoff prompts:', globalError);
      return null;
    }

    // If we found a global prompt, return its content
    if (globalPrompts && globalPrompts.length > 0 && 
        globalPrompts[0].prompt_versions && 
        globalPrompts[0].prompt_versions.length > 0 && 
        'content' in globalPrompts[0].prompt_versions[0]) {
      console.log(`Found global warm handoff prompt, created at ${globalPrompts[0].prompt_versions[0].created_at}`);
      return globalPrompts[0].prompt_versions[0].content as string;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user warm handoff prompt:', error);
    return null;
  }
}

/**
 * Fetch custom quest generation prompt for a specific user
 * @param userId The user ID to fetch the quest generation prompt for
 * @param bookId Optional book ID to fetch a book-specific prompt
 * @returns The quest generation prompt text or null if not found
 */
export async function fetchUserQuestGenerationPrompt(userId: string, bookId?: string): Promise<string | null> {
  try {
    // Direct Supabase query rather than using the API endpoint
    // The LIMIT 1 and ORDER BY assigned_at DESC ensures we get only the most recent assignment
    let query = supabase
      .from('user_prompt_assignments')
      .select(`
        prompt_version_id,
        assigned_at,
        prompt_versions!inner(
          id,
          content,
          prompts!inner(
            id,
            category,
            book_id
          )
        )
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', 'quest_generation')
      .order('assigned_at', { ascending: false });
    
    // If bookId is provided, filter by book_id
    if (bookId) {
      query = query.eq('prompt_versions.prompts.book_id', bookId);
    } else {
      // If no bookId is provided, only get prompts that aren't associated with a specific book
      query = query.is('prompt_versions.prompts.book_id', null);
    }
    
    // Limit to just the most recent assignment
    query = query.limit(1);

    const { data: assignments, error: assignmentError } = await query;

    if (assignmentError) {
      console.error('Error fetching quest generation prompt assignments:', assignmentError);
      return null;
    }

    // If we have a custom prompt content, return it
    if (assignments && assignments.length > 0 && assignments[0].prompt_versions && 'content' in assignments[0].prompt_versions) {
      const bookContext = bookId ? ` for book ${bookId}` : '';
      console.log(`Found quest generation prompt for user ${userId}${bookContext}, assigned at ${assignments[0].assigned_at}`);
      return assignments[0].prompt_versions.content as string;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user quest generation prompt:', error);
    return null;
  }
}

/**
 * Fetch a book-specific quest generation prompt (global, not user-specific)
 * @param bookId The book ID to fetch the quest generation prompt for
 * @returns The quest generation prompt text or null if not found
 */
export async function fetchBookQuestGenerationPrompt(bookId: string): Promise<string | null> {
  const debugId = Date.now().toString().slice(-6);
  console.log(`[PromptDB:${debugId}] Starting fetchBookQuestGenerationPrompt for bookId: ${bookId}`);
  
  // Debug - Inspect type and format of bookId
  console.log(`[PromptDB:${debugId}] Type of bookId: ${typeof bookId}`);
  console.log(`[PromptDB:${debugId}] Length of bookId: ${bookId.length}`);
  console.log(`[PromptDB:${debugId}] bookId value: '${bookId}'`);
  
  // Debug - Check if there are any records with matching book_id like patterns
  try {
    // Get 5 sample IDs from the database to compare format
    const { data: sampleIds, error: sampleError } = await supabase
      .from('prompts')
      .select('book_id')
      .not('book_id', 'is', null)
      .limit(5);
      
    if (!sampleError && sampleIds && sampleIds.length > 0) {
      console.log(`[PromptDB:${debugId}] Sample book_id values from database for comparison:`);
      sampleIds.forEach((item, i) => {
        if (item.book_id) {
          console.log(`[PromptDB:${debugId}] Sample ${i+1}: '${item.book_id}' (type: ${typeof item.book_id}, length: ${item.book_id.length})`);
        }
      });
    }
  } catch (sampleError) {
    console.error(`[PromptDB:${debugId}] Error getting sample book_ids:`, sampleError);
  }
  
  try {
    // First, get the prompt record for this book
    console.log(`[PromptDB:${debugId}] Query 1: Finding prompt record for bookId=${bookId}, category=quest_generation, is_global=true`);
    
    // Debug: Check how many quest_generation prompts exist in total
    const { data: allQuestPrompts, error: allQuestError } = await supabase
      .from('prompts')
      .select('id, book_id, is_global')
      .eq('category', 'quest_generation');
      
    if (!allQuestError) {
      console.log(`[PromptDB:${debugId}] Total quest_generation prompts in database: ${allQuestPrompts?.length || 0}`);
      if (allQuestPrompts && allQuestPrompts.length > 0) {
        allQuestPrompts.forEach((p, i) => {
          console.log(`[PromptDB:${debugId}] Quest prompt ${i+1}: id=${p.id}, book_id=${p.book_id || 'null'}, is_global=${p.is_global}`);
        });
      }
    }
    
    // Try exact match first
    const promptQuery = supabase
      .from('prompts')
      .select('id, name, book_id, is_global')
      .eq('category', 'quest_generation')
      .eq('book_id', bookId)
      .eq('is_global', true)
      .limit(1);
      
    console.log(`[PromptDB:${debugId}] Generated SQL query (approximation): 
      SELECT id, name, book_id, is_global FROM prompts 
      WHERE category = 'quest_generation' 
      AND book_id = '${bookId}' 
      AND is_global = 'true' 
      LIMIT 1`);
    
    const { data: promptData, error: promptError } = await promptQuery;

    if (promptError) {
      console.error(`[PromptDB:${debugId}] Error fetching book quest generation prompt:`, promptError);
      return null;
    }

    console.log(`[PromptDB:${debugId}] Query 1 result: ${promptData ? promptData.length : 0} records found`);
    
    if (!promptData || promptData.length === 0) {
      console.log(`[PromptDB:${debugId}] No global prompt record found for this exact book ID`);
      
      // Extra diagnostic: Check if there are ANY prompts for this book
      const { data: anyPrompts, error: anyPromptsError } = await supabase
        .from('prompts')
        .select('id, category, is_global, book_id, name')
        .eq('book_id', bookId);
        
      if (!anyPromptsError && anyPrompts && anyPrompts.length > 0) {
        console.log(`[PromptDB:${debugId}] BUT FOUND ${anyPrompts.length} other prompts for this book:`);
        anyPrompts.forEach((p, i) => {
          console.log(`[PromptDB:${debugId}] Prompt ${i+1}: id=${p.id}, name=${p.name}, category=${p.category}, is_global=${p.is_global}, book_id=${p.book_id}`);
        });
      } else {
        console.log(`[PromptDB:${debugId}] No prompts of any kind found for this book`);
        
        // Diagnostic: Try a case-insensitive search
        console.log(`[PromptDB:${debugId}] Trying case-insensitive search...`);
        const { data: ciPrompts, error: ciError } = await supabase
          .from('prompts')
          .select('id, name, category, is_global, book_id')
          .ilike('book_id', `%${bookId.substring(0, 8)}%`);
          
        if (!ciError && ciPrompts && ciPrompts.length > 0) {
          console.log(`[PromptDB:${debugId}] Found ${ciPrompts.length} prompts with similar book_id (first 8 chars):`);
          ciPrompts.forEach((p, i) => {
            console.log(`[PromptDB:${debugId}] Similar prompt ${i+1}: id=${p.id}, name=${p.name}, category=${p.category}, is_global=${p.is_global}, book_id=${p.book_id}`);
          });
        } else {
          console.log(`[PromptDB:${debugId}] No similar prompts found either`);
        }
      }
      
      return null; // No global prompt found for this book
    }

    const promptId = promptData[0].id;
    console.log(`[PromptDB:${debugId}] Found prompt record with ID: ${promptId}`);
    console.log(`[PromptDB:${debugId}] Full prompt data:`, JSON.stringify(promptData[0], null, 2));

    // Extra diagnostic: Check if the is_global value is a string 'true' or a boolean true
    const isGlobalValue = promptData[0].is_global;
    console.log(`[PromptDB:${debugId}] is_global value: '${isGlobalValue}' (type: ${typeof isGlobalValue})`);
    if (typeof isGlobalValue === 'string' && isGlobalValue !== 'true') {
      console.log(`[PromptDB:${debugId}] WARNING: is_global is set to '${isGlobalValue}' but should be 'true'`);
    }

    // Get the latest version of this prompt
    console.log(`[PromptDB:${debugId}] Query 2: Finding latest version for promptId=${promptId}`);
    
    // Debug - Check how many versions exist for this prompt
    const { data: totalVersions, error: totalError } = await supabase
      .from('prompt_versions')
      .select('id')
      .eq('prompt_id', promptId);
      
    if (!totalError) {
      console.log(`[PromptDB:${debugId}] Total versions for prompt ID ${promptId}: ${totalVersions?.length || 0}`);
    }
    
    const versionQuery = supabase
      .from('prompt_versions')
      .select('id, content, created_at, version_number')
      .eq('prompt_id', promptId)
      .order('created_at', { ascending: false })
      .limit(1);
      
    console.log(`[PromptDB:${debugId}] Generated SQL query (approximation): 
      SELECT id, content, created_at, version_number FROM prompt_versions 
      WHERE prompt_id = '${promptId}' 
      ORDER BY created_at DESC 
      LIMIT 1`);
      
    const { data: versionData, error: versionError } = await versionQuery;

    if (versionError) {
      console.error(`[PromptDB:${debugId}] Error fetching book quest generation prompt version:`, versionError);
      
      // Extra diagnostic: Check if prompt_versions table exists
      const { error: tableError } = await supabase
        .from('prompt_versions')
        .select('count()')
        .limit(1);
        
      if (tableError) {
        console.error(`[PromptDB:${debugId}] Error: prompt_versions table might not exist`, tableError);
      } else {
        console.log(`[PromptDB:${debugId}] prompt_versions table exists`);
      }
      
      return null;
    }

    console.log(`[PromptDB:${debugId}] Query 2 result: ${versionData ? versionData.length : 0} records found`);
    
    if (!versionData || versionData.length === 0) {
      console.log(`[PromptDB:${debugId}] No versions found for prompt ID ${promptId}`);
      
      // Extra diagnostic: Check if there are versions for ANY prompt
      const { data: anyVersions, error: anyVersionsError } = await supabase
        .from('prompt_versions')
        .select('id, prompt_id')
        .limit(5);
        
      if (!anyVersionsError && anyVersions && anyVersions.length > 0) {
        console.log(`[PromptDB:${debugId}] Sample versions from other prompts:`);
        anyVersions.forEach((v, i) => {
          console.log(`[PromptDB:${debugId}] Version ${i+1}: id=${v.id}, prompt_id=${v.prompt_id}`);
        });
      }
      
      return null; // No version found for this prompt
    }

    const versionId = versionData[0].id;
    const createdAt = versionData[0].created_at;
    const versionNumber = versionData[0].version_number;
    console.log(`[PromptDB:${debugId}] Found version with ID: ${versionId}, created at: ${createdAt}, version: ${versionNumber}`);
    console.log(`[PromptDB:${debugId}] Successfully retrieved global quest generation prompt for book ${bookId}`);
    
    // Return only the first 100 chars of content in logs to avoid clutter
    const contentPreview = versionData[0].content ? (versionData[0].content.substring(0, 100) + '...') : 'NULL OR EMPTY CONTENT';
    console.log(`[PromptDB:${debugId}] Content preview: ${contentPreview}`);
    
    // Final check to make sure content exists and is a string
    if (!versionData[0].content) {
      console.error(`[PromptDB:${debugId}] ERROR: Prompt content is empty or null!`);
      return null;
    }
    
    if (typeof versionData[0].content !== 'string') {
      console.error(`[PromptDB:${debugId}] ERROR: Prompt content is not a string! Type:`, typeof versionData[0].content);
      return null;
    }
    
    return versionData[0].content;
  } catch (error) {
    console.error(`[PromptDB:${debugId}] Error fetching book quest generation prompt:`, error);
    return null;
  }
}

/**
 * Default template for quest generation
 * This is used as a fallback when no custom prompt is available
 */
const DEFAULT_QUEST_GENERATION_PROMPT = `
You're creating educational quests based on "{{BOOK_TITLE}}" by {{BOOK_AUTHOR}}. Create {{NUM_QUESTS}} conversational quests that help learners apply and practice key concepts from this book.

## Book Content (First Section)
{{BOOK_CONTENT}}

{{KEY_CONCEPTS}}

After reviewing the book content, create {{NUM_QUESTS}} different quests. Each quest should focus on a different concept or insight from the book. For each quest, provide:

1. QUEST TITLE: A simple, engaging title for the quest
2. INTRODUCTION: In 2-3 sentences, explain what concept we're exploring and why it matters in everyday life
3. THE CHALLENGE: Describe one clear challenge related to the concept that the learner needs to complete
4. REWARD: Mention what badge or achievement they'll earn upon completion
5. STARTING QUESTION: End with an open-ended question that begins their journey and encourages them to think about the concept
6. AI_PROMPT: Provide comprehensive instructions for how AI should conduct this quest conversation with users. Since the AI won't have access to the book during the conversation, include:
  - Complete explanation of the specific concept from the book (including any terminology, frameworks, acronyms, or methodologies mentioned in the book and their full definitions)
  - The precise quest goal and success criteria
  - Key quotes or examples from the book that illustrate this concept
  - Common misconceptions users might have about this concept
  - 5-7 specific guiding questions the AI can ask to facilitate learning
  - Suggested responses to different user approaches
  - Guidance strategies to support users without solving the challenge for them
  - How to recognize when the user has successfully completed the quest
  
  Make this section thorough and self-contained so an AI with no prior knowledge of the book can effectively guide users through this quest using only the information provided in this prompt.

Keep everything in simple, conversational language appropriate for learners. Avoid technical jargon and focus on making the concepts relatable and interesting.

## Output Format
Return your response in this exact JSON format (no additional text before or after):

{
  "quests": [
    {
      "quest_title": "Title of quest 1",
      "introduction": "Introduction for quest 1",
      "challenge": "Challenge for quest 1",
      "reward": "Reward for quest 1",
      "starting_question": "Starting question for quest 1",
      "ai_prompt": "Detailed instructions for AI to help with quest 1"
    },
    // ...and so on for all quests
  ]
}
`;

/**
 * Get the effective quest generation prompt using a cascade of priorities:
 * 1. Book-specific prompt for specific user
 * 2. Global book-specific prompt
 * 3. User's general quest prompt (not book-specific)
 * 4. Default quest generation prompt
 * 
 * @param bookId The book ID to get the prompt for
 * @param bookTitle The book title (for template substitution)
 * @param bookAuthor The book author (for template substitution)
 * @param userId Optional user ID to try user-specific prompts
 * @returns The effective prompt text to use
 */
export async function getEffectiveQuestPrompt(
  bookId: string, 
  bookTitle: string,
  bookAuthor: string,
  userId?: string
): Promise<string> {
  console.log(`Getting effective quest prompt for book ${bookId}${userId ? ` and user ${userId}` : ''}`);
  
  // Access the global debug storage object if it exists
  if (getDebugStorage()) {
    console.log(`[PromptService] Debug storage available for prompt tracking`);
  }

  // Log all query parameters for debugging
  console.log(`[PromptService] QUERY PARAMETERS:`);
  console.log(`[PromptService] bookId: ${bookId}`);
  console.log(`[PromptService] userId: ${userId || 'not provided'}`);

  // 1. Try book-specific prompt for this user
  if (userId) {
    console.log(`[PromptService] Attempting to fetch user book-specific prompt: userId=${userId}, bookId=${bookId}`);
    const userBookPrompt = await fetchUserQuestGenerationPrompt(userId, bookId);
    if (userBookPrompt) {
      console.log(`[PromptService] FOUND: User book-specific prompt for user ${userId} and book ${bookId}`);
      console.log(`PROMPT CONTENT: 
------------------------------------
${userBookPrompt}
------------------------------------`);
      
      // Store prompt type in debug object if available
      const debugStorage = getDebugStorage();
      if (debugStorage) {
        debugStorage.promptType = 'USER_BOOK_SPECIFIC';
      }
      
      return userBookPrompt;
    } else {
      console.log(`[PromptService] NOT FOUND: No user book-specific prompt for user ${userId} and book ${bookId}`);
    }
  }

  // 2. Try global book-specific prompt
  console.log(`[PromptService] Attempting to fetch global book-specific prompt: bookId=${bookId}`);
  const globalBookPrompt = await fetchBookQuestGenerationPrompt(bookId);
  if (globalBookPrompt) {
    console.log(`[PromptService] FOUND: Global book-specific prompt for book ${bookId}`);
    console.log(`PROMPT CONTENT: 
------------------------------------
${globalBookPrompt}
------------------------------------`);
    
    // Store prompt type in debug object if available
    const debugStorage = getDebugStorage();
    if (debugStorage) {
      debugStorage.promptType = 'GLOBAL_BOOK_SPECIFIC';
    }
    
    return globalBookPrompt;
  } else {
    console.log(`[PromptService] NOT FOUND: No global book-specific prompt for book ${bookId}`);
  }

  // 3. Try user's general quest prompt (not book-specific)
  if (userId) {
    console.log(`[PromptService] Attempting to fetch user general prompt: userId=${userId}`);
    const userPrompt = await fetchUserQuestGenerationPrompt(userId);
    if (userPrompt) {
      console.log(`[PromptService] FOUND: General quest prompt for user ${userId}`);
      console.log(`PROMPT CONTENT: 
------------------------------------
${userPrompt}
------------------------------------`);
      
      // Store prompt type in debug object if available
      const debugStorage = getDebugStorage();
      if (debugStorage) {
        debugStorage.promptType = 'USER_GENERAL';
      }
      
      return userPrompt;
    } else {
      console.log(`[PromptService] NOT FOUND: No general quest prompt for user ${userId}`);
    }
  }

  // 4. Use default prompt
  console.log(`[PromptService] No custom prompts found, using default quest prompt for book ${bookId}`);
  console.log(`PROMPT CONTENT (DEFAULT): 
------------------------------------
${DEFAULT_QUEST_GENERATION_PROMPT}
------------------------------------`);
  
  // Store prompt type in debug object if available
  const debugStorage = getDebugStorage();
  if (debugStorage) {
    debugStorage.promptType = 'DEFAULT';
  }
  
  return DEFAULT_QUEST_GENERATION_PROMPT;
}

/**
 * Create a book-specific prompt
 * @param bookId The book ID to create the prompt for
 * @param content The content of the prompt
 * @param createdBy The user ID of the creator
 * @param isGlobal Whether this prompt should be global (true) or user-specific (false)
 * @param title Optional title for the prompt
 * @param notes Optional notes for the prompt
 * @returns The ID of the created prompt
 */
export async function createBookQuestPrompt(
  bookId: string,
  content: string,
  createdBy: string,
  isGlobal: boolean = false,
  title?: string,
  notes?: string
): Promise<string | null> {
  const bookName = `Book ${bookId.substring(0, 8)}`;
  
  try {
    // Add debug logging about the isGlobal parameter
    console.log(`Creating book-specific quest prompt for book ${bookId}, created by ${createdBy}, global: ${isGlobal} (type: ${typeof isGlobal})`);
    
    // First create the prompt record
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .insert({
        name: `Quest Generation for ${bookName}`,
        description: `Book-specific quest generation prompt for ${bookName}`,
        created_by: createdBy,
        is_active: 'true',
        is_global: isGlobal, // Pass boolean directly - no conversion needed
        category: 'quest_generation',
        book_id: bookId
      })
      .select('id')
      .single();

    if (promptError) {
      console.error('Error creating book quest prompt:', promptError);
      throw new Error(`Error creating book quest prompt: ${JSON.stringify(promptError)}`);
    }

    console.log('Book quest prompt created with ID:', promptData.id);

    // Then create the initial prompt version
    const { data: versionData, error: versionError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: promptData.id,
        content,
        version_number: '1',
        created_by: createdBy,
        title: title || `Quest prompt for ${bookName}`,
        notes: notes || 'Initial version'
      })
      .select('id')
      .single();

    if (versionError) {
      console.error('Error creating prompt version:', versionError);
      throw new Error(`Error creating prompt version: ${JSON.stringify(versionError)}`);
    }

    console.log('Book quest prompt version created with ID:', versionData.id);
    
    // If this is a user-specific prompt, assign it to the user
    if (!isGlobal) {
      await assignPromptToUser(createdBy, versionData.id, createdBy);
    }
    
    return promptData.id;
  } catch (error) {
    console.error('Error in createBookQuestPrompt:', error);
    throw error;
  }
}

/**
 * Create a new prompt in the prompts and prompt_versions tables
 * @param name The name of the prompt
 * @param description The description of the prompt
 * @param content The prompt content
 * @param category The category of the prompt (e.g., 'greeting')
 * @param createdBy The user ID of the creator
 * @param isGlobal Whether the prompt is globally available
 * @param title Optional title for the prompt version
 * @param notes Optional notes for the prompt version
 * @returns The ID of the created prompt
 */
export async function createPrompt(
  name: string,
  description: string,
  content: string,
  category: string,
  createdBy: string,
  isGlobal: boolean = false,
  title?: string,
  notes?: string,
  bookId?: string,
  greetingType?: string
): Promise<string | null> {
  try {
    // Debug log to check the isGlobal value and type
    console.log('Creating prompt with:', { 
      name, 
      description, 
      category, 
      createdBy, 
      isGlobal,
      isGlobalType: typeof isGlobal
    });
    
    // First create the prompt record - pass boolean directly since column is boolean type
    const insertData: Record<string, unknown> = {
      name,
      description,
      created_by: createdBy, // Now stored as TEXT, not UUID
      is_active: true, // Use boolean directly for boolean column
      is_global: isGlobal === true, // Use direct boolean comparison
      category
    };
    
    // Add optional fields
    if (bookId) {
      insertData.book_id = bookId;
    }
    if (greetingType) {
      insertData.greeting_type = greetingType;
    }
    
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .insert(insertData)
      .select('id')
      .single();

    if (promptError) {
      console.error('Error creating prompt:', promptError);
      throw new Error(`Error creating prompt: ${JSON.stringify(promptError)}`);
    }

    console.log('Prompt created with ID:', promptData.id);

    // Then create the initial prompt version
    const { data: versionData, error: versionError } = await supabase
      .from('prompt_versions')
      .insert({
        prompt_id: promptData.id,
        content,
        version_number: '1',
        created_by: createdBy, // Now stored as TEXT, not UUID
        title: title || null,
        notes: notes || 'Initial version'
      })
      .select('id')
      .single();

    if (versionError) {
      console.error('Error creating prompt version:', versionError);
      throw new Error(`Error creating prompt version: ${JSON.stringify(versionError)}`);
    }

    console.log('Prompt version created with ID:', versionData.id);
    return promptData.id;
  } catch (error) {
    console.error('Error in createPrompt:', error);
    throw error; // Re-throw to allow better error handling upstream
  }
}

/**
 * Update the global status of an existing prompt
 * This addresses an issue where the is_global flag wasn't being set correctly
 * 
 * @param promptId The ID of the prompt to update
 * @param isGlobal Whether the prompt should be global (true) or user-specific (false)
 * @returns Whether the update was successful
 */
export async function updatePromptGlobalStatus(
  promptId: string,
  isGlobal: boolean
): Promise<boolean> {
  try {
    console.log(`Updating prompt ${promptId} global status to ${isGlobal} (type: ${typeof isGlobal})`);
    
    // Call the dedicated API endpoint for updating the global status
    const response = await fetch('/api/v11/update-prompt-global', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        promptId,
        isGlobal, // Send the boolean value which will be converted to string on the server
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to update prompt global status:', await response.text());
      return false;
    }
    
    const result = await response.json();
    console.log('Update prompt global status result:', result);
    
    return result.success;
  } catch (error) {
    console.error('Error updating prompt global status:', error);
    return false;
  }
}

/**
 * Assign a prompt version to a user
 * @param userId The user ID to assign the prompt to
 * @param promptVersionId The prompt version ID to assign
 * @param assignedBy The user ID of the assigner
 * @returns Whether the assignment was successful
 */
export async function assignPromptToUser(
  userId: string,
  promptVersionId: string,
  assignedBy: string
): Promise<boolean> {
  const DETAILED_LOGGING = true;
  const debugId = Date.now().toString().slice(-6);

  try {
    console.log(`[ASSIGN-PROMPT:${debugId}] Assigning prompt to user:`, {
      userId: typeof userId === 'string' ? `${userId.substring(0, 8)}...` : userId,
      promptVersionId: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 8)}...` : promptVersionId,
      assignedBy: typeof assignedBy === 'string' ? `${assignedBy.substring(0, 8)}...` : assignedBy,
      timestamp: new Date().toISOString()
    });

    // Validate inputs. Only promptVersionId must be a UUID - user_id is TEXT in the database schema
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isPromptVersionIdValid = typeof promptVersionId === 'string' && uuidRegex.test(promptVersionId);
    const isUserIdValid = typeof userId === 'string' && userId.length > 0;

    // Log validation results
    if (DETAILED_LOGGING) {
      console.log(`[ASSIGN-PROMPT:${debugId}] Input Validation:`, {
        userId: {
          type: typeof userId,
          length: userId?.length || 0,
          value: typeof userId === 'string' ? userId : String(userId),
          preview: typeof userId === 'string' ? `${userId.substring(0, 10)}...` : String(userId),
          isValid: isUserIdValid
        },
        promptVersionId: {
          type: typeof promptVersionId,
          length: promptVersionId?.length || 0,
          value: typeof promptVersionId === 'string' ? promptVersionId : String(promptVersionId),
          preview: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 10)}...` : String(promptVersionId),
          isUUID: isPromptVersionIdValid,
          uuidFormat: isPromptVersionIdValid ? 'valid' : 'INVALID',
        },
        assignedBy: {
          type: typeof assignedBy,
          length: assignedBy?.length || 0,
          preview: typeof assignedBy === 'string' ? `${assignedBy.substring(0, 10)}...` : String(assignedBy),
          isStringified: typeof assignedBy === 'string' && assignedBy.includes('{') && assignedBy.includes('}'),
        },
        timestamp: new Date().toISOString()
      });
    }

    // Check for common errors like stringified objects
    if (typeof userId === 'string' && (userId.includes('{') || userId.includes('['))) {
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR: userId appears to be a stringified object or array: ${userId}`);
    }

    if (typeof promptVersionId === 'string' && (promptVersionId.includes('{') || promptVersionId.includes('['))) {
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR: promptVersionId appears to be a stringified object or array: ${promptVersionId}`);
    }

    // Fail early if inputs are invalid
    if (!isUserIdValid) {
      console.error(`[ASSIGN-PROMPT:${debugId}] CRITICAL ERROR: Invalid userId format. Must be a non-empty string.`);
      throw new Error(`Invalid userId format: '${userId}'. Must be a non-empty string.`);
    }

    if (!isPromptVersionIdValid) {
      console.error(`[ASSIGN-PROMPT:${debugId}] CRITICAL ERROR: Invalid promptVersionId format. Must be a valid UUID.`);
      throw new Error(`Invalid promptVersionId format: '${promptVersionId}'. Must be a valid UUID.`);
    }
    
    // Check if this user already has a prompt of this category assigned
    console.log(`[ASSIGN-PROMPT:${debugId}] Fetching prompt version info for id: ${promptVersionId}`);
    const { data: promptInfo, error: promptInfoError } = await supabase
      .from('prompt_versions')
      .select(`
        prompt_id,
        prompts!inner(category)
      `)
      .eq('id', promptVersionId)
      .single();

    if (promptInfoError) {
      // Enhanced error logging
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR fetching prompt version info:`, {
        error: promptInfoError.message,
        details: promptInfoError.details,
        hint: promptInfoError.hint,
        code: promptInfoError.code,
        promptVersionId,
        timestamp: new Date().toISOString()
      });

      // Specific handling for UUID format errors
      if (promptInfoError.message.includes('invalid input syntax for type uuid')) {
        console.error(`[ASSIGN-PROMPT:${debugId}] UUID format error detected in database query:`, {
          parameter: 'promptVersionId',
          value: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 15)}...` : String(promptVersionId),
          error: promptInfoError.message,
          timestamp: new Date().toISOString()
        });
      }

      throw new Error(`Error fetching prompt info: ${JSON.stringify(promptInfoError)}`);
    }

    // Debug log the prompt info structure
    console.log(`[ASSIGN-PROMPT:${debugId}] Prompt info retrieved:`, JSON.stringify(promptInfo, null, 2));

    // Handle the prompts property with type safety
    // Use a type assertion to help TypeScript understand the structure
    let category: string;

    if (promptInfo && promptInfo.prompts) {
      // Handle the case where prompts is an object with a category property
      if (typeof promptInfo.prompts === 'object' && !Array.isArray(promptInfo.prompts) && 'category' in promptInfo.prompts) {
        category = (promptInfo.prompts as { category: string }).category;
      }
      // Handle the case where prompts is an array of objects with category
      else if (Array.isArray(promptInfo.prompts) && promptInfo.prompts.length > 0 &&
               typeof promptInfo.prompts[0] === 'object' && 'category' in promptInfo.prompts[0]) {
        category = (promptInfo.prompts[0] as { category: string }).category;
      }
      else {
        // If we can't find category in the expected places, log and throw
        console.error(`[ASSIGN-PROMPT:${debugId}] ERROR: Unexpected structure for promptInfo.prompts:`, {
          promptsValue: typeof promptInfo.prompts === 'object' ? JSON.stringify(promptInfo.prompts) : promptInfo.prompts,
          promptsType: typeof promptInfo.prompts,
          isArray: Array.isArray(promptInfo.prompts),
          timestamp: new Date().toISOString()
        });
        throw new Error(`Unexpected structure for promptInfo.prompts: ${JSON.stringify(promptInfo.prompts)}`);
      }
    } else {
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR: No prompts property found in prompt info:`, {
        promptInfo: JSON.stringify(promptInfo),
        timestamp: new Date().toISOString()
      });
      throw new Error(`No prompts property found in prompt info: ${JSON.stringify(promptInfo)}`);
    }

    console.log(`[ASSIGN-PROMPT:${debugId}] Detected prompt category: '${category}'`);

    // Verify category against allowed categories
    const allowedCategories = ['greeting', 'ai_instructions', 'insights_system', 'insights_user', 'warm_handoff', 'quest_generation'];
    if (!allowedCategories.includes(category)) {
      console.warn(`[ASSIGN-PROMPT:${debugId}] WARNING: Category '${category}' is not in the allowed list:`, {
        category,
        allowedCategories,
        promptVersionId,
        timestamp: new Date().toISOString()
      });
    }

    // Check for existing assignments in this category
    console.log(`[ASSIGN-PROMPT:${debugId}] Checking for existing assignments for userId: ${userId}, category: ${category}`);
    const { data: existingAssignments, error: existingError } = await supabase
      .from('user_prompt_assignments')
      .select(`
        id,
        prompt_version_id,
        prompt_versions!inner(prompt_id, prompts!inner(category))
      `)
      .eq('user_id', userId)
      .eq('prompt_versions.prompts.category', category);

    if (existingError) {
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR checking existing assignments:`, {
        error: existingError.message,
        details: existingError.details,
        hint: existingError.hint,
        code: existingError.code,
        userId,
        category,
        timestamp: new Date().toISOString()
      });

      // Check for specific database constraint errors
      if (existingError.message.includes('violates foreign key constraint')) {
        console.error(`[ASSIGN-PROMPT:${debugId}] FOREIGN KEY CONSTRAINT ERROR detected:`, {
          userId,
          category,
          error: existingError.message,
          timestamp: new Date().toISOString()
        });
      }

      throw new Error(`Error checking existing assignments: ${JSON.stringify(existingError)}`);
    }

    if (DETAILED_LOGGING) {
      console.log(`[ASSIGN-PROMPT:${debugId}] Existing assignments found: ${existingAssignments?.length || 0}`,
        existingAssignments ? JSON.stringify(existingAssignments.slice(0, 2)) : 'none');
    }

    // ALWAYS create a new assignment to maintain history
    console.log(`[ASSIGN-PROMPT:${debugId}] Creating new prompt assignment to maintain history`);

    // Log exact values being passed to the database for debugging
    console.log(`[ASSIGN-PROMPT:${debugId}] Database insertion parameters:`, {
      user_id: {
        value: userId,
        type: typeof userId,
        length: userId.length
      },
      prompt_version_id: {
        value: promptVersionId,
        type: typeof promptVersionId,
        length: promptVersionId.length
      },
      assigned_by: {
        value: assignedBy,
        type: typeof assignedBy,
        length: assignedBy.length
      },
      timestamp: new Date().toISOString()
    });

    const { data: newAssignment, error: assignError } = await supabase
      .from('user_prompt_assignments')
      .insert({
        user_id: userId,
        prompt_version_id: promptVersionId,
        assigned_by: assignedBy
      })
      .select('id')
      .single();

    if (assignError) {
      console.error(`[ASSIGN-PROMPT:${debugId}] ERROR creating prompt assignment:`, {
        error: assignError.message,
        details: assignError.details,
        hint: assignError.hint,
        code: assignError.code,
        timestamp: new Date().toISOString()
      });

      // Specialized error handling for common database errors
      if (assignError.message.includes('invalid input syntax for type uuid')) {
        console.error(`[ASSIGN-PROMPT:${debugId}] UUID FORMAT ERROR in database insertion:`, {
          userId: typeof userId === 'string' ? `${userId.substring(0, 10)}...` : userId,
          promptVersionId: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 10)}...` : promptVersionId,
          assignedBy: typeof assignedBy === 'string' ? `${assignedBy.substring(0, 10)}...` : assignedBy,
          errorDetails: assignError.message,
          timestamp: new Date().toISOString(),
          guidanceNote: "Check for object serialization issues or invalid UUID formats"
        });
      } else if (assignError.message.includes('violates foreign key constraint')) {
        console.error(`[ASSIGN-PROMPT:${debugId}] FOREIGN KEY CONSTRAINT ERROR in database insertion:`, {
          constraintName: assignError.details?.includes('constraint') ?
                          assignError.details.substring(assignError.details.indexOf('constraint') + 11) : 'unknown',
          error: assignError.message,
          userId,
          promptVersionId,
          timestamp: new Date().toISOString()
        });
      } else if (assignError.message.includes('violates check constraint')) {
        console.error(`[ASSIGN-PROMPT:${debugId}] CHECK CONSTRAINT ERROR in database insertion:`, {
          constraintName: assignError.details?.includes('constraint') ?
                          assignError.details.substring(assignError.details.indexOf('constraint') + 11) : 'unknown',
          error: assignError.message,
          userId,
          promptVersionId,
          timestamp: new Date().toISOString()
        });
      }

      throw new Error(`Error creating prompt assignment: ${JSON.stringify(assignError)}`);
    }

    console.log(`[ASSIGN-PROMPT:${debugId}] SUCCESS: New assignment created with ID: ${newAssignment?.id}`);

    return true;
  } catch (error) {
    // Enhanced error capture in catch block
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ASSIGN-PROMPT:${debugId}] CAUGHT ERROR in assignPromptToUser:`, {
      error: errorMessage,
      errorType: error instanceof Error ? 'Error' : typeof error,
      errorObject: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500) // Limit stack trace size
      } : error,
      timestamp: new Date().toISOString()
    });

    // Special handling for common error patterns
    if (errorMessage.includes('invalid input syntax for type uuid')) {
      console.error(`[ASSIGN-PROMPT:${debugId}] UUID format error detected:`, {
        userId: typeof userId === 'string' ? `${userId.substring(0, 10)}...` : userId,
        promptVersionId: typeof promptVersionId === 'string' ? `${promptVersionId.substring(0, 10)}...` : promptVersionId,
        assignedBy: typeof assignedBy === 'string' ? `${assignedBy.substring(0, 10)}...` : assignedBy,
        uuidErrorDetails: errorMessage,
        timestamp: new Date().toISOString(),
        guidanceNote: "Check for object serialization issues or invalid UUID formats"
      });
    }

    if (errorMessage.includes('violates check constraint')) {
      console.error(`[ASSIGN-PROMPT:${debugId}] Database constraint violation detected:`, {
        errorDetails: errorMessage,
        category: errorMessage.includes('category') ? 'CATEGORY_CONSTRAINT_ISSUE' : 'OTHER_CONSTRAINT',
        message: "The database has a constraint on allowed values. Check category values match allowed list.",
        timestamp: new Date().toISOString()
      });
    }

    // Create a wrapped error with debug ID for easier log correlation
    const wrappedError = new Error(`[ASSIGN-PROMPT:${debugId}] ${errorMessage}`);
    if (error instanceof Error && error.stack) {
      wrappedError.stack = error.stack;
    }

    throw wrappedError; // Re-throw with enhanced context for upstream handling
  }
}
