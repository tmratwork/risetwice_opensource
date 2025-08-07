// src/services/bookConcepts.ts
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

interface KeyConcept {
  concept: string;
  description: string;
}

interface ProcessingInfo {
  total_chapters?: number;
  processed_chapters?: number;
  failed_chapters?: { chapter: string, title: string, error: string }[];
}

interface KeyConceptsResponse {
  key_concepts: KeyConcept[];
  processing_info?: ProcessingInfo;
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

export async function extractKeyConceptsFromBook(book_id: string): Promise<KeyConceptsResponse> {
  console.log(`[BookConceptsService] Starting concept extraction for book_id: ${book_id}`);

  // Check if this is the large book that needs chapter-by-chapter processing
  if (LARGE_BOOK_IDS.includes(book_id)) {
    return await processLargeBookByChapters(book_id);
  }

  // Standard processing for regular-sized books
  console.log(`[BookConceptsService] Fetching book content for book_id: ${book_id}`);

  try {
    // 1. Get book content directly from Supabase on the server
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, content')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    if (!book.content || book.content.trim().length === 0) {
      throw new Error('Book has no content to analyze');
    }

    console.log(`[BookConceptsService] Successfully fetched book "${book.title}" with ${book.content.length} characters`);


    // 2. Generate key concepts using Claude
    // Important: Book content should be processed on the server to avoid sending large amounts of text
    // over the network, but the content needs to be in the prompt for Claude
    const prompt = `Extract key concepts for the attached book. Identify the most significant ideas (10-20 key concepts).

EXTREMELY IMPORTANT: You MUST return ONLY a valid JSON object with no preamble text, no explanations, and no markdown formatting. Your entire response must be parseable as JSON.

Format the response as a clean JSON object with the following structure:
{
  "key_concepts": [
    {
      "concept": "Concept Name",
      "description": "Clear explanation of the concept"
    }
  ]
}

Guidelines:
1. Each concept should have a concise title and thorough description
2. Format with proper indentation (2 spaces)
3. Ensure there are no trailing commas
4. Make sure all strings are properly escaped - use double quotes for all strings and escape internal quotes
5. Sort concepts in the order they appear in the book
6. Do NOT include any explanations before or after the JSON
7. Do NOT wrap the JSON in markdown code blocks or any other formatting
8. The response must start with the opening brace and end with the closing brace

Return ONLY valid, parseable JSON that could be directly consumed by an application. Your response will be directly parsed with JSON.parse(), so it must be syntactically perfect.

Book: ${book.title}
Content: ${book.content.substring(0, 100000)}`;  // Limiting to first 100k chars to avoid token limits

    const conceptsData = await extractConceptsWithClaude(prompt, book.title);

    // 4. Store in Supabase
    const storageResult = await storeConceptsInSupabase(book.id, book.title, conceptsData);

    // 5. Log detailed information about the extraction and storage
    console.log(`[BookConceptsService] ========== CONCEPT EXTRACTION COMPLETE ==========`);
    console.log(`[BookConceptsService] Book: "${book.title}" (ID: ${book.id})`);
    console.log(`[BookConceptsService] Table: book_concepts`);
    console.log(`[BookConceptsService] Storage Operation: ${storageResult.operation}`);
    console.log(`[BookConceptsService] Record ID: ${storageResult.recordId || 'N/A'}`);
    console.log(`[BookConceptsService] Total Concepts: ${conceptsData.key_concepts.length}`);
    console.log(`[BookConceptsService] Concepts:`);
    conceptsData.key_concepts.forEach((concept, index) => {
      console.log(`[BookConceptsService]   ${index + 1}. ${concept.concept}`);
    });
    console.log(`[BookConceptsService] =======================================`);

    return conceptsData;
  } catch (error) {
    console.error('Error extracting key concepts:', error);
    throw new Error(`Failed to extract key concepts: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Process a large book by breaking it into chapters and extracting concepts from each chapter
 */
async function processLargeBookByChapters(book_id: string): Promise<KeyConceptsResponse> {
  console.log(`[BookConceptsService] Processing large book (${book_id}) by chapters`);

  try {
    // 1. Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`[BookConceptsService] Found book "${bookTitle}" (ID: ${book.id})`);

    // 2. Load book structure analysis
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    if (!fs.existsSync(structureFilePath)) {
      throw new Error(`Book structure analysis file not found: ${structureFilePath}`);
    }

    const bookStructure: BookStructure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));
    console.log(`[BookConceptsService] Loaded book structure with ${bookStructure.chapters.length} chapters`);

    // 3. Load the book content
    const bookFilePath = bookStructure.bookPath;
    if (!fs.existsSync(bookFilePath)) {
      throw new Error(`Book content file not found: ${bookFilePath}`);
    }

    const bookContent = fs.readFileSync(bookFilePath, 'utf8');
    const bookLines = bookContent.split('\n');
    console.log(`[BookConceptsService] Loaded book content with ${bookLines.length} lines`);

    // 4. Prepare chapters with line ranges
    const chaptersWithRanges = bookStructure.chapters.map((chapter, index) => {
      const nextChapter = bookStructure.chapters[index + 1];
      const nextLineNumber = nextChapter ? nextChapter.lineNumber : bookLines.length + 1;

      return {
        ...chapter,
        nextLineNumber
      };
    });

    // 5. Process each chapter and collect all concepts
    const allConcepts: KeyConcept[] = [];
    let processedChapters = 0;
    const failedChapters: { chapter: string, title: string, error: string }[] = [];

    for (const chapter of chaptersWithRanges) {
      console.log(`[BookConceptsService] Processing Chapter ${chapter.chapterNumber}: ${chapter.title}`);

      // Extract chapter content using line numbers (0-indexed array)
      const startLine = chapter.lineNumber - 1;
      const endLine = chapter.nextLineNumber - 1;
      const chapterContent = bookLines.slice(startLine, endLine).join('\n');

      // Log chapter information
      console.log(`[BookConceptsService] Chapter ${chapter.chapterNumber} size: ${chapterContent.length} characters`);

      // Create prompt for this chapter
      const chapterPrompt = `Extract key concepts for Chapter ${chapter.chapterNumber}: ${chapter.title} from the book "${bookTitle}".
Identify the most significant ideas (5-10 key concepts) that are specific to this chapter.

EXTREMELY IMPORTANT: You MUST return ONLY a valid JSON object with no preamble text, no explanations, and no markdown formatting. Your entire response must be parseable as JSON.

Format the response as a clean JSON object with the following structure:
{
  "key_concepts": [
    {
      "concept": "Concept Name",
      "description": "Clear explanation of the concept"
    }
  ]
}

Guidelines:
1. Each concept should have a concise title and thorough description
2. Format with proper indentation (2 spaces)
3. Ensure there are no trailing commas
4. Make sure all strings are properly escaped - use double quotes for all strings and escape internal quotes
5. Sort concepts in the order they appear in the chapter
6. Do NOT include any explanations before or after the JSON
7. Do NOT wrap the JSON in markdown code blocks or any other formatting
8. The response must start with the opening brace and end with the closing brace

Chapter Content:
${chapterContent}`;

      try {
        // Process this chapter
        const chapterConcepts = await extractConceptsWithClaude(chapterPrompt, `${bookTitle} - Chapter ${chapter.chapterNumber}`);

        // Add chapter info to each concept and add to the full list
        const enhancedConcepts = chapterConcepts.key_concepts.map(concept => ({
          concept: `[Ch ${chapter.chapterNumber}] ${concept.concept}`,
          description: concept.description
        }));

        allConcepts.push(...enhancedConcepts);

        // Log progress
        processedChapters++;
        console.log(`[BookConceptsService] ✅ Completed ${processedChapters}/${chaptersWithRanges.length} chapters`);
        console.log(`[BookConceptsService] Chapter ${chapter.chapterNumber} yielded ${enhancedConcepts.length} concepts`);
      } catch (error) {
        console.error(`[BookConceptsService] Error processing chapter ${chapter.chapterNumber}:`, error);
        console.log(`[BookConceptsService] Continuing with next chapter...`);

        // Track failed chapters for reporting
        failedChapters.push({
          chapter: chapter.chapterNumber,
          title: chapter.title,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 6. Store the combined concepts in Supabase
    // Include information about chapter processing success/failure
    const combinedResponse: KeyConceptsResponse = {
      key_concepts: allConcepts,
      processing_info: {
        total_chapters: chaptersWithRanges.length,
        processed_chapters: processedChapters,
        failed_chapters: failedChapters
      }
    };

    const storageResult = await storeConceptsInSupabase(book.id, bookTitle, combinedResponse);

    // 7. Log final results
    console.log(`[BookConceptsService] ========== LARGE BOOK PROCESSING COMPLETE ==========`);
    console.log(`[BookConceptsService] Book: "${bookTitle}" (ID: ${book.id})`);
    console.log(`[BookConceptsService] Total chapters processed: ${processedChapters}/${chaptersWithRanges.length}`);
    console.log(`[BookConceptsService] Total concepts extracted: ${allConcepts.length}`);
    console.log(`[BookConceptsService] Failed chapters: ${failedChapters.length}`);
    if (failedChapters.length > 0) {
      console.log(`[BookConceptsService] Failed chapter details:`);
      failedChapters.forEach(fc => {
        console.log(`[BookConceptsService]   - Chapter ${fc.chapter}: ${fc.title} - Error: ${fc.error}`);
      });
    }
    console.log(`[BookConceptsService] Storage operation: ${storageResult.operation}`);
    console.log(`[BookConceptsService] =======================================`);

    return combinedResponse;
  } catch (error) {
    console.error('[BookConceptsService] Error processing large book by chapters:', error);
    throw new Error(`Failed to process large book by chapters: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract concepts using Claude API with error handling and JSON parsing
 */
async function extractConceptsWithClaude(prompt: string, contextName: string): Promise<KeyConceptsResponse> {
  try {
    console.log(`[BookConceptsService] Sending request to Claude to extract concepts for "${contextName}"...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      system: "You are an AI assistant that analyzes book content and extracts key concepts in valid JSON format. You MUST ONLY return valid JSON, with no explanatory text before or after it.",
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Parse the response JSON
    let responseText = '';
    if ('text' in response.content[0]) {
      responseText = response.content[0].text as string;
    } else {
      responseText = JSON.stringify(response.content[0]);
    }

    console.log(`[BookConceptsService] Received response from Claude (${responseText.length} characters)`);
    console.log(`[BookConceptsService] First 100 chars: ${responseText.substring(0, 100)}...`);

    // Extract JSON from the response, handling cases where Claude includes extra text
    let jsonString = responseText.trim();

    // Try multiple extraction strategies if needed
    let conceptsData: KeyConceptsResponse;

    // Strategy 1: Try to parse the full response directly
    try {
      conceptsData = JSON.parse(jsonString) as KeyConceptsResponse;
      console.log(`[BookConceptsService] ✅ Successfully parsed JSON directly`);
    } catch (directError) {
      console.log(`[BookConceptsService] Direct JSON parsing failed, trying extraction methods`);

      // Strategy 2: Find and extract JSON object using regex
      try {
        // Find JSON boundaries if Claude added explanatory text
        const jsonMatch = responseText.match(/(\{[\s\S]*\})/);

        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log(`[BookConceptsService] Extracted JSON object using regex: ${jsonString.substring(0, 100)}...`);
          conceptsData = JSON.parse(jsonString) as KeyConceptsResponse;
          console.log(`[BookConceptsService] ✅ Successfully parsed JSON using regex extraction`);
        } else {
          // Strategy 3: Try to find from explicit start/end positions
          const jsonStartMatch = responseText.match(/(\{|\[)/);
          const jsonEndMatch = responseText.match(/(\}|\])(?=[^{}[\]]*$)/);

          if (jsonStartMatch && jsonEndMatch) {
            const startIndex = jsonStartMatch.index ?? 0;
            const endIndex = (jsonEndMatch.index ?? 0) + 1;
            jsonString = responseText.substring(startIndex, endIndex);
            console.log(`[BookConceptsService] Extracted JSON using boundary positions: ${jsonString.substring(0, 100)}...`);
            conceptsData = JSON.parse(jsonString) as KeyConceptsResponse;
            console.log(`[BookConceptsService] ✅ Successfully parsed JSON using boundary extraction`);
          } else {
            // If all extraction methods fail, throw the original error
            throw directError;
          }
        }
      } catch (extractionError) {
        console.error(`[BookConceptsService] All JSON extraction methods failed`);
        console.error(`[BookConceptsService] Original response (first 500 chars): ${responseText.substring(0, 500)}...`);
        throw new Error(`Could not extract valid JSON from Claude response: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
      }
    }

    return conceptsData;
  } catch (jsonError) {
    console.error(`[BookConceptsService] Error with Claude API or JSON parsing:`, jsonError);
    throw new Error(`Failed to extract concepts with Claude: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
  }
}

interface StorageResult {
  operation: 'create_table' | 'insert' | 'update';
  recordId?: string;
}

async function storeConceptsInSupabase(
  book_id: string,
  book_title: string,
  conceptsData: KeyConceptsResponse
): Promise<StorageResult> {
  console.log(`[BookConceptsService] Storing concepts for book "${book_title}" (ID: ${book_id})`);

  // 1. Check if book_concepts table exists
  const { error: checkError } = await supabase
    .from('book_concepts')
    .select('id', { count: 'exact', head: true })
    .limit(1);

  // 2. If the table doesn't exist, create it
  if (checkError && checkError.code === '42P01') { // PostgreSQL error code for "relation does not exist"
    console.log(`[BookConceptsService] Table 'book_concepts' does not exist, creating it now`);

    // Create the table using SQL
    const { error: createTableError } = await supabase.rpc('create_book_concepts_table', {
      sql_statement: `
        CREATE TABLE book_concepts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          book_id UUID NOT NULL REFERENCES books_v2(id),
          book_title TEXT NOT NULL,
          concepts JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
        CREATE INDEX book_concepts_book_id_idx ON book_concepts(book_id);
      `
    });

    if (createTableError) {
      throw new Error(`Failed to create book_concepts table: ${createTableError.message}`);
    }

    console.log(`[BookConceptsService] Successfully created 'book_concepts' table`);
    return { operation: 'create_table' };
  }

  // 3. Check if concepts already exist for this book
  const { data: existingData, /* error: existingError */ } = await supabase
    .from('book_concepts')
    .select('id')
    .eq('book_id', book_id)
    .maybeSingle();

  // 4. Upsert concepts into the table
  if (existingData?.id) {
    console.log(`[BookConceptsService] Found existing record with ID: ${existingData.id}, updating`);

    // Update existing record
    const { error: updateError } = await supabase
      .from('book_concepts')
      .update({
        concepts: conceptsData,
        updated_at: new Date()
      })
      .eq('id', existingData.id);

    if (updateError) {
      throw new Error(`Failed to update key concepts: ${updateError.message}`);
    }

    console.log(`[BookConceptsService] Successfully updated concepts for book ID: ${book_id}`);
    return {
      operation: 'update',
      recordId: existingData.id
    };
  } else {
    console.log(`[BookConceptsService] No existing record found, inserting new one`);

    // Insert new record
    const { data: insertData, error: insertError } = await supabase
      .from('book_concepts')
      .insert({
        book_id,
        book_title,
        concepts: conceptsData,
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to store key concepts: ${insertError.message}`);
    }

    console.log(`[BookConceptsService] Successfully inserted concepts with record ID: ${insertData?.id || 'unknown'}`);
    return {
      operation: 'insert',
      recordId: insertData?.id
    };
  }
}