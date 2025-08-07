/**
 * Simple API endpoint for retrying a specific chapter extraction
 * 
 * Focused on one specific chapter only - does only the minimum required work
 */
import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Simple-Retry][${requestId}]`;

  console.log(`${logPrefix} === STARTING SIMPLE RETRY ===`);

  try {
    // Parse request body
    const body = await req.json();
    const { } = body; // Not using body parameters as we're using hardcoded values

    // HARDCODED FOR CHAPTER 16
    const bookId = "2b169bda-011b-4834-8454-e30fed95669d";
    const chapterNum = "16";

    console.log(`${logPrefix} Processing book ID: ${bookId}, chapter: ${chapterNum}`);

    // Step 1: Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      throw new Error(`Failed to fetch book: ${bookError?.message || 'Book not found'}`);
    }

    const bookTitle = book.title;
    console.log(`${logPrefix} Found book "${bookTitle}" (ID: ${book.id})`);

    // Step 2: Load the book structure
    const structureFilePath = path.join(process.cwd(), 'src', 'tools', 'book_structure_analysis.json');
    const structure = JSON.parse(fs.readFileSync(structureFilePath, 'utf8'));

    // Step 3: Find the specific chapter
    const chapter = structure.chapters.find((ch: { chapterNumber: string }) => ch.chapterNumber === chapterNum);
    if (!chapter) {
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 });
    }

    console.log(`${logPrefix} Found chapter: ${chapter.title}`);

    // Step 4: Extract the chapter content
    const bookFilePath = structure.bookPath;
    const bookContent = fs.readFileSync(bookFilePath, 'utf8');
    const lines = bookContent.split('\n');

    // Find next chapter to determine end line
    const chapterIndex = structure.chapters.findIndex((ch: { chapterNumber: string }) => ch.chapterNumber === chapterNum);
    const nextChapter = chapterIndex < structure.chapters.length - 1
      ? structure.chapters[chapterIndex + 1]
      : null;

    const startLine = chapter.lineNumber - 1;
    const endLine = nextChapter ? nextChapter.lineNumber - 1 : lines.length;
    const chapterContent = lines.slice(startLine, endLine).join('\n');

    console.log(`${logPrefix} Extracted chapter content: ${chapterContent.length} characters`);

    // Step 5: Process with Claude
    const prompt = `Extract key concepts for Chapter ${chapterNum}: ${chapter.title} from the book "${bookTitle}".
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

    console.log(`${logPrefix} Sending request to Claude...`);
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      system: "You are an AI assistant that analyzes book content and extracts key concepts in valid JSON format. You MUST ONLY return valid JSON, with no explanatory text before or after it.",
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Parse the response
    let responseText = '';
    if ('text' in response.content[0]) {
      responseText = response.content[0].text as string;
    } else {
      responseText = JSON.stringify(response.content[0]);
    }

    console.log(`${logPrefix} Received response from Claude (${responseText.length} characters)`);

    // Parse the JSON
    let jsonString = responseText.trim();
    let extractedConcepts;

    // Try multiple parsing strategies
    try {
      extractedConcepts = JSON.parse(jsonString);
      console.log(`${logPrefix} Successfully parsed JSON directly`);
    } catch (directError) {
      // Try regex extraction
      try {
        const jsonMatch = responseText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
          extractedConcepts = JSON.parse(jsonString);
          console.log(`${logPrefix} Successfully parsed JSON using regex extraction`);
        } else {
          throw directError;
        }
      } catch (error) {
        console.error(`${logPrefix} Failed to parse JSON:`, error);
        return NextResponse.json({ error: 'Failed to parse JSON response' }, { status: 500 });
      }
    }

    // Add chapter prefix to concepts
    const enhancedConcepts = extractedConcepts.key_concepts.map((concept: { concept: string; description: string }) => ({
      concept: `[Ch ${chapterNum}] ${concept.concept}`,
      description: concept.description
    }));

    console.log(`${logPrefix} Extracted ${enhancedConcepts.length} concepts`);

    // Get existing concepts from DB
    const { data: existingData, error: existingError } = await supabase
      .from('book_concepts')
      .select('id, concepts')
      .eq('book_id', bookId)
      .single();

    if (existingError) {
      throw new Error(`Failed to fetch existing concepts: ${existingError.message}`);
    }

    if (!existingData) {
      throw new Error(`No existing concepts record found for book ID: ${bookId}`);
    }

    // Filter out existing concepts for this chapter
    const existingConcepts = existingData.concepts.key_concepts || [];
    const filteredConcepts = existingConcepts.filter(
      (concept: { concept: string }) => !concept.concept.startsWith(`[Ch ${chapterNum}]`)
    );

    // Merge concepts
    const mergedConcepts = [...filteredConcepts, ...enhancedConcepts];

    // Define interfaces for concepts data structure
    interface ProcessingInfo {
      processed_chapters: number;
      failed_chapters: Array<{ chapter: string }>;
      [key: string]: unknown;
    }

    interface ConceptsData {
      key_concepts: Array<{ concept: string; description: string }>;
      processing_info?: ProcessingInfo;
    }

    // Update processing info
    let updatedConceptsData: ConceptsData = {
      key_concepts: mergedConcepts
    };

    if (existingData.concepts.processing_info) {
      const processingInfo = existingData.concepts.processing_info as ProcessingInfo;

      // Remove from failed chapters
      const failedChapters = processingInfo.failed_chapters || [];
      const updatedFailedChapters = failedChapters.filter(
        (fc: { chapter: string }) => fc.chapter !== chapterNum
      );

      // Update processed count if needed
      let processedChapters = processingInfo.processed_chapters || 0;
      const wasFailedBefore = failedChapters.some((fc: { chapter: string }) => fc.chapter === chapterNum);
      if (wasFailedBefore) {
        processedChapters++;
      }

      updatedConceptsData = {
        ...updatedConceptsData,
        processing_info: {
          ...processingInfo,
          processed_chapters: processedChapters,
          failed_chapters: updatedFailedChapters
        }
      };
    }

    // Update in Supabase
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

    console.log(`${logPrefix} Successfully updated concepts in Supabase`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed Chapter ${chapterNum}`,
      concepts_extracted: enhancedConcepts.length,
      total_concepts: mergedConcepts.length
    });

  } catch (error) {
    console.error(`${logPrefix} Error:`, error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}