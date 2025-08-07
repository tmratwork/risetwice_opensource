/**
 * API endpoint for retrying a failed chapter extraction
 * 
 * This endpoint allows retrying concept extraction for a specific chapter
 * when the initial processing failed during chapter-by-chapter extraction.
 */
import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Interfaces for data structures
interface KeyConcept {
  concept: string;
  description: string;
}

interface KeyConceptsResponse {
  key_concepts: KeyConcept[];
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

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Retry-Chapter][${requestId}]`;

  console.log(`${logPrefix} === STARTING CHAPTER RETRY ===`);

  try {
    // Parse request body
    const body = await req.json();
    const { book_id, chapter_number } = body;

    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }

    if (!chapter_number) {
      return NextResponse.json({ error: 'Chapter number is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Retrying Chapter ${chapter_number} for book ID: ${book_id}`);

    // Step 1: Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', book_id)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`${logPrefix} Found book "${bookTitle}" (ID: ${book.id})`);

    // Step 2: Load book structure analysis
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    if (!fs.existsSync(structureFilePath)) {
      throw new Error(`Book structure analysis file not found: ${structureFilePath}`);
    }

    const bookStructure: BookStructure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));
    console.log(`${logPrefix} Loaded book structure with ${bookStructure.chapters.length} chapters`);

    // Step 3: Find the specific chapter
    const chapter = bookStructure.chapters.find(ch => ch.chapterNumber === chapter_number);
    if (!chapter) {
      return NextResponse.json({
        error: `Chapter ${chapter_number} not found in book structure`
      }, { status: 404 });
    }

    // Step 4: Load the book content
    const bookFilePath = bookStructure.bookPath;
    if (!fs.existsSync(bookFilePath)) {
      throw new Error(`Book content file not found: ${bookFilePath}`);
    }

    const bookContent = fs.readFileSync(bookFilePath, 'utf8');
    const bookLines = bookContent.split('\n');
    console.log(`${logPrefix} Loaded book content with ${bookLines.length} lines`);

    // Step 5: Find the line range for this chapter
    const nextChapterIndex = bookStructure.chapters.findIndex(ch => ch.chapterNumber === chapter_number) + 1;
    const nextChapter = nextChapterIndex < bookStructure.chapters.length
      ? bookStructure.chapters[nextChapterIndex]
      : null;

    const startLine = chapter.lineNumber - 1;
    const endLine = nextChapter ? nextChapter.lineNumber - 1 : bookLines.length;
    const chapterContent = bookLines.slice(startLine, endLine).join('\n');

    console.log(`${logPrefix} Chapter ${chapter_number} size: ${chapterContent.length} characters`);

    // Step 6: Create prompt for this chapter
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

    // Step 7: Process this chapter with Claude
    console.log(`${logPrefix} Sending request to Claude to extract concepts...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      system: "You are an AI assistant that analyzes book content and extracts key concepts in valid JSON format. You MUST ONLY return valid JSON, with no explanatory text before or after it.",
      messages: [
        { role: "user", content: chapterPrompt }
      ],
    });

    // Step 8: Parse the response JSON
    let responseText = '';
    if ('text' in response.content[0]) {
      responseText = response.content[0].text as string;
    } else {
      responseText = JSON.stringify(response.content[0]);
    }

    console.log(`${logPrefix} Received response from Claude (${responseText.length} characters)`);
    console.log(`${logPrefix} First 100 chars: ${responseText.substring(0, 100)}...`);

    // Extract JSON from the response, handling cases where Claude includes extra text
    let jsonString = responseText.trim();

    // Try multiple extraction strategies if needed
    let chapterConcepts: KeyConceptsResponse;

    // Strategy 1: Try to parse the full response directly
    try {
      chapterConcepts = JSON.parse(jsonString) as KeyConceptsResponse;
      console.log(`${logPrefix} ✅ Successfully parsed JSON directly`);
    } catch (directError) {
      console.log(`${logPrefix} Direct JSON parsing failed, trying extraction methods`);

      // Strategy 2: Find and extract JSON object using regex
      try {
        // Find JSON boundaries if Claude added explanatory text
        const jsonMatch = responseText.match(/(\{[\s\S]*\})/);

        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log(`${logPrefix} Extracted JSON object using regex: ${jsonString.substring(0, 100)}...`);
          chapterConcepts = JSON.parse(jsonString) as KeyConceptsResponse;
          console.log(`${logPrefix} ✅ Successfully parsed JSON using regex extraction`);
        } else {
          // Strategy 3: Try to find from explicit start/end positions
          const jsonStartMatch = responseText.match(/(\{|\[)/);
          const jsonEndMatch = responseText.match(/(\}|\])(?=[^{}[\]]*$)/);

          if (jsonStartMatch && jsonEndMatch) {
            const startIndex = jsonStartMatch.index ?? 0;
            const endIndex = (jsonEndMatch.index ?? 0) + 1;
            jsonString = responseText.substring(startIndex, endIndex);
            console.log(`${logPrefix} Extracted JSON using boundary positions: ${jsonString.substring(0, 100)}...`);
            chapterConcepts = JSON.parse(jsonString) as KeyConceptsResponse;
            console.log(`${logPrefix} ✅ Successfully parsed JSON using boundary extraction`);
          } else {
            // If all extraction methods fail, throw the original error
            throw directError;
          }
        }
      } catch (extractionError) {
        console.error(`${logPrefix} All JSON extraction methods failed`);
        console.error(`${logPrefix} Original response (first 500 chars): ${responseText.substring(0, 500)}...`);
        throw new Error(`Could not extract valid JSON from Claude response: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`);
      }
    }

    // Step 9: Add chapter prefix to concept names
    const enhancedConcepts = chapterConcepts.key_concepts.map(concept => ({
      concept: `[Ch ${chapter.chapterNumber}] ${concept.concept}`,
      description: concept.description
    }));

    // Step 10: Get existing concepts from Supabase
    const { data: existingData, error: existingError } = await supabase
      .from('book_concepts')
      .select('id, concepts')
      .eq('book_id', book_id)
      .single();

    if (existingError) {
      throw new Error(`Failed to fetch existing concepts: ${existingError.message}`);
    }

    if (!existingData) {
      throw new Error(`No existing concepts record found for book ID: ${book_id}`);
    }

    // Step 11: Merge new concepts with existing concepts
    const existingConcepts = existingData.concepts.key_concepts || [];

    // Filter out any existing concepts from this chapter
    const filteredConcepts = existingConcepts.filter(
      (concept: KeyConcept) => !concept.concept.startsWith(`[Ch ${chapter.chapterNumber}]`)
    );

    // Add the new chapter concepts
    const mergedConcepts = [...filteredConcepts, ...enhancedConcepts];

    // Re-create processing_info if it exists
    const updatedConceptsData: Record<string, unknown> = {
      key_concepts: mergedConcepts
    };

    if (existingData.concepts.processing_info) {
      const processingInfo = existingData.concepts.processing_info;

      // Remove the chapter from failed_chapters if it exists
      const failedChapters = processingInfo.failed_chapters || [];
      const updatedFailedChapters = failedChapters.filter(
        (fc: Record<string, unknown>) => fc.chapter !== chapter_number
      );

      // Update processed_chapters count if needed
      let processedChapters = processingInfo.processed_chapters || 0;
      const wasFailedBefore = failedChapters.some((fc: Record<string, unknown>) => fc.chapter === chapter_number);
      if (wasFailedBefore) {
        processedChapters++;
      }

      updatedConceptsData.processing_info = {
        ...processingInfo,
        processed_chapters: processedChapters,
        failed_chapters: updatedFailedChapters
      };
    }

    // Step 12: Update the concepts in Supabase
    const { error: updateError } = await supabase
      .from('book_concepts')
      .update({
        concepts: updatedConceptsData,
        updated_at: new Date()
      })
      .eq('id', existingData.id);

    if (updateError) {
      throw new Error(`Failed to update concepts: ${updateError.message}`);
    }

    console.log(`${logPrefix} ========== CHAPTER RETRY COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${bookTitle}" (ID: ${book_id})`);
    console.log(`${logPrefix} Chapter: ${chapter.chapterNumber}: ${chapter.title}`);
    console.log(`${logPrefix} Concepts extracted: ${enhancedConcepts.length}`);
    console.log(`${logPrefix} Total concepts after merge: ${mergedConcepts.length}`);
    console.log(`${logPrefix} =======================================`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed Chapter ${chapter_number} for "${bookTitle}"`,
      book: {
        id: book.id,
        title: book.title,
      },
      chapter: {
        number: chapter.chapterNumber,
        title: chapter.title,
      },
      concepts_extracted: enhancedConcepts.length,
      total_concepts: mergedConcepts.length,
      new_concepts: enhancedConcepts,
      storage_info: {
        database: "Supabase",
        table: "book_concepts",
        record_id: existingData.id
      }
    });

  } catch (error) {
    console.error(`${logPrefix} Error in chapter retry process:`, error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}