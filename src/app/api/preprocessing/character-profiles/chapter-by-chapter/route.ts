/**
 * API endpoint for generating character profiles from a book chapter by chapter
 * 
 * This endpoint is specifically designed for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)
 * which is too large to process as a single unit. It processes one chapter at a time to avoid
 * context window limitations and reduce the risk of rate limiting errors.
 */
import { NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

// Interfaces for data structures
interface CharacterProfile {
  character_name: string;
  character_profile: string;
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

// Map to track rate limiting and prevent excessive API calls
const apiCallTracker = {
  lastCallTime: 0,
  minimumDelayMs: 5000, // 5 second minimum delay between API calls
  canMakeCall: function () {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;
    return timeSinceLastCall >= this.minimumDelayMs;
  },
  recordCall: function () {
    this.lastCallTime = Date.now();
  }
};

// Sleep function for rate limiting
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Chapter-Character-Profiles][${requestId}]`;

  console.log(`${logPrefix} === STARTING CHAPTER-BY-CHAPTER CHARACTER PROFILE GENERATION ===`);

  try {
    // Parse request body
    const body = await req.json();
    const { book_id, chapter_number, debug = false } = body;

    // This endpoint is specifically for the psychology textbook
    const targetBookId = '2b169bda-011b-4834-8454-e30fed95669d';

    if (book_id !== targetBookId) {
      return NextResponse.json({
        error: 'This endpoint is only for book ID: 2b169bda-011b-4834-8454-e30fed95669d'
      }, { status: 400 });
    }

    if (!chapter_number) {
      return NextResponse.json({ error: 'Chapter number is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Processing Chapter ${chapter_number} for book ID: ${book_id}`);

    // Step 1: Get book metadata from Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author')
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

    // Step 6: Process this chapter to identify characters and create profiles

    // First, identify characters in this chapter
    console.log(`${logPrefix} Identifying characters in Chapter ${chapter_number}...`);

    // Check rate limits and wait if necessary
    if (!apiCallTracker.canMakeCall()) {
      const waitTime = apiCallTracker.minimumDelayMs;
      console.log(`${logPrefix} Rate limiting: waiting ${waitTime}ms before making API call`);
      await sleep(waitTime);
    }

    // Record this API call
    apiCallTracker.recordCall();

    const charactersInChapter = await identifyCharactersInChapter(
      bookTitle,
      chapter.title,
      chapter.chapterNumber,
      chapterContent,
      debug
    );

    console.log(`${logPrefix} Found ${charactersInChapter.length} characters in Chapter ${chapter_number}`);

    // Next, generate profiles for these characters
    console.log(`${logPrefix} Generating profiles for characters in Chapter ${chapter_number}...`);

    const characterProfiles: CharacterProfile[] = [];

    // Process each character with rate limiting
    for (const character of charactersInChapter) {
      console.log(`${logPrefix} Processing character: ${character}`);

      // Check rate limits and wait if necessary
      if (!apiCallTracker.canMakeCall()) {
        const waitTime = apiCallTracker.minimumDelayMs;
        console.log(`${logPrefix} Rate limiting: waiting ${waitTime}ms before making API call`);
        await sleep(waitTime);
      }

      // Record this API call
      apiCallTracker.recordCall();

      try {
        const profile = await generateCharacterProfile(
          character,
          bookTitle,
          chapter.title,
          chapter.chapterNumber,
          chapterContent,
          debug
        );

        characterProfiles.push(profile);
        console.log(`${logPrefix} Successfully generated profile for "${character}"`);
      } catch (profileError) {
        console.error(`${logPrefix} Error generating profile for "${character}":`, profileError);

        // Add a placeholder profile with error information
        characterProfiles.push({
          character_name: character,
          character_profile: `ERROR: Failed to generate profile for character "${character}" in Chapter ${chapter_number}. Error: ${profileError instanceof Error ? profileError.message : String(profileError)
            }`
        });

        // Continue with the next character
      }
    }

    // Step 7: Get existing character profiles from Supabase
    console.log(`${logPrefix} Retrieving existing character profiles for book ID: ${book_id}`);

    const { data: existingProfiles, error: profilesError } = await supabase
      .from('book_character_profiles')
      .select('id, character_name, character_profile')
      .eq('book_id', book_id);

    if (profilesError) {
      console.error(`${logPrefix} Error fetching existing profiles:`, profilesError);
    }

    const existingProfileMap = new Map<string, { id: string, profile: string }>();

    // Create a map of existing profiles for easy lookup
    if (existingProfiles && existingProfiles.length > 0) {
      console.log(`${logPrefix} Found ${existingProfiles.length} existing character profiles`);

      for (const profile of existingProfiles) {
        existingProfileMap.set(profile.character_name.toLowerCase(), {
          id: profile.id,
          profile: profile.character_profile
        });
      }
    } else {
      console.log(`${logPrefix} No existing character profiles found`);
    }

    // Step 8: Store the character profiles in Supabase
    console.log(`${logPrefix} Storing/updating character profiles in database...`);

    // Track storage operations
    const storageResults = {
      created: 0,
      updated: 0,
      errors: 0
    };

    // Process each profile
    for (const profile of characterProfiles) {
      // Normalize character name for comparison
      const normalizedName = profile.character_name.toLowerCase();

      try {
        if (existingProfileMap.has(normalizedName)) {
          // Update existing profile with merged content
          const existingData = existingProfileMap.get(normalizedName)!;
          const existingProfile = existingData.profile;

          // Create enhanced profile by combining existing and new information
          let enhancedProfile: string;

          // If the existing profile already contains chapter information, don't duplicate it
          if (existingProfile.includes(`Chapter ${chapter_number}`)) {
            console.log(`${logPrefix} Chapter ${chapter_number} information already exists for "${profile.character_name}"`);
            enhancedProfile = existingProfile;
          } else {
            // Add chapter-specific information to the profile
            enhancedProfile = `${existingProfile}\n\n**CHAPTER ${chapter_number} INFORMATION:** ${profile.character_profile}`;
          }

          // Update the profile in Supabase
          const { error: updateError } = await supabase
            .from('book_character_profiles')
            .update({
              character_profile: enhancedProfile,
              updated_at: new Date()
            })
            .eq('id', existingData.id);

          if (updateError) {
            console.error(`${logPrefix} Error updating profile for "${profile.character_name}":`, updateError);
            storageResults.errors++;
          } else {
            console.log(`${logPrefix} Updated profile for "${profile.character_name}" with Chapter ${chapter_number} information`);
            storageResults.updated++;
          }
        } else {
          // Create a new profile
          // Add chapter prefix to the profile
          const enhancedProfile = `**CHARACTER OVERVIEW:** A character from ${bookTitle}.\n\n**CHAPTER ${chapter_number} INFORMATION:** ${profile.character_profile}`;

          // Insert new profile
          const { error: insertError } = await supabase
            .from('book_character_profiles')
            .insert({
              book_id: book.id,
              book_title: book.title,
              character_name: profile.character_name,
              character_profile: enhancedProfile
            });

          if (insertError) {
            console.error(`${logPrefix} Error creating profile for "${profile.character_name}":`, insertError);
            storageResults.errors++;
          } else {
            console.log(`${logPrefix} Created new profile for "${profile.character_name}" from Chapter ${chapter_number}`);
            storageResults.created++;
          }
        }
      } catch (storageError) {
        console.error(`${logPrefix} Error processing storage for "${profile.character_name}":`, storageError);
        storageResults.errors++;
      }
    }

    // Step 9: Return success response
    console.log(`${logPrefix} ========== CHAPTER ${chapter_number} CHARACTER PROFILE GENERATION COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${bookTitle}" (ID: ${book.id})`);
    console.log(`${logPrefix} Chapter: ${chapter.chapterNumber}: ${chapter.title}`);
    console.log(`${logPrefix} Characters processed: ${characterProfiles.length}`);
    console.log(`${logPrefix} Storage results: ${storageResults.created} created, ${storageResults.updated} updated, ${storageResults.errors} errors`);
    console.log(`${logPrefix} =======================================`);

    return NextResponse.json({
      success: true,
      message: `Successfully processed Chapter ${chapter_number} character profiles for "${bookTitle}"`,
      book: {
        id: book.id,
        title: book.title,
      },
      chapter: {
        number: chapter.chapterNumber,
        title: chapter.title,
      },
      characters_processed: characterProfiles.length,
      character_names: characterProfiles.map(p => p.character_name),
      storage_results: storageResults,
      storage_info: {
        database: "Supabase",
        table: "book_character_profiles"
      }
    });

  } catch (error) {
    console.error(`${logPrefix} Error in chapter-by-chapter character profile generation:`, error);

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * Identify important characters in a specific chapter
 */
async function identifyCharactersInChapter(
  bookTitle: string,
  chapterTitle: string,
  chapterNumber: string,
  chapterContent: string,
  debug: boolean = false
): Promise<string[]> {
  console.log(`[CharacterService] Identifying characters in Chapter ${chapterNumber}: ${chapterTitle}`);

  // Truncate chapter content if it's too large
  const truncatedContent = chapterContent.length > 80000
    ? chapterContent.substring(0, 80000)
    : chapterContent;

  // Create a prompt that focuses on this specific chapter
  const charPrompt = `Identify the important individuals, theorists, clinicians, researchers, or concepts personified in Chapter ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}".

Return ONLY a JSON array of names, with no explanation or commentary. For example:
["Name 1", "Name 2", "Name 3"]

For a psychology textbook or academic work, these "characters" might include:
1. Theorists and researchers whose ideas are discussed (e.g., "Sigmund Freud", "Aaron Beck")
2. Case studies of patients or clients mentioned by name (e.g., "John" or "Patient X")
3. Important personified concepts if they are treated as entities in the text

Limit your response to 5-15 most significant individuals mentioned in this specific chapter.

IMPORTANT: Your entire response must be a valid JSON array that can be parsed directly.

Chapter ${chapterNumber} Content:
${truncatedContent}`;

  try {
    console.log(`[CharacterService] Sending character identification request to Claude for Chapter ${chapterNumber}...`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0,
      system: "You are an AI assistant specialized in literary and academic analysis. You extract important individuals and concepts from text.",
      messages: [
        { role: "user", content: charPrompt }
      ],
    });

    // Check if the content block is a text block before accessing text property
    const contentBlock = response.content[0];
    const responseText = 'text' in contentBlock ? contentBlock.text : JSON.stringify(contentBlock);

    if (debug) {
      console.log(`[CharacterService][DEBUG] Raw character identification response: ${responseText}`);
    }

    // Extract JSON from the text if needed
    let jsonText = responseText.trim();

    // If the response doesn't start with '[', try to find the JSON array
    if (!jsonText.startsWith('[')) {
      const match = responseText.match(/\[[\s\S]*\]/);
      if (match) {
        jsonText = match[0];
        if (debug) {
          console.log(`[CharacterService][DEBUG] Extracted JSON array: ${jsonText}`);
        }
      }
    }

    try {
      const characterList = JSON.parse(jsonText) as string[];
      console.log(`[CharacterService] Identified ${characterList.length} characters in Chapter ${chapterNumber}: ${characterList.join(', ')}`);
      return characterList;
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      console.error(`[CharacterService] JSON parsing error: ${errorMessage}`);

      // Fallback: try to parse as a list
      if (debug) {
        console.log(`[CharacterService][DEBUG] Falling back to line-by-line parsing`);
      }

      const characters: string[] = [];
      const lines = responseText.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        // Look for character names in various formats
        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        const numberMatch = line.match(/^\s*\d+\.\s+(.+)$/);
        const quoteMatch = line.match(/"([^"]+)"/);

        if (bulletMatch) {
          characters.push(bulletMatch[1].trim());
        } else if (numberMatch) {
          characters.push(numberMatch[1].trim());
        } else if (quoteMatch) {
          characters.push(quoteMatch[1].trim());
        } else if (line.length > 0 && line.length < 50 && !line.includes(':')) {
          // Simple name on a line by itself (with length limit to avoid paragraphs)
          characters.push(line.trim());
        }
      }

      if (characters.length > 0) {
        console.log(`[CharacterService] Extracted ${characters.length} characters using fallback parsing for Chapter ${chapterNumber}: ${characters.join(', ')}`);
        return characters;
      }

      throw new Error(`Failed to parse character list from Chapter ${chapterNumber}: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }
  } catch (error) {
    console.error(`[CharacterService] Error identifying characters in Chapter ${chapterNumber}:`, error);
    throw new Error(`Failed to identify characters in Chapter ${chapterNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a detailed profile for a specific character based on chapter content
 */
async function generateCharacterProfile(
  characterName: string,
  bookTitle: string,
  chapterTitle: string,
  chapterNumber: string,
  chapterContent: string,
  debug: boolean = false
): Promise<CharacterProfile> {
  console.log(`[CharacterService] Generating profile for "${characterName}" from Chapter ${chapterNumber}`);

  // Truncate chapter content if it's too large
  const truncatedContent = chapterContent.length > 80000
    ? chapterContent.substring(0, 80000)
    : chapterContent;

  // Create a profile prompt specific to this character and chapter
  const profilePrompt = `Create a concise profile for ${characterName} based on Chapter ${chapterNumber}: "${chapterTitle}" from the book "${bookTitle}".

EXTREMELY IMPORTANT: Your response must be properly formatted JSON with all newlines and special characters correctly escaped.

Output your analysis in the following JSON format:
{
  "character_name": "${characterName}",
  "character_profile": "Write a comprehensive but concise profile that covers the following aspects where applicable:
  
1. WHO THEY ARE: Their identity, background, and significance in the field
2. KEY CONTRIBUTIONS: Their major theories, research findings, or contributions
3. RELEVANCE TO CHAPTER: How they specifically relate to the themes of Chapter ${chapterNumber}
4. QUOTED WORK: Any specific publications, experiments, or case studies mentioned
5. RELATED CONCEPTS: Key concepts, methodologies, or approaches associated with them

If this is a patient case study, focus on:
1. PRESENTATION: Key symptoms, history, or presenting problems
2. TREATMENT APPROACH: Methods used or recommended for their care
3. OUTCOMES: Any discussed results or prognosis
4. LEARNING POINTS: The key lessons their case illustrates"
}

Return ONLY the JSON object without any explanation, introduction, or additional commentary.

Chapter ${chapterNumber} Content (focused on ${characterName}):
${truncatedContent}`;

  try {
    console.log(`[CharacterService] Sending profile generation request to Claude for "${characterName}" in Chapter ${chapterNumber}...`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      temperature: 0,
      system: "You are an AI assistant specialized in academic and literary analysis. You create concise, factual profiles of individuals and concepts from text.",
      messages: [
        { role: "user", content: profilePrompt }
      ],
    });

    // Check if the content block is a text block before accessing text property
    const contentBlock = response.content[0];
    const responseText = 'text' in contentBlock ? contentBlock.text : JSON.stringify(contentBlock);

    console.log(`[CharacterService] Received profile response for "${characterName}" (${responseText.length} chars)`);

    // Extract JSON from the text if needed
    let jsonText = responseText.trim();

    // If the response doesn't start with '{', try to find the JSON object
    if (!jsonText.startsWith('{')) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
        if (debug) {
          console.log(`[CharacterService][DEBUG] Extracted JSON object: ${jsonText.substring(0, 100)}...`);
        }
      }
    }

    try {
      const profile = JSON.parse(jsonText) as CharacterProfile;
      console.log(`[CharacterService] Successfully parsed profile for "${characterName}" from Chapter ${chapterNumber} (${profile.character_profile.length} characters)`);

      // Verify the JSON structure is correct
      if (!profile.character_name || !profile.character_profile) {
        throw new Error('Profile is missing required fields');
      }

      return profile;
    } catch (jsonError) {
      console.error(`[CharacterService] JSON parsing error for "${characterName}": ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);

      // Fallback: Use the original text as a profile
      if (debug) {
        console.log(`[CharacterService][DEBUG] Falling back to using raw text response as profile for "${characterName}"`);
      }

      // Create a profile object manually
      const profile: CharacterProfile = {
        character_name: characterName,
        character_profile: `Failed to parse JSON response. Raw text: ${responseText.trim().substring(0, 1000)}...`
      };

      return profile;
    }
  } catch (error) {
    console.error(`[CharacterService] Error generating profile for "${characterName}" in Chapter ${chapterNumber}:`, error);
    throw new Error(`Failed to generate character profile for "${characterName}" in Chapter ${chapterNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }
}