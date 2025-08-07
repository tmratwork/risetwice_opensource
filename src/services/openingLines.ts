// src/services/openingLines.ts
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

interface OpeningLine {
  opening_line: string;
  type: string;
  title: string;
  chapter_number: number;
  chapter_title: string;
  character_name: string;
  example_conversation?: {
    speaker: string;
    text: string;
  }[];
  related_concepts?: string[];
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

// This interface will be used in future implementations
// interface OpeningLinesResponse {
//   opening_lines: OpeningLine[];
// }

export async function generateOpeningLinesFromBook(book_id: string): Promise<OpeningLine[]> {
  console.log(`[OpeningLinesService] Starting opening lines generation for book_id: ${book_id}`);

  // Check if this is the large book that needs chapter-by-chapter processing
  if (LARGE_BOOK_IDS.includes(book_id)) {
    return await processLargeBookByChapters(book_id);
  }

  // 1. Get book content from Supabase
  const { data: book, error: bookError } = await supabase
    .from('books_v2')
    .select('id, title, content, author')
    .eq('id', book_id)
    .single();

  if (bookError || !book) {
    throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
  }

  if (!book.content || book.content.trim().length === 0) {
    throw new Error('Book has no content to analyze');
  }

  console.log(`[OpeningLinesService] Successfully fetched book "${book.title}" by ${book.author} with ${book.content.length} characters`);

  // 2. Get previously generated key concepts from Supabase
  console.log(`[OpeningLinesService] Fetching key concepts from database...`);
  const { data: conceptsData, error: conceptsError } = await supabase
    .from('book_concepts')
    .select('concepts')
    .eq('book_id', book_id)
    .single();

  if (conceptsError) {
    throw new Error(`Error fetching key concepts: ${conceptsError.message}`);
  }

  if (!conceptsData || !conceptsData.concepts || !conceptsData.concepts.key_concepts) {
    throw new Error(`No key concepts found for this book. Please generate key concepts first.`);
  }

  const keyConceptsList = conceptsData.concepts.key_concepts || [];
  console.log(`[OpeningLinesService] Found ${keyConceptsList.length} key concepts in database`);

  // 3. Get previously generated character profiles from Supabase
  console.log(`[OpeningLinesService] Fetching character profiles from database...`);
  const { data: characterProfiles, error: charactersError } = await supabase
    .from('book_character_profiles')
    .select('character_name')
    .eq('book_id', book_id);

  if (charactersError) {
    throw new Error(`Error fetching character profiles: ${charactersError.message}`);
  }

  if (!characterProfiles || characterProfiles.length === 0) {
    throw new Error(`No character profiles found for this book. Please generate character profiles first.`);
  }

  const charactersList = characterProfiles.map((profile: { character_name: string }) => profile.character_name);
  console.log(`[OpeningLinesService] Found ${charactersList.length} character profiles in database`);

  // 4. Generate all opening lines in a single request since we've simplified the JSON
  console.log(`[OpeningLinesService] Generating all opening lines in a single request...`);
  const totalToGenerate = 20;

  // Generate all opening lines at once (1-20)
  console.log(`[OpeningLinesService] Requesting ${totalToGenerate} opening lines...`);

  const allOpeningLines = await generateAllOpeningLines(
    book.title,
    book.content,
    keyConceptsList,
    charactersList,
    totalToGenerate
  );

  console.log(`[OpeningLinesService] Successfully generated ${allOpeningLines.length} opening lines`);

  // 5. Store the opening lines in Supabase
  console.log(`[OpeningLinesService] Storing opening lines in database...`);
  const storageResult = await storeOpeningLinesInSupabase(book.id, book.title, allOpeningLines);

  // 6. Log detailed summary
  console.log(`[OpeningLinesService] ========== OPENING LINES GENERATION COMPLETE ==========`);
  console.log(`[OpeningLinesService] Book: "${book.title}" (ID: ${book.id})`);
  console.log(`[OpeningLinesService] Table: book_opening_lines`);
  console.log(`[OpeningLinesService] Storage Operation: ${storageResult.operation}`);
  console.log(`[OpeningLinesService] Record ID: ${storageResult.recordId || 'N/A'}`);
  console.log(`[OpeningLinesService] Total Opening Lines: ${allOpeningLines.length}`);
  console.log(`[OpeningLinesService] Opening Lines Preview:`);
  allOpeningLines.slice(0, 3).forEach((line, index) => {
    console.log(`[OpeningLinesService]   ${index + 1}. "${line.character_name}": ${line.opening_line.substring(0, 100)}...`);
  });
  console.log(`[OpeningLinesService] =======================================`);

  return allOpeningLines;
}

/**
 * Process a large book by breaking it into chapters and generating one opening line per chapter
 */
async function processLargeBookByChapters(book_id: string): Promise<OpeningLine[]> {
  console.log(`[OpeningLinesService] Processing large book (${book_id}) by chapters`);

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
    console.log(`[OpeningLinesService] Found book "${bookTitle}" (ID: ${book.id}) by ${book.author}`);

    // 2. Load book structure analysis
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    if (!fs.existsSync(structureFilePath)) {
      throw new Error(`Book structure analysis file not found: ${structureFilePath}`);
    }

    const bookStructure: BookStructure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));
    console.log(`[OpeningLinesService] Loaded book structure with ${bookStructure.chapters.length} chapters`);

    // 3. Load the book content
    const bookFilePath = bookStructure.bookPath;
    if (!fs.existsSync(bookFilePath)) {
      throw new Error(`Book content file not found: ${bookFilePath}`);
    }

    const bookContent = fs.readFileSync(bookFilePath, 'utf8');
    const bookLines = bookContent.split('\n');
    console.log(`[OpeningLinesService] Loaded book content with ${bookLines.length} lines`);

    // 4. Get key concepts from Supabase
    console.log(`[OpeningLinesService] Fetching key concepts from database...`);
    const { data: conceptsData, error: conceptsError } = await supabase
      .from('book_concepts')
      .select('concepts')
      .eq('book_id', book_id)
      .single();

    if (conceptsError) {
      throw new Error(`Error fetching key concepts: ${conceptsError.message}`);
    }

    if (!conceptsData || !conceptsData.concepts || !conceptsData.concepts.key_concepts) {
      throw new Error(`No key concepts found for this book. Please generate key concepts first.`);
    }

    const keyConceptsList = conceptsData.concepts.key_concepts || [];
    console.log(`[OpeningLinesService] Found ${keyConceptsList.length} key concepts in database`);

    // 5. Get character profiles from Supabase
    console.log(`[OpeningLinesService] Fetching character profiles from database...`);
    const { data: characterProfiles, error: charactersError } = await supabase
      .from('book_character_profiles')
      .select('character_name')
      .eq('book_id', book_id);

    if (charactersError) {
      throw new Error(`Error fetching character profiles: ${charactersError.message}`);
    }

    if (!characterProfiles || characterProfiles.length === 0) {
      throw new Error(`No character profiles found for this book. Please generate character profiles first.`);
    }

    const charactersList = characterProfiles.map((profile: { character_name: string }) => profile.character_name);
    console.log(`[OpeningLinesService] Found ${charactersList.length} character profiles in database`);

    // 6. Prepare chapters with line ranges
    const chaptersWithRanges = bookStructure.chapters.map((chapter, index) => {
      const nextChapter = bookStructure.chapters[index + 1];
      const nextLineNumber = nextChapter ? nextChapter.lineNumber : bookLines.length + 1;

      return {
        ...chapter,
        nextLineNumber
      };
    });

    // 7. Process each chapter and collect one opening line per chapter
    const allOpeningLines: OpeningLine[] = [];
    let processedChapters = 0;
    const failedChapters: { chapter: string, title: string, error: string }[] = [];

    for (const chapter of chaptersWithRanges) {
      console.log(`[OpeningLinesService] Processing Chapter ${chapter.chapterNumber}: ${chapter.title}`);

      // Extract chapter content using line numbers (0-indexed array)
      const startLine = chapter.lineNumber - 1;
      const endLine = chapter.nextLineNumber - 1;
      const chapterContent = bookLines.slice(startLine, endLine).join('\n');

      // Log chapter information
      console.log(`[OpeningLinesService] Chapter ${chapter.chapterNumber} size: ${chapterContent.length} characters`);

      // Filter concepts for this chapter
      const chapterConceptsList = keyConceptsList.filter((concept: { concept: string; description: string }) =>
        concept.concept.startsWith(`[Ch ${chapter.chapterNumber}]`)
      );

      // If no chapter-specific concepts found, use all concepts
      const conceptsToUse = chapterConceptsList.length > 0 ? chapterConceptsList : keyConceptsList;
      console.log(`[OpeningLinesService] Using ${conceptsToUse.length} concepts for this chapter`);

      try {
        // Generate one opening line for this chapter
        console.log(`[OpeningLinesService] Generating opening line for Chapter ${chapter.chapterNumber}...`);

        // Generate one opening line (setting total to 1)
        const chapterOpeningLine = await generateAllOpeningLines(
          bookTitle,
          chapterContent, // Use chapter content instead of full book
          conceptsToUse,
          charactersList,
          1 // Generate just one line per chapter
        );

        // Update chapter metadata for consistency
        if (chapterOpeningLine.length > 0) {
          chapterOpeningLine[0].chapter_number = parseInt(chapter.chapterNumber, 10);
          chapterOpeningLine[0].chapter_title = chapter.title;

          // Add to the collection
          allOpeningLines.push(chapterOpeningLine[0]);

          console.log(`[OpeningLinesService] ✅ Generated opening line for Chapter ${chapter.chapterNumber}`);
          console.log(`[OpeningLinesService] Opening line: "${chapterOpeningLine[0].opening_line.substring(0, 100)}..."`);
        }

        // Log progress
        processedChapters++;
        console.log(`[OpeningLinesService] Completed ${processedChapters}/${chaptersWithRanges.length} chapters`);
      } catch (error) {
        console.error(`[OpeningLinesService] Error processing chapter ${chapter.chapterNumber}:`, error);
        console.log(`[OpeningLinesService] Continuing with next chapter...`);

        // Track failed chapters for reporting
        failedChapters.push({
          chapter: chapter.chapterNumber,
          title: chapter.title,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 8. Store the combined opening lines in Supabase
    console.log(`[OpeningLinesService] Storing ${allOpeningLines.length} opening lines in database...`);
    const storageResult = await storeOpeningLinesInSupabase(book.id, bookTitle, allOpeningLines);

    // 9. Log final results
    console.log(`[OpeningLinesService] ========== LARGE BOOK PROCESSING COMPLETE ==========`);
    console.log(`[OpeningLinesService] Book: "${bookTitle}" (ID: ${book.id})`);
    console.log(`[OpeningLinesService] Total chapters processed: ${processedChapters}/${chaptersWithRanges.length}`);
    console.log(`[OpeningLinesService] Total opening lines generated: ${allOpeningLines.length}`);
    console.log(`[OpeningLinesService] Failed chapters: ${failedChapters.length}`);
    if (failedChapters.length > 0) {
      console.log(`[OpeningLinesService] Failed chapter details:`);
      failedChapters.forEach(fc => {
        console.log(`[OpeningLinesService]   - Chapter ${fc.chapter}: ${fc.title} - Error: ${fc.error}`);
      });
    }
    console.log(`[OpeningLinesService] Storage operation: ${storageResult.operation}`);
    console.log(`[OpeningLinesService] =======================================`);

    return allOpeningLines;
  } catch (error) {
    console.error('[OpeningLinesService] Error processing large book by chapters:', error);
    throw new Error(`Failed to process large book by chapters: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate all opening lines at once using Claude
 */
async function generateAllOpeningLines(
  bookTitle: string,
  bookContent: string,
  keyConceptsList: Array<{ concept: string, description: string }>,
  charactersList: string[],
  totalToGenerate: number
): Promise<OpeningLine[]> {
  const prompt = `
  Generate game opening lines based on key concepts presented from the book. Output in JSON format. The opening lines should be controversial, contrarian, or somehow invoke a strong emotional response, and must be based ONLY on actual scenarios and characters explicitly mentioned in the text. The opening lines should pose a dilemma discussed in the book. Assume the user has not read the book, make the opening line something someone who has never read the book can answer. 

## Book Information
Title: ${bookTitle}
Book Content (excerpt): ${bookContent.substring(0, 450000)}

## Available Characters from the Book
${charactersList.map(name => `- ${name}`).join('\\n')}

## Key Concepts to Focus On
${keyConceptsList.map(concept => `- ${concept.concept}: ${concept.description}`).join('\\n')}

## Instructions 
1. Identify scenarios that best illustrate these key concepts. 
2. Create opening lines where characters explicitly wrestle with or demonstrate these concepts. 
3. EVERY opening line MUST EXPLICITLY NAME at least one key concept using the EXACT terminology from the key concepts list.
4. The naming of the concept should be natural and integrated into the character's speech (e.g., "I've been struggling with [exact concept name] since...")
5. Do NOT invent new characters or scenarios not present in the text. 
6. For each opening line, include which key concept(s) it explicitly names. 
7. Present output in the specified JSON format below.

## Example of properly naming concepts:
INCORRECT: "I'm facing the challenges of getting older and seeing my body change..."
CORRECT: "I'm wrestling with 'Impermanence and Continuous Change' as I watch my body age..."


## JSON Structure 
[
  {
    "opening_line": "[Character introduces a concept and presents a situation]",
    "type": "[Character type/role]",
    "title": "${bookTitle}",
    "chapter_number": 1,
    "chapter_title": "Chapter One",
    "character_name": "[Name of the character]"
  }
]

## Process
1. Read and analyze the text to identify scenarios that explicitly illustrate the key concepts. 
2. Create 20 opening lines, ensuring each key concept is covered at least once. 
3. Format all opening lines in the JSON structure specified above. 
4. Add "related_concepts" to clearly identify which concepts each opening line addresses.  

## Reminder 
- ONLY use characters and scenarios explicitly mentioned in the text. 
- EVERY opening line must address at least one key concept listed above, and mention that concept as part of the opening message.
- Make opening lines controversial, contrarian, or attention-grabbing while still maintaining fidelity to the text. 
- Character names must be actual names from the book, not invented names. 
- Each opening line should present a clear situation based on a dilemma from the book that illustrates a key concept and includes a request for help or guidance.

`;

  try {
    console.log(`[OpeningLinesService] Sending request to Claude to generate all ${totalToGenerate} opening lines...`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000, // Increased for full set of opening lines
      temperature: 0.5, // Lower temperature for more reliable JSON formatting
      system: "You are an AI assistant specialized in generating dialogue for thought-provoking conversation based on books. You create attention-grabbing opening lines that reference key concepts from books. IMPORTANT: You MUST return ONLY valid JSON with no explanatory text before or after it.",
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Handle different response content formats
    const content = response.content[0];
    const responseText = 'text' in content ? content.text : String(content);
    console.log(`[OpeningLinesService] Raw opening lines response (first 100 chars): ${responseText.substring(0, 100)}...`);

    // Extract JSON from the response, handling cases where Claude adds extra text
    let jsonString = responseText;

    // Find JSON boundaries if Claude added explanatory text
    const jsonStartMatch = responseText.match(/(\[)/);
    const jsonEndMatch = responseText.match(/(\])(?=[^\[\]]*$)/);

    if (jsonStartMatch && jsonEndMatch && jsonStartMatch.index !== undefined && jsonEndMatch.index !== undefined) {
      const startIndex = jsonStartMatch.index;
      const endIndex = jsonEndMatch.index + 1;
      jsonString = responseText.substring(startIndex, endIndex);
      console.log(`[OpeningLinesService] Extracted JSON array from Claude response`);
    }

    // Parse the response JSON
    try {
      const openingLines = JSON.parse(jsonString) as OpeningLine[];
      console.log(`[OpeningLinesService] Successfully parsed ${openingLines.length} opening lines from Claude response`);
      return openingLines;
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      console.error(`[OpeningLinesService] Error parsing Claude response: ${errorMessage}`);
      console.error(`[OpeningLinesService] Problematic JSON string (first 200 chars):`, jsonString.substring(0, 200));

      // Attempt to sanitize and fix JSON before giving up
      console.log(`[OpeningLinesService] Attempting to fix malformed JSON...`);

      try {
        // Try to find and fix common JSON issues

        // 1. Handle unterminated strings by looking for unescaped quotes
        let fixedJson = jsonString;

        // Look for obvious issues with unterminated quotes in the JSON
        // This regex finds any line containing an odd number of unescaped quotes
        const problematicLines = jsonString.split('\n').map((line: string, index: number) => {
          // Count unescaped quotes in this line
          const matches = line.match(/(?<!\\)"/g);
          const quoteCount = matches ? matches.length : 0;
          if (quoteCount % 2 !== 0) {
            return { index, line, quoteCount };
          }
          return null;
        }).filter(Boolean);

        if (problematicLines.length > 0) {
          console.log(`[OpeningLinesService] Found ${problematicLines.length} lines with odd number of quotes`);

          // Simple fix attempt: add missing quotes at end of problematic lines
          const lines = jsonString.split('\n');
          // Define interface for problematic line data
          interface ProblematicLine {
            index: number;
            line: string;
            quoteCount: number;
          }

          problematicLines.forEach((problem: ProblematicLine | null) => {
            if (problem) {
              // If line has odd number of quotes, add a quote at the end
              lines[problem.index] = lines[problem.index] + '"';
              console.log(`[OpeningLinesService] Fixed line ${problem.index}: ${lines[problem.index].substring(0, 50)}...`);
            }
          });

          fixedJson = lines.join('\n');
          console.log(`[OpeningLinesService] Attempted to fix JSON by adding missing quotes`);
        }

        // 2. Try parsing with a more lenient JSON5 approach (simple simulation)
        // If that fails, try a hacky recovery approach with a custom regex-based parser
        try {
          // The following variables are for a different approach that's not currently used
          // but might be needed in future implementations
          // const parsedLines = [];
          // const inObject = false;
          // const currentObject = {};
          // const currentKey = '';

          // Extract objects directly with regex
          // Use regex to find opening line objects, using 'g' flag only for TypeScript compatibility
          const objectMatches = fixedJson.match(/\{\s*"opening_line".*?\}\s*(?=,|\])/g);

          if (objectMatches && objectMatches.length > 0) {
            console.log(`[OpeningLinesService] Extracted ${objectMatches.length} objects via regex`);

            // Try to parse each object independently
            const validObjects = [];

            for (const objStr of objectMatches) {
              try {
                // Add closing brace if missing
                let fixedObjStr = objStr;
                if (!objStr.trim().endsWith('}')) {
                  fixedObjStr = objStr + '}';
                }

                // Parse individual object
                const obj = JSON.parse(fixedObjStr);

                // Validate required fields exist
                if (obj.opening_line && obj.character_name) {
                  validObjects.push(obj);
                }
              } catch (error) {
                console.log(`[OpeningLinesService] Skipping unparseable object: ${objStr.substring(0, 50)}...`);
                console.error(`[OpeningLinesService] Error parsing object:`, error);
              }
            }

            if (validObjects.length > 0) {
              console.log(`[OpeningLinesService] Successfully recovered ${validObjects.length} valid opening lines`);
              return validObjects as OpeningLine[];
            }
          }

          // If we got here, all recovery attempts failed
          throw new Error("All JSON recovery methods failed");
        } catch (recoveryError) {
          console.error(`[OpeningLinesService] JSON recovery attempts failed:`, recoveryError);
          throw parseError; // Throw the original error
        }
      } catch (fixError) {
        console.error(`[OpeningLinesService] Error trying to fix JSON:`, fixError);
        // Continue with the original error
        throw new Error(`Failed to parse opening lines from Claude response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
  } catch (error) {
    console.error(`[OpeningLinesService] Error generating opening lines:`, error);
    throw new Error(`Failed to generate opening lines: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface StorageResult {
  operation: 'create_table' | 'insert' | 'update';
  recordId?: string;
}

/**
 * Store opening lines in Supabase using the existing opening_lines_v1 table
 */
async function storeOpeningLinesInSupabase(
  book_id: string,
  book_title: string,
  openingLines: OpeningLine[]
): Promise<StorageResult> {
  console.log(`[OpeningLinesService] Storing ${openingLines.length} opening lines for book "${book_title}" (ID: ${book_id})`);

  // 1. First, delete any existing lines for this book to avoid duplicates
  const { error: deleteError } = await supabase
    .from('opening_lines_v1')
    .delete()
    .eq('book_id', book_id);

  if (deleteError) {
    console.warn(`[OpeningLinesService] Error deleting existing opening lines: ${deleteError.message}. Will attempt to continue.`);
  } else {
    console.log(`[OpeningLinesService] Successfully deleted any existing opening lines for book ID: ${book_id}`);
  }

  // 2. Prepare the opening lines for insertion into the existing table structure
  const linesToInsert = openingLines.map(line => ({
    book_id: book_id,
    character_name: line.character_name,
    type: line.type,
    chapter_number: line.chapter_number || 1,
    chapter_title: line.chapter_title || "Chapter One",
    opening_line: line.opening_line,
    related_concepts: line.related_concepts ? JSON.stringify(line.related_concepts) : null,
    example_conversation: line.example_conversation ? JSON.stringify(line.example_conversation) : null
  }));

  // 3. Insert all opening lines in a batch
  const { data: insertedLines, error: insertError } = await supabase
    .from('opening_lines_v1')
    .insert(linesToInsert)
    .select('id');

  if (insertError) {
    throw new Error(`Failed to store opening lines: ${insertError.message}`);
  }

  console.log(`[OpeningLinesService] Successfully inserted ${insertedLines.length} opening lines into opening_lines_v1 table`);

  // 4. Return success result
  return {
    operation: 'insert',
    recordId: `${insertedLines.length} records created`
  };
}