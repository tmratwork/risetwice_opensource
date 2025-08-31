// src/services/quests.ts
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import { updateQuestProgress } from '@/lib/progress-tracker';
import { getClaudeModel } from '@/config/models';
import fs from 'fs';
import path from 'path';
import { AnyStreamEvent, ContentBlockDeltaEvent, MessageErrorEvent } from '@anthropic/sdk';

// Debug configuration
const DEBUG = {
  TESTING: false,                  // Set to true to enable testing mode
  MAX_BOOK_LENGTH: 5000,          // Max characters to send when testing is true
  LOG_STREAM_CHUNKS: true,        // Log detailed information about stream chunks
  TEST_NUM_QUESTS: 3,             // Number of quests to generate in testing mode
  NORMAL_NUM_QUESTS: 10           // Default number of quests for regular mode (reduced from 20)
};

interface Quest {
  quest_title: string;
  introduction: string;
  challenge: string;
  reward: string;
  starting_question: string;
  ai_prompt?: string;
  chapter_number: number;
  chapter_title: string;
}

interface ChapterInfo {
  chapterNumber: string;
  title: string;
  lineNumber: number;
  nextLineNumber?: number;
  section: string;
}

interface BookStructure {
  bookPath: string;
  totalLines: number;
  chapters: ChapterInfo[];
  [key: string]: unknown;
}

// Special book IDs that need chapter-by-chapter processing
const LARGE_BOOK_IDS = [
  '2b169bda-011b-4834-8454-e30fed95669d',
  '/Users/tmr/github/living_books/src/tools/complete_book.txt'
];

export async function generateQuestsFromBook(book_id: string, userId?: string): Promise<Quest[]> {
  console.log(`[generate_quest] Starting quest generation for book_id: ${book_id}`);
  console.log(`[generate_quest] User ID provided: ${userId || 'None (using default prompt)'}`);
  updateQuestProgress(book_id, 5, 'Initializing quest generation');

  // Check if this is the large book that needs chapter-by-chapter processing
  if (LARGE_BOOK_IDS.includes(book_id)) {
    updateQuestProgress(book_id, 10, 'Processing large book by chapters');
    return await processLargeBookByChapters(book_id);
  }

  // Regular-sized books processing
  updateQuestProgress(book_id, 10, 'Fetching book content and preparing for generation');
  return await processRegularBook(book_id, userId);
}

/**
 * Process a large book by breaking it into chapters and generating one quest per chapter
 */
async function processLargeBookByChapters(book_id: string): Promise<Quest[]> {
  console.log(`[QuestsService] Processing large book (${book_id}) by chapters`);

  try {
    // 1. Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`[QuestsService] Found book "${bookTitle}" (ID: ${book.id}) by ${book.author}`);

    // 2. Load book structure analysis
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    if (!fs.existsSync(structureFilePath)) {
      throw new Error(`Book structure analysis file not found: ${structureFilePath}`);
    }

    const bookStructure: BookStructure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));
    console.log(`[QuestsService] Loaded book structure with ${bookStructure.chapters.length} chapters`);

    // 3. Load the book content
    const bookFilePath = bookStructure.bookPath;
    if (!fs.existsSync(bookFilePath)) {
      throw new Error(`Book content file not found: ${bookFilePath}`);
    }

    const bookContent = fs.readFileSync(bookFilePath, 'utf8');
    const bookLines = bookContent.split('\n');
    console.log(`[QuestsService] Loaded book content with ${bookLines.length} lines`);

    // 4. Get key concepts from Supabase (if available)
    console.log(`[QuestsService] Fetching key concepts from database...`);
    let keyConceptsList = [];

    try {
      const { data: conceptsData, error: conceptsError } = await supabase
        .from('book_concepts')
        .select('concepts')
        .eq('book_id', book_id)
        .single();

      if (!conceptsError && conceptsData && conceptsData.concepts && conceptsData.concepts.key_concepts) {
        keyConceptsList = conceptsData.concepts.key_concepts;
        console.log(`[QuestsService] Found ${keyConceptsList.length} key concepts in database`);
      } else {
        console.log(`[QuestsService] No key concepts found, will generate quests without them`);
      }
    } catch (error) {
      console.log(`[QuestsService] Error fetching key concepts, will proceed without them: ${error}`);
    }

    // 6. Prepare chapters with line ranges
    const chaptersWithRanges = bookStructure.chapters.map((chapter, index) => {
      const nextChapter = bookStructure.chapters[index + 1];
      const nextLineNumber = nextChapter ? nextChapter.lineNumber : bookLines.length + 1;

      return {
        ...chapter,
        nextLineNumber
      };
    });

    // 7. Process each chapter and collect one quest per chapter
    const allQuests: Quest[] = [];
    let processedChapters = 0;
    const failedChapters: { chapter: string, title: string, error: string }[] = [];

    for (const chapter of chaptersWithRanges) {
      console.log(`[QuestsService] Processing Chapter ${chapter.chapterNumber}: ${chapter.title}`);

      // Extract chapter content using line numbers (0-indexed array)
      const startLine = chapter.lineNumber - 1;
      const endLine = chapter.nextLineNumber - 1;
      const chapterContent = bookLines.slice(startLine, endLine).join('\n');

      // Log chapter information
      console.log(`[QuestsService] Chapter ${chapter.chapterNumber} size: ${chapterContent.length} characters`);

      // Filter concepts for this chapter
      const chapterConceptsList = keyConceptsList.filter((concept: { concept: string; description: string }) =>
        concept.concept.startsWith(`[Ch ${chapter.chapterNumber}]`)
      );

      // If no chapter-specific concepts found, use all concepts
      const conceptsToUse = chapterConceptsList.length > 0 ? chapterConceptsList : keyConceptsList;
      console.log(`[QuestsService] Using ${conceptsToUse.length} concepts for this chapter`);

      try {
        // Generate one quest for this chapter
        console.log(`[QuestsService] Generating quest for Chapter ${chapter.chapterNumber}...`);

        const chapterQuest = await generateQuestForChapter(
          bookTitle,
          book.author,
          chapter.title,
          chapter.chapterNumber,
          chapterContent,
          conceptsToUse
        );

        // Add to the collection
        allQuests.push({
          ...chapterQuest,
          chapter_number: parseInt(chapter.chapterNumber, 10),
          chapter_title: chapter.title
        });

        console.log(`[QuestsService] ✅ Generated quest for Chapter ${chapter.chapterNumber}`);
        console.log(`[QuestsService] Quest title: "${chapterQuest.quest_title}"`);
        console.log(`[QuestsService] Introduction: "${chapterQuest.introduction}"`);
        console.log(`[QuestsService] Challenge: "${chapterQuest.challenge}"`);
        console.log(`[QuestsService] Reward: "${chapterQuest.reward}"`);
        console.log(`[QuestsService] Starting question: "${chapterQuest.starting_question}"`);

        // Log progress
        processedChapters++;
        console.log(`[QuestsService] Completed ${processedChapters}/${chaptersWithRanges.length} chapters`);
      } catch (error) {
        console.error(`[QuestsService] Error processing chapter ${chapter.chapterNumber}:`, error);
        console.log(`[QuestsService] Continuing with next chapter...`);

        // Track failed chapters for reporting
        failedChapters.push({
          chapter: chapter.chapterNumber,
          title: chapter.title,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 8. Store the quests in Supabase
    console.log(`[QuestsService] Storing ${allQuests.length} quests in database...`);
    const storageResult = await storeQuestsInSupabase(book.id, bookTitle, allQuests);

    // 9. Log final results
    console.log(`[QuestsService] ========== LARGE BOOK PROCESSING COMPLETE ==========`);
    console.log(`[QuestsService] Book: "${bookTitle}" (ID: ${book.id})`);
    console.log(`[QuestsService] Total chapters processed: ${processedChapters}/${chaptersWithRanges.length}`);
    console.log(`[QuestsService] Total quests generated: ${allQuests.length}`);
    console.log(`[QuestsService] Failed chapters: ${failedChapters.length}`);
    if (failedChapters.length > 0) {
      console.log(`[QuestsService] Failed chapter details:`);
      failedChapters.forEach(fc => {
        console.log(`[QuestsService]   - Chapter ${fc.chapter}: ${fc.title} - Error: ${fc.error}`);
      });
    }
    console.log(`[QuestsService] Storage operation: ${storageResult.operation}`);
    console.log(`[QuestsService] =======================================`);

    return allQuests;
  } catch (error) {
    console.error('[QuestsService] Error processing large book by chapters:', error);

    // Throw a clear error with details
    throw new Error(`Failed to process large book by chapters: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a quest for a specific chapter using Claude
 */
async function generateQuestForChapter(
  bookTitle: string,
  bookAuthor: string,
  chapterTitle: string,
  chapterNumber: string,
  chapterContent: string,
  keyConceptsList: Array<{ concept: string, description: string }>
): Promise<Quest> {
  let conceptsSection = '';
  if (keyConceptsList.length > 0) {
    conceptsSection = `## Key Concepts to Focus On
${keyConceptsList.map(concept => `- ${concept.concept}: ${concept.description}`).join('\n')}`;
  } else {
    conceptsSection = `## Note on Key Concepts
No predefined key concepts are available for this chapter. Please identify the most important themes, ideas, and concepts from the chapter content provided and create an educational quest around them.`;
  }

  const prompt = `
  You're creating educational quests based on "${bookTitle}" by ${bookAuthor}. For Chapter ${chapterNumber}: ${chapterTitle}, create a conversational quest that helps learners apply and practice key concepts from this chapter.

  ## Chapter Content
  ${chapterContent.substring(0, DEBUG.TESTING ? Math.min(5000, chapterContent.length) : 30000)}

  ${conceptsSection}

  After reviewing the chapter content, respond with:

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

  Keep everything in simple, conversational language appropriate for learners. Avoid technical jargon and focus on making the concept relatable and interesting.

  ## Output Format
  Return your response in this exact JSON format (no additional text before or after):
  
  {
    "quest_title": "The title of the quest",
    "introduction": "2-3 sentences explaining the concept",
    "challenge": "Description of the challenge",
    "reward": "What badge or achievement they'll earn",
    "starting_question": "An open-ended question to start the journey",
    "ai_prompt": "Detailed instructions for AI to help with this quest"
  }
  `;

  try {
    console.log(`[QuestsService] Sending streaming request to Claude to generate quest for Chapter ${chapterNumber}...`);

    // Use streaming API to avoid timeout for large responses
    let stream;
    try {
      stream = await anthropic.messages.stream({
        model: getClaudeModel(),
        max_tokens: 4000,
        temperature: 0.5,
        system: "You are an AI assistant specialized in creating engaging educational quests for learners based on books of any type. You create simple, conversational challenges that make complex concepts accessible and practical. You MUST return ONLY valid JSON with no explanatory text before or after it.",
        messages: [
          { role: "user", content: prompt }
        ],
      });
    } catch (streamError) {
      console.error(`[QuestsService] Error initializing stream for chapter ${chapterNumber}: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
      throw new Error(`Failed to initialize stream for chapter ${chapterNumber}: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
    }

    // Collect response chunks into a complete text
    let responseText = '';
    let chunkCount = 0;
    const startTime = Date.now();

    try {
      // Process stream chunks
      for await (const chunk of stream) {
        // Type-guard to handle different event types
        const eventChunk = chunk as AnyStreamEvent;
        const chunkType = eventChunk.type;

        // Log detailed chunk info if debug logging is enabled
        if (DEBUG.LOG_STREAM_CHUNKS) {
          let deltaType = 'N/A';
          if (chunkType === 'content_block_delta' && 'delta' in eventChunk) {
            const deltaChunk = eventChunk as ContentBlockDeltaEvent;
            deltaType = deltaChunk.delta.type;
          }

          console.log(`[QuestsService] Chapter ${chapterNumber} stream chunk type: ${chunkType}, delta type: ${deltaType}`);
        }

        if (chunkType === 'content_block_delta') {
          // Safe to cast here since we've checked the type
          const deltaChunk = eventChunk as ContentBlockDeltaEvent;
          if (deltaChunk.delta.type === 'text_delta') {
            responseText += deltaChunk.delta.text;
            chunkCount++;

            // Log progress less frequently for chapter quests
            if (chunkCount % 50 === 0) {
              console.log(`[QuestsService] Chapter ${chapterNumber}: Received ${chunkCount} chunks (${responseText.length} chars) in ${Math.floor((Date.now() - startTime) / 1000)}s`);
            }
          }
        } else if (chunkType === 'error') {
          // Safe to cast here since we've checked the type
          const errorChunk = eventChunk as unknown as MessageErrorEvent;
          console.error(`[QuestsService] Stream error for chapter ${chapterNumber}: ${errorChunk.error}`);
          throw new Error(`Stream error for chapter ${chapterNumber}: ${errorChunk.error}`);
        }
      }

      // Validate that we received a non-empty response
      if (!responseText.trim()) {
        throw new Error(`Received empty response from Claude streaming API for chapter ${chapterNumber}`);
      }

      console.log(`[QuestsService] Chapter ${chapterNumber} streaming complete. Received ${chunkCount} chunks totaling ${responseText.length} characters in ${Math.floor((Date.now() - startTime) / 1000)}s`);
    } catch (streamProcessError) {
      console.error(`[QuestsService] Error processing stream for chapter ${chapterNumber}: ${streamProcessError instanceof Error ? streamProcessError.message : String(streamProcessError)}`);
      throw new Error(`Error processing stream for chapter ${chapterNumber}: ${streamProcessError instanceof Error ? streamProcessError.message : String(streamProcessError)}`);
    }

    // Extract JSON from the response
    let jsonString = responseText;

    // Find JSON boundaries if Claude added explanatory text
    const jsonStartMatch = responseText.match(/(\{)/);
    const jsonEndMatch = responseText.match(/(\})(?=[^\{\}]*$)/);

    if (jsonStartMatch && jsonEndMatch && jsonStartMatch.index !== undefined && jsonEndMatch.index !== undefined) {
      const startIndex = jsonStartMatch.index;
      const endIndex = jsonEndMatch.index + 1;
      jsonString = responseText.substring(startIndex, endIndex);
      console.log(`[QuestsService] Extracted JSON object from Claude response`);
    }

    // Parse the response JSON
    try {
      const quest = JSON.parse(jsonString) as Quest;
      console.log(`[QuestsService] Successfully parsed quest from Claude response`);
      return quest;
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error(`[QuestsService] Error parsing Claude response: ${errorMessage}`);
      console.error(`[QuestsService] Problematic JSON string (first 200 chars):`, jsonString.substring(0, 200));
      throw new Error(`Failed to parse quest response: ${errorMessage}`);
    }
  } catch (error) {
    console.error(`[QuestsService] Error generating quest:`, error);
    throw new Error(`Failed to generate quest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface StorageResult {
  operation: 'create_table' | 'insert' | 'update';
  recordId?: string;
}

interface ErrorWithJsonContext extends Error {
  rawJson: string;
  jsonPreview: string;
}

/**
 * Process a regular-sized book by generating 20 quests
 * @param book_id The ID of the book to process
 * @param userId Optional user ID to fetch custom prompt
 */
async function processRegularBook(book_id: string, userId?: string): Promise<Quest[]> {
  console.log(`[QuestsService] Processing regular book (${book_id}) - will generate ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} quests`);

  try {
    // 1. Get book metadata from Supabase
    updateQuestProgress(book_id, 15, 'Fetching book details');
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`[QuestsService] Found book "${bookTitle}" (ID: ${book.id}) by ${book.author}`);
    updateQuestProgress(book_id, 20, `Found book "${bookTitle}" by ${book.author}`);

    // 2. Get book content from Supabase
    updateQuestProgress(book_id, 25, 'Fetching book content');
    const { data: contentData, error: contentError } = await supabase
      .from('books_v2')
      .select('content')
      .eq('id', book_id)
      .maybeSingle();

    if (contentError) {
      throw new Error(`Error fetching book content: ${contentError.message}`);
    }

    if (!contentData || !contentData.content) {
      throw new Error(`No content found for this book. Please ensure the book is properly uploaded.`);
    }

    const bookContent = contentData.content;
    console.log(`[QuestsService] Loaded book content with ${bookContent.length} characters`);
    updateQuestProgress(book_id, 30, `Loaded book content (${bookContent.length} characters)`);

    // 3. Get key concepts from Supabase (if available)
    updateQuestProgress(book_id, 35, 'Fetching key concepts');
    console.log(`[QuestsService] Fetching key concepts from database...`);
    let keyConceptsList = [];

    try {
      const { data: conceptsData, error: conceptsError } = await supabase
        .from('book_concepts')
        .select('concepts')
        .eq('book_id', book_id)
        .single();

      if (!conceptsError && conceptsData && conceptsData.concepts && conceptsData.concepts.key_concepts) {
        keyConceptsList = conceptsData.concepts.key_concepts;
        console.log(`[QuestsService] Found ${keyConceptsList.length} key concepts in database`);
        updateQuestProgress(book_id, 38, `Found ${keyConceptsList.length} key concepts`);
      } else {
        console.log(`[QuestsService] No key concepts found, will generate quests without them`);
        updateQuestProgress(book_id, 38, 'No key concepts found, will generate quests without them');
      }
    } catch (error) {
      console.log(`[QuestsService] Error fetching key concepts, will proceed without them: ${error}`);
      updateQuestProgress(book_id, 38, 'Error fetching key concepts, will proceed without them');
    }

    // 4. Get the appropriate quest generation prompt
    // Import from lib/prompts here to avoid circular dependencies
    const { getEffectiveQuestPrompt } = await import('@/lib/prompts');

    // Debug mode from environment variable
    const DEBUG_MODE = process.env.DEBUG_PROMPT_SELECTION === 'true';

    updateQuestProgress(book_id, 39, 'Fetching quest generation prompt');
    console.log(`[QuestsService] Fetching appropriate quest generation prompt...`);
    console.log(`[QuestsService] Debug mode: ${DEBUG_MODE ? 'ENABLED' : 'disabled'}`);

    // Debug: Log relevant information about the database tables
    if (DEBUG_MODE) {
      console.log(`[QuestsService] [DEBUG] Starting database analysis for prompt tables...`);

      try {
        // 1. Check prompts table for this book ID
        console.log(`[QuestsService] [DEBUG] 1. Checking prompts table for book_id=${book_id}`);
        const { data: bookPrompts, error: bookPromptsError } = await supabase
          .from('prompts')
          .select('id, name, category, book_id, is_global, created_by, created_at')
          .eq('book_id', book_id);

        if (bookPromptsError) {
          console.error(`[QuestsService] [DEBUG] Error checking prompts table:`, bookPromptsError);
        } else {
          console.log(`[QuestsService] [DEBUG] Found ${bookPrompts?.length || 0} prompts for this book:`);
          if (bookPrompts && bookPrompts.length > 0) {
            bookPrompts.forEach((prompt, i) => {
              console.log(`[QuestsService] [DEBUG] Prompt ${i + 1}:`, JSON.stringify(prompt, null, 2));
            });
          }
        }

        // 2. Check quest_generation prompts specifically
        console.log(`[QuestsService] [DEBUG] 2. Checking for quest_generation prompts:`);
        const { data: questPrompts, error: questPromptsError } = await supabase
          .from('prompts')
          .select('id, name, category, book_id, is_global, created_by, created_at')
          .eq('category', 'quest_generation');

        if (questPromptsError) {
          console.error(`[QuestsService] [DEBUG] Error checking quest prompts:`, questPromptsError);
        } else {
          console.log(`[QuestsService] [DEBUG] Found ${questPrompts?.length || 0} quest_generation prompts:`);
          if (questPrompts && questPrompts.length > 0) {
            questPrompts.forEach((prompt, i) => {
              console.log(`[QuestsService] [DEBUG] Quest Prompt ${i + 1}:`, JSON.stringify(prompt, null, 2));
            });
          }
        }

        // 3. If a userId is provided, check for this user's prompt assignments
        if (userId) {
          console.log(`[QuestsService] [DEBUG] 3. Checking user_prompt_assignments for userId=${userId}`);
          const { data: userAssignments, error: userAssignmentsError } = await supabase
            .from('user_prompt_assignments')
            .select(`
              id, 
              user_id, 
              prompt_version_id,
              assigned_at,
              prompt_versions!inner(
                id,
                prompt_id,
                prompts!inner(
                  category,
                  book_id
                )
              )
            `)
            .eq('user_id', userId);

          if (userAssignmentsError) {
            console.error(`[QuestsService] [DEBUG] Error checking user assignments:`, userAssignmentsError);
          } else {
            console.log(`[QuestsService] [DEBUG] Found ${userAssignments?.length || 0} assignments for this user:`);
            if (userAssignments && userAssignments.length > 0) {
              userAssignments.forEach((assignment, i) => {
                console.log(`[QuestsService] [DEBUG] Assignment ${i + 1}:`, JSON.stringify(assignment, null, 2));
              });
            }
          }
        }

        console.log(`[QuestsService] [DEBUG] Database analysis complete.`);
      } catch (dbError) {
        console.error(`[QuestsService] [DEBUG] Error during database analysis:`, dbError);
      }
    }

    let promptTemplate;
    try {
      // Call the prompt selection cascade
      promptTemplate = await getEffectiveQuestPrompt(
        book_id,
        book.title,
        book.author,
        userId
      );

      console.log(`[generate_quest] Successfully fetched quest generation prompt`);
      console.log(`[generate_quest] ===== AI PROMPT BEING USED =====`);
      console.log(`[generate_quest] Prompt length: ${promptTemplate.length} characters`);
      console.log(`[generate_quest] Full AI prompt:`);
      console.log(promptTemplate);
      console.log(`[generate_quest] ===== END AI PROMPT =====`);

      // If in debug mode, stop here
      if (DEBUG_MODE) {
        console.log(`[generate_quest] [DEBUG] Breaking execution before Claude API call`);
        console.log(`[generate_quest] [DEBUG] Selected prompt preview (first 200 chars):`);
        console.log(promptTemplate.substring(0, 200) + '...');

        // In debug mode, save the prompt to a file for inspection
        const debugDir = path.join(process.cwd(), 'debug');

        // Create debug directory if it doesn't exist
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        // Save prompt to file with book ID and timestamp
        const promptDebugFile = path.join(debugDir, `prompt_debug_${book_id.substring(0, 8)}_${Date.now()}.txt`);
        fs.writeFileSync(promptDebugFile, promptTemplate);
        console.log(`[QuestsService] [DEBUG] Full prompt saved to ${promptDebugFile}`);

        // Return mock quests to avoid Claude API call
        console.log(`[generate_quest] [DEBUG] Returning mock quests without calling Claude API`);
        return Array(10).fill({}).map((_, i) => ({
          quest_title: `Debug Quest ${i + 1}`,
          introduction: "This is a debug quest introduction.",
          challenge: "This is a debug quest challenge.",
          reward: "Debug badge",
          starting_question: "Debug starting question?",
          ai_prompt: "Debug AI prompt",
          chapter_number: 0,
          chapter_title: "Debug Chapter"
        }));
      }

      updateQuestProgress(book_id, 40, 'Retrieved quest generation prompt');
    } catch (error) {
      console.error(`[QuestsService] Error fetching prompt, will use default:`, error);
      // Default template is already included in getEffectiveQuestPrompt so this shouldn't happen
      throw new Error(`Failed to fetch prompt: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 5. Generate quests for the entire book
    console.log(`[generate_quest] Generating ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} quests for the entire book...`);
    console.log(`[generate_quest] Calling Claude API with prompt template`);
    updateQuestProgress(book_id, 45, `Generating ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} quests using AI`);

    const quests = await generateQuestsForRegularBook(
      book.title,
      book.author,
      bookContent,
      keyConceptsList,
      book_id,
      userId, // Pass the userId to the quest generation function
      promptTemplate // Pass the fetched prompt template
    );

    console.log(`[generate_quest] Successfully generated ${quests.length} quests from Claude API`);

    // 6. Store the quests in Supabase
    console.log(`[generate_quest] Storing ${quests.length} quests in database...`);
    updateQuestProgress(book_id, 90, `Storing ${quests.length} quests in database`);
    const storageResult = await storeQuestsInSupabase(book.id, bookTitle, quests);
    console.log(`[generate_quest] Successfully stored quests in database`);

    // 7. Log final results
    console.log(`[generate_quest] ========== REGULAR BOOK PROCESSING COMPLETE ==========`);
    console.log(`[generate_quest] Book: "${bookTitle}" (ID: ${book.id})`);
    console.log(`[generate_quest] Total quests generated: ${quests.length}`);
    console.log(`[generate_quest] Storage operation: ${storageResult.operation}`);
    console.log(`[generate_quest] =======================================`);

    updateQuestProgress(book_id, 95, 'Finishing up and returning results');

    return quests;
  } catch (error) {
    console.error('[QuestsService] Error processing regular book:', error);

    // Throw a clear error with details
    throw new Error(`Failed to process regular book: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate quests for a regular-sized book using Claude
 * @param bookTitle The title of the book
 * @param bookAuthor The author of the book
 * @param bookContent The content of the book
 * @param keyConceptsList Array of key concepts from the book
 * @param bookId The ID of the book for progress tracking
 * @param userId Optional user ID to fetch custom prompt
 * @param promptTemplate The prompt template to use (from cascade selection)
 */
async function generateQuestsForRegularBook(
  bookTitle: string,
  bookAuthor: string,
  bookContent: string,
  keyConceptsList: Array<{ concept: string, description: string }>,
  bookId: string, // Book ID for progress tracking
  userId?: string, // Optional user ID for custom prompt
  promptTemplate?: string // Optional prompt template from cascade selection
): Promise<Quest[]> {
  // Debug mode from environment variable
  // Use uppercase for consistency with other debug flags
  const DEBUG_MODE = process.env.DEBUG_PROMPT_SELECTION === 'true';

  // Ensure debug logs are clearly marked for the preprocessing page
  if (DEBUG_MODE) {
    console.log(`[QuestsService] DEBUG MODE ENABLED for book ID: ${bookId}`);
    console.log(`[QuestsService] Will provide detailed logs and skip Claude API call`);

    console.log(`[QuestsService] [DEBUG-GENERATE] Starting quest generation with debug mode ENABLED`);
    console.log(`[QuestsService] [DEBUG-GENERATE] Book: "${bookTitle}" by ${bookAuthor}`);
    console.log(`[QuestsService] [DEBUG-GENERATE] bookId: ${bookId}`);
    console.log(`[QuestsService] [DEBUG-GENERATE] userId: ${userId || 'not provided'}`);

    // Log whether we have a prompt template
    if (promptTemplate) {
      console.log(`[QuestsService] [DEBUG-GENERATE] Custom prompt template provided: ${promptTemplate.substring(0, 100)}...`);
    } else {
      console.log(`[QuestsService] [DEBUG-GENERATE] NO custom prompt template provided, will use default`);
    }
  }

  // Limit book content based on testing mode
  const contentLength = bookContent.length;

  // Use DEBUG.MAX_BOOK_LENGTH if in testing mode, otherwise use normal max length
  const maxBookLength = DEBUG.TESTING ? DEBUG.MAX_BOOK_LENGTH : 600000;
  const truncatedContent = bookContent.substring(0, maxBookLength);

  // Warn if content was truncated
  if (contentLength > maxBookLength) {
    console.log(`[QuestsService] WARNING: Book content truncated from ${contentLength} to ${maxBookLength} characters for processing`);
    if (DEBUG.TESTING) {
      console.log(`[QuestsService] TESTING MODE: Using reduced content size of ${maxBookLength} characters`);
    }
  }

  let conceptsSection = '';
  if (keyConceptsList.length > 0) {
    conceptsSection = `## Key Concepts to Focus On
${keyConceptsList.map(concept => `- ${concept.concept}: ${concept.description}`).join('\n')}`;
  } else {
    conceptsSection = `## Note on Key Concepts
No predefined key concepts are available for this book. Please identify the most important themes, ideas, and concepts from the book content provided and create educational quests around them.`;
  }

  // Default prompt template if none provided (this shouldn't happen with the new cascade logic)
  const defaultPrompt = `
  You're creating educational quests based on "${bookTitle}" by ${bookAuthor}. Create ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} conversational quests that help learners apply and practice key concepts from this book.

  ## Book Content (First Section)
  ${truncatedContent}

  ${conceptsSection}

  After reviewing the book content, create ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} different quests. Each quest should focus on a different concept or insight from the book. For each quest, provide:

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

  // Use provided prompt template if available, otherwise fall back to default
  const templateToUse = promptTemplate || defaultPrompt;

  if (DEBUG_MODE) {
    // Compare lengths to see if defaultPrompt was used
    if (templateToUse === defaultPrompt) {
      console.log(`[QuestsService] [DEBUG-GENERATE] Using DEFAULT prompt template`);
    } else {
      console.log(`[QuestsService] [DEBUG-GENERATE] Using CUSTOM prompt template from cascade selection`);
    }
  }

  // Number of quests needed for this prompt
  const numQuestsNeeded = DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS;

  // Create instruction to generate specific number of quests
  const numberInstruction = `# IMPORTANT: Generate exactly ${numQuestsNeeded} different quests in total, following all instructions below.\n\n`;

  // Add debug logging to see what we're working with
  console.log(`[QuestsService] DEBUG: templateToUse.length: ${templateToUse.length}`);
  console.log(`[QuestsService] DEBUG: templateToUse first 50 chars: "${templateToUse.substring(0, 50)}"`);
  console.log(`[QuestsService] DEBUG: numberInstruction: "${numberInstruction}"`);

  // Apply substitutions to the template and add number instruction at the top
  const prompt = numberInstruction + templateToUse
    .replace(/{{BOOK_TITLE}}/g, bookTitle)
    .replace(/{{BOOK_AUTHOR}}/g, bookAuthor)
    .replace(/{{BOOK_CONTENT}}/g, truncatedContent)
    .replace(/{{KEY_CONCEPTS}}/g, conceptsSection)
    .replace(/{{NUM_QUESTS}}/g, String(numQuestsNeeded));

  // Debug the first 100 characters of the final prompt
  console.log(`[QuestsService] DEBUG: Final prompt (first 100 chars): "${prompt.substring(0, 100)}"`);

  // Debug the step before final stream call
  console.log(`[QuestsService] Preparing to send prompt of ${prompt.length} characters to Claude...`);

  // In debug mode, save the fully prepared prompt
  if (DEBUG_MODE) {
    console.log(`[QuestsService] [DEBUG-GENERATE] Final prompt prepared with substitutions`);
    console.log(`[QuestsService] [DEBUG-GENERATE] First 200 chars of prompt:`);
    console.log(prompt.substring(0, 200) + "...");

    // Save the full prompt to a file
    try {
      const debugDir = path.join(process.cwd(), 'debug');

      // Create debug directory if it doesn't exist
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }

      // Save full prompt to file with book ID and timestamp
      const promptFullFile = path.join(debugDir, `prompt_full_${bookId.substring(0, 8)}_${Date.now()}.txt`);
      fs.writeFileSync(promptFullFile, prompt);
      console.log(`[QuestsService] [DEBUG-GENERATE] Full prompt with substitutions saved to ${promptFullFile}`);
    } catch (fsError) {
      console.error(`[QuestsService] [DEBUG-GENERATE] Error saving full prompt to file:`, fsError);
    }
  }

  try {
    console.log(`[generate_quest] Sending streaming request to Claude to generate ${DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS} quests...`);
    console.log(`[generate_quest] Model: claude-sonnet-4-20250514`);
    console.log(`[generate_quest] Max tokens: 32000`);
    console.log(`[generate_quest] Temperature: 0.7`);
    updateQuestProgress(bookId, 45, 'Sending request to Claude AI');

    // Debug mode - stop here before calling Claude API
    if (DEBUG_MODE) {
      console.log(`[QuestsService] [DEBUG-GENERATE] DEBUG MODE ENABLED - Breaking before Claude API call`);
      console.log(`[QuestsService] [DEBUG-GENERATE] Would have sent request to Claude to generate quests`);
      console.log(`[QuestsService] [DEBUG-GENERATE] To make the actual API call, set DEBUG_PROMPT_SELECTION=false in .env.development`);

      // Generate mock quests
      console.log(`[QuestsService] [DEBUG-GENERATE] Returning mock quests without calling Claude API`);
      const mockQuests = Array(10).fill({}).map((_, i) => ({
        quest_title: `Debug Quest ${i + 1} for ${bookTitle}`,
        introduction: "This is a debug quest introduction.",
        challenge: "This is a debug quest challenge. The actual API call was skipped as DEBUG_PROMPT_SELECTION=true.",
        reward: "Debug Badge of Prompt Testing",
        starting_question: "Would you like to test the actual API by setting DEBUG_PROMPT_SELECTION=false?",
        ai_prompt: "Debug AI prompt - this is simulated quest content.",
        chapter_number: 0,
        chapter_title: "Debug Chapter (API call skipped)"
      }));

      return mockQuests;
    }

    // Use streaming API to avoid timeout for large responses
    let stream;
    try {
      // Check if the prompt appears to be for single quest format
      const isSingleQuestFormat = prompt.includes('AI_instructions:') ||
        !prompt.includes('"quests": [') ||
        prompt.includes('questTitle:');

      // Check if we need multiple quests to meet our target
      const numQuestsNeeded = DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS;

      if (isSingleQuestFormat && numQuestsNeeded > 1) {
        console.log(`[QuestsService] Detected single quest format prompt but need ${numQuestsNeeded} quests`);
        console.log(`[QuestsService] Continuing with single quest response - consider updating prompt to return multiple quests`);
      }

      // Log if we're using our instruction
      console.log(`[QuestsService] DEBUG: Has instruction been added? ${prompt.startsWith('# IMPORTANT: Generate exactly') ? 'YES' : 'NO'}`);

      // Always use system message that allows multiple quests and prevents Markdown code blocks
      const systemMessage = "You are an AI assistant specialized in creating engaging educational quests for learners. You create simple, conversational challenges that make complex concepts accessible and practical. You MUST return ONLY valid JSON with no explanatory text, markdown formatting, or code block syntax (like ```json or ```) before or after it. The response should be PLAIN JSON text only. IMPORTANT: Follow the format instructions in the prompt exactly.";

      console.log(`[QuestsService] Detected prompt format: ${isSingleQuestFormat ? 'single quest' : 'multiple quests array'}`);
      console.log(`[QuestsService] DEBUG: systemMessage: "${systemMessage}"`);

      console.log(`[generate_quest] Making Claude API call with ${prompt.length} character prompt`);
      stream = await anthropic.messages.stream({
        model: getClaudeModel(),
        max_tokens: 32000, // Using the actual max supported value
        temperature: 0.7,
        system: systemMessage,
        messages: [
          { role: "user", content: prompt }
        ],
      });
      console.log(`[generate_quest] Claude API stream initialized successfully`);
    } catch (streamError) {
      console.error(`[QuestsService] Error initializing stream: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
      throw new Error(`Failed to initialize stream: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
    }

    // Collect response chunks into a complete text
    let responseText = '';
    let chunkCount = 0;
    const startTime = Date.now();

    try {
      // Process stream chunks
      for await (const chunk of stream) {
        // Type-guard to handle different event types
        const eventChunk = chunk as AnyStreamEvent;
        const chunkType = eventChunk.type;

        // Log detailed chunk info if debug logging is enabled
        if (DEBUG.LOG_STREAM_CHUNKS) {
          // Only log once at the start of streaming
          if (chunkCount === 0) {
            console.log(`[QuestsService] Starting AI response streaming...`);

            // Log the chunk type if available
            if (chunkType === 'content_block_delta' && 'delta' in eventChunk) {
              const deltaChunk = eventChunk as ContentBlockDeltaEvent;
              console.log(`[QuestsService] First chunk delta type: ${deltaChunk.delta.type}`);
            }
          }
        }

        if (chunkType === 'content_block_delta') {
          // Safe to cast here since we've checked the type
          const deltaChunk = eventChunk as ContentBlockDeltaEvent;
          if (deltaChunk.delta.type === 'text_delta') {
            responseText += deltaChunk.delta.text;
            chunkCount++;

            // Only log at major milestones (25%, 50%, 75%)
            const estimatedTotalChunks = 3000;
            const aiProgressPercentage = Math.min(Math.floor((chunkCount / estimatedTotalChunks) * 100), 95);
            const progressPercentage = 45 + Math.floor(aiProgressPercentage * 0.4); // Map 0-100 to 45-85

            // Update progress tracker without logging
            updateQuestProgress(bookId, progressPercentage, `Generating quests: ${aiProgressPercentage}% complete`);

            // Only log at significant milestones to reduce verbosity
            if (aiProgressPercentage === 25 || aiProgressPercentage === 50 ||
              aiProgressPercentage === 75 || aiProgressPercentage === 95) {
              console.log(`[QuestsService] AI Generation: ${aiProgressPercentage}% complete (${Math.floor((Date.now() - startTime) / 1000)}s)`);
            }
          }
        } else if (chunkType === 'error') {
          // Safe to cast here since we've checked the type
          const errorChunk = eventChunk as unknown as MessageErrorEvent;
          console.error(`[QuestsService] Stream error: ${errorChunk.error}`);
          throw new Error(`Stream error: ${errorChunk.error}`);
        }
      }

      // Validate that we received a non-empty response
      if (!responseText.trim()) {
        throw new Error('Received empty response from Claude streaming API');
      }

      // Log completion with summary details
      console.log(`[generate_quest] AI Generation complete: received ${responseText.length} characters in ${Math.floor((Date.now() - startTime) / 1000)}s`);

      // Log the full response from Claude for debugging
      console.log(`[generate_quest] ===== CLAUDE API RESPONSE =====`);
      console.log(`[generate_quest] Response length: ${responseText.length} characters`);
      console.log(`[generate_quest] Full Claude response:`);
      console.log(responseText);
      console.log(`[generate_quest] ===== END CLAUDE RESPONSE =====`);

      updateQuestProgress(bookId, 85, 'AI generation complete, processing results');

      // Log whether our instruction appears to have been effective
      if (responseText.includes('[{') || responseText.includes('"quests":') ||
        (responseText.includes('questTitle') && responseText.includes('AI_instructions') && (responseText.match(/\{/g)?.length ?? 0) > 1)) {
        console.log(`[QuestsService] DEBUG: Response appears to contain multiple quests, instruction likely worked`);
      } else if (responseText.includes('questTitle') || responseText.includes('AI_instructions')) {
        console.log(`[QuestsService] DEBUG: Response appears to be a single quest, instruction may not have been effective`);
      }
    } catch (streamProcessError) {
      console.error(`[QuestsService] Error processing stream: ${streamProcessError instanceof Error ? streamProcessError.message : String(streamProcessError)}`);
      throw new Error(`Error processing stream: ${streamProcessError instanceof Error ? streamProcessError.message : String(streamProcessError)}`);
    }

    // Extract JSON from the response
    let jsonString = responseText;

    // Check for code blocks and strip them if present
    if (jsonString.includes('```')) {
      console.log(`[QuestsService] Detected code block syntax in response, cleaning up...`);
      // Remove ```json and ``` markers
      jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      console.log(`[QuestsService] Cleaned response of code block syntax`);
    }

    // Find JSON boundaries if Claude added explanatory text
    let jsonStartMatch;
    let jsonEndMatch;

    // Check if response might be an array
    if (jsonString.trim().startsWith('[')) {
      jsonStartMatch = jsonString.match(/(\[)/);
      jsonEndMatch = jsonString.match(/(\])(?=[^\[\]]*$)/);
      console.log(`[QuestsService] Detected array format response`);
    } else {
      // Original object detection
      jsonStartMatch = jsonString.match(/(\{)/);
      jsonEndMatch = jsonString.match(/(\})(?=[^\{\}]*$)/);
      console.log(`[QuestsService] Detected object format response`);
    }

    if (jsonStartMatch && jsonEndMatch && jsonStartMatch.index !== undefined && jsonEndMatch.index !== undefined) {
      const startIndex = jsonStartMatch.index;
      const endIndex = jsonEndMatch.index + 1;
      jsonString = jsonString.substring(startIndex, endIndex);
      console.log(`[QuestsService] Extracted JSON from response (${jsonString.length} chars)`);
    }

    // Check if we need to generate additional quests for a single quest format
    const isSingleQuestFormat = prompt.includes('AI_instructions:') ||
      !prompt.includes('"quests": [') ||
      prompt.includes('questTitle:');
    const numQuestsNeeded = DEBUG.TESTING ? DEBUG.TEST_NUM_QUESTS : DEBUG.NORMAL_NUM_QUESTS;

    // Parse the response JSON - throw clear errors if parsing fails
    try {
      const parsedResponse = JSON.parse(jsonString);
      console.log(`[generate_quest] Successfully parsed JSON response`);
      console.log(`[generate_quest] ===== PARSED JSON STRUCTURE =====`);
      console.log(JSON.stringify(parsedResponse, null, 2));
      console.log(`[generate_quest] ===== END PARSED JSON =====`);

      // Log the keys in the parsed object to help debug
      console.log(`[generate_quest] Keys in parsed response: ${Object.keys(parsedResponse).join(', ')}`);

      let quests;

      // Check if we got the expected structure with quests array in standard format
      if (parsedResponse.quests && Array.isArray(parsedResponse.quests)) {
        // Standard format with quests array
        quests = parsedResponse.quests;
        console.log(`[QuestsService] Successfully parsed ${quests.length} quests from AI response (standard format)`);
      }
      // Check if response is an array of quests in the custom format
      else if (Array.isArray(parsedResponse) && parsedResponse.length > 0 &&
        (parsedResponse[0].questTitle || parsedResponse[0].quest_title)) {
        // Array of quests in custom format
        console.log(`[QuestsService] Detected array of ${parsedResponse.length} quests in custom format`);

        // Standardize each quest in the array
        quests = parsedResponse.map(questItem => ({
          quest_title: questItem.quest_title || questItem.questTitle,
          introduction: questItem.introduction,
          challenge: questItem.challenge,
          reward: questItem.reward,
          starting_question: questItem.starting_question || questItem.startingQuestion,
          ai_prompt: questItem.ai_prompt || questItem.AI_instructions || questItem.AI_prompt
        }));

        console.log(`[QuestsService] Converted ${quests.length} quests from custom format to standard format`);
      }
      // Check if response is a single quest object (alternate format from custom prompts)
      else if (parsedResponse.questTitle || parsedResponse.quest_title) {
        // Alternative format - single quest object, not wrapped in array
        console.log(`[QuestsService] Detected single quest format from custom prompt`);

        // Create a standardized quest object from the single quest
        const standardizedQuest = {
          quest_title: parsedResponse.quest_title || parsedResponse.questTitle,
          introduction: parsedResponse.introduction,
          challenge: parsedResponse.challenge,
          reward: parsedResponse.reward,
          starting_question: parsedResponse.starting_question || parsedResponse.startingQuestion,
          ai_prompt: parsedResponse.ai_prompt || parsedResponse.AI_instructions || parsedResponse.AI_prompt
        };

        // Log the standardized quest
        console.log(`[QuestsService] STANDARDIZED QUEST:
=================== BEGIN STANDARDIZED QUEST ===================
${JSON.stringify(standardizedQuest, null, 2)}
=================== END STANDARDIZED QUEST ===================`);

        // Add the single quest to an array
        quests = [standardizedQuest];
        console.log(`[QuestsService] Converted single quest to standard format`);
      } else {
        throw new Error('Response did not contain a valid quests array or single quest object');
      }

      // We're keeping just the single quest functionality and removing multiple API calls
      // since the prompt will be updated to handle multiple quests in a single call

      // If we get a single quest but expected multiple, log a warning
      if (isSingleQuestFormat && quests.length < numQuestsNeeded) {
        console.log(`[QuestsService] WARNING: Received only a single quest (${quests.length}) but expected ${numQuestsNeeded}`);
        console.log(`[QuestsService] Consider updating the prompt to request multiple quests in a single API call`);
      }

      // Format quests with chapter info set to a generic for regular books
      return quests.map((quest: Quest) => ({
        ...quest,
        chapter_number: 0,
        chapter_title: "Full Book"
      }));
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);

      // Create a detailed error object with full context
      const detailedError = new Error(`JSON Parsing Failed: ${errorMessage}`);

      // Add the JSON as properties for detailed debugging
      (detailedError as ErrorWithJsonContext).rawJson = jsonString;
      (detailedError as ErrorWithJsonContext).jsonPreview = jsonString.substring(0, 500);

      console.error(`[QuestsService] Error parsing Claude response: ${errorMessage}`);
      console.error(`[QuestsService] Problematic JSON string (first 500 chars):`, jsonString.substring(0, 500));

      // Throw the detailed error with context
      throw detailedError;
    }
  } catch (error) {
    console.error(`[QuestsService] Error generating quests:`, error);

    // Forward the error with additional context
    throw new Error(`Failed to generate quests: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Store quests in Supabase
 */
async function storeQuestsInSupabase(
  book_id: string,
  book_title: string,
  quests: Quest[]
): Promise<StorageResult> {
  console.log(`[QuestsService] Storing ${quests.length} quests for book "${book_title}" (ID: ${book_id})`);

  // 1. First, delete any existing quests for this book to avoid duplicates
  const { error: deleteError } = await supabase
    .from('book_quests')
    .delete()
    .eq('book_id', book_id);

  if (deleteError) {
    console.warn(`[QuestsService] Error deleting existing quests: ${deleteError.message}. Will attempt to continue.`);
  } else {
    console.log(`[QuestsService] Successfully deleted any existing quests for book ID: ${book_id}`);
  }

  // 2. Prepare the quests for insertion
  // Log quests before transformation
  console.log(`[QuestsService] ORIGINAL QUESTS BEFORE DB TRANSFORMATION:
=================== BEGIN ORIGINAL QUESTS ===================
${JSON.stringify(quests, null, 2)}
=================== END ORIGINAL QUESTS ===================`);

  const questsToInsert = quests.map(quest => ({
    book_id: book_id,
    chapter_number: quest.chapter_number,
    chapter_title: quest.chapter_title,
    quest_title: quest.quest_title,
    introduction: quest.introduction,
    challenge: quest.challenge,
    reward: quest.reward,
    starting_question: quest.starting_question,
    ai_prompt: quest.ai_prompt // Include the AI prompt field
  }));

  // Log quests ready for insertion to verify field mapping
  console.log(`[QuestsService] QUESTS READY FOR DB INSERTION:
=================== BEGIN DB QUESTS ===================
${JSON.stringify(questsToInsert, null, 2)}
=================== END DB QUESTS ===================`);

  // 3. Insert all quests in a batch
  const { data: insertedQuests, error: insertError } = await supabase
    .from('book_quests')
    .insert(questsToInsert)
    .select('id');

  if (insertError) {
    throw new Error(`Failed to store quests: ${insertError.message}`);
  }

  console.log(`[QuestsService] Successfully inserted ${insertedQuests.length} quests into book_quests table`);

  // 4. Return success result
  return {
    operation: 'insert',
    recordId: `${insertedQuests.length} records created`
  };
}