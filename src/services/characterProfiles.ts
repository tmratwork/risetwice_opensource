// src/services/characterProfiles.ts
import { anthropic } from '@/lib/anthropic';
import { supabase } from '@/lib/supabase';

interface CharacterProfile {
  character_name: string;
  character_profile: string;
}

export async function generateCharacterProfilesFromBook(book_id: string, debug: boolean = false): Promise<CharacterProfile[]> {
  // Enable more detailed logging if debug mode is enabled
  // const logLevel = debug ? 'debug' : 'info'; // Not currently used

  // Debug logging function - uncomment if needed
  // function debugLog(...args: unknown[]) {
  //   if (debug) {
  //     console.log(...args);
  //   }
  // }
  console.log(`[CharacterProfileService] Starting character profile generation for book_id: ${book_id}`);

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

  console.log(`[CharacterProfileService] Successfully fetched book "${book.title}" by ${book.author} with ${book.content.length} characters`);

  // 2. Extract main characters using Claude
  console.log(`[CharacterProfileService] Step 1: Identifying main characters...`);
  const mainCharacters = await identifyMainCharacters(book.title, book.content, debug);

  console.log(`[CharacterProfileService] Identified ${mainCharacters.length} main characters: ${mainCharacters.join(', ')}`);

  // 3. Generate detailed profiles for each character in batches
  console.log(`[CharacterProfileService] Step 2: Generating detailed character profiles in batches...`);
  const characterProfiles: CharacterProfile[] = [];

  // Batch processing setup
  const batchSize = 5; // Process up to 5 characters per batch
  const totalCharacters = mainCharacters.length;
  const batches = Math.ceil(totalCharacters / batchSize);

  console.log(`[CharacterProfileService] Processing ${totalCharacters} characters in ${batches} batches of up to ${batchSize} characters each`);

  // Process characters in batches
  for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, totalCharacters);
    const currentBatch = mainCharacters.slice(startIdx, endIdx);

    console.log(`[CharacterProfileService] Processing batch ${batchIndex + 1}/${batches} with ${currentBatch.length} characters: ${currentBatch.join(', ')}`);

    // Process characters in this batch
    for (const character of currentBatch) {
      console.log(`[CharacterProfileService] Generating profile for character: ${character}`);

      try {
        // Pass debug flag to get detailed logs for each character profile
        const profile = await generateCharacterProfile(character, book.title, book.content, debug);
        characterProfiles.push(profile);
        console.log(`[CharacterProfileService] Successfully generated profile for ${character} (${profile.character_profile.length} characters)`);
      } catch (profileError) {
        console.error(`[CharacterProfileService] ❌ ERROR generating profile for ${character}:`, profileError);

        // Add the character anyway with an error message
        if (debug) {
          console.error(`[CharacterProfileService] Full error details:`, profileError);
        }

        // Continue with other characters rather than failing the whole batch
        const errorProfile: CharacterProfile = {
          character_name: character,
          character_profile: `ERROR: Failed to generate profile for ${character}. Error: ${profileError instanceof Error ? profileError.message : String(profileError)
            }`
        };
        characterProfiles.push(errorProfile);
      }
    }

    console.log(`[CharacterProfileService] Completed batch ${batchIndex + 1}/${batches}`);
  }

  // 4. Store the character profiles in Supabase
  console.log(`[CharacterProfileService] Step 3: Storing character profiles in database...`);
  const storageResult = await storeCharacterProfilesInSupabase(book.id, book.title, characterProfiles);

  // 5. Log detailed summary
  console.log(`[CharacterProfileService] ========== CHARACTER PROFILE GENERATION COMPLETE ==========`);
  console.log(`[CharacterProfileService] Book: "${book.title}" (ID: ${book.id})`);
  console.log(`[CharacterProfileService] Table: book_character_profiles`);
  console.log(`[CharacterProfileService] Storage Operation: ${storageResult.operation}`);
  console.log(`[CharacterProfileService] Record ID: ${storageResult.recordId || 'N/A'}`);
  console.log(`[CharacterProfileService] Total Characters: ${characterProfiles.length}`);
  console.log(`[CharacterProfileService] Characters:`);
  characterProfiles.forEach((profile, index) => {
    console.log(`[CharacterProfileService]   ${index + 1}. ${profile.character_name}`);
  });
  console.log(`[CharacterProfileService] =======================================`);

  return characterProfiles;
}

/**
 * Identify the main characters in a book using Claude
 */
async function identifyMainCharacters(bookTitle: string, bookContent: string, debug: boolean = false): Promise<string[]> {
  // Log verbosely if debug is enabled
  const log = debug ? console.log.bind(console) : function () { };

  const charPrompt = "Identify the main characters (protagonist, antagonist, and supporting characters) in the book \"" +
    bookTitle + "\". \n\nReturn a JSON array of names only, with no explanation or commentary. For example:\n" +
    "[\"Character Name 1\", \"Character Name 2\", \"Character Name 3\"]\n\n" +
    "Limit your response to the 3-7 most important characters in the narrative.\n\n" +
    "Book Content (first 50,000 characters):\n" + bookContent.substring(0, 50000);

  try {
    console.log(`[CharacterProfileService] Sending character identification request to Claude...`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0,
      system: "You are an AI assistant specialized in literary analysis. You extract character information from book text.",
      messages: [
        { role: "user", content: charPrompt }
      ],
    });

    // Check if the content block is a text block before accessing text property
    const contentBlock = response.content[0];
    const responseText = 'text' in contentBlock ? contentBlock.text : JSON.stringify(contentBlock);
    if (debug) {
      log(`[CharacterProfileService][DEBUG] Raw character identification response: ${responseText}`);
    }

    // Extract JSON from the text if needed
    let jsonText = responseText.trim();

    // If the response doesn't start with '[', try to find the JSON array
    if (!jsonText.startsWith('[')) {
      const match = responseText.match(/\[[\s\S]*\]/);
      if (match) {
        jsonText = match[0];
        if (debug) {
          log(`[CharacterProfileService][DEBUG] Extracted JSON array: ${jsonText}`);
        }
      }
    }

    try {
      const characterList = JSON.parse(jsonText) as string[];
      console.log(`[CharacterProfileService] Identified ${characterList.length} characters: ${characterList.join(', ')}`);
      return characterList;
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      console.error(`[CharacterProfileService] JSON parsing error: ${errorMessage}`);

      // Fallback: try to parse as a list
      if (debug) {
        log(`[CharacterProfileService][DEBUG] Falling back to line-by-line parsing`);
      }

      const characters: string[] = [];
      const lines = responseText.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        // Look for character names in various formats
        const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
        const numberMatch = line.match(/^\s*\d+\.\s+(.+)$/);

        if (bulletMatch) {
          characters.push(bulletMatch[1].trim());
        } else if (numberMatch) {
          characters.push(numberMatch[1].trim());
        } else if (line.length > 0 && line.length < 50 && !line.includes(':')) {
          // Simple name on a line by itself
          characters.push(line.trim());
        }
      }

      if (characters.length > 0) {
        console.log(`[CharacterProfileService] Extracted ${characters.length} characters using fallback: ${characters.join(', ')}`);
        return characters;
      }

      throw new Error(`Failed to parse character list: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }
  } catch (error) {
    console.error('[CharacterProfileService] Error identifying main characters:', error);

    // If debug is enabled, provide more detailed error information
    if (debug && error instanceof Error) {
      console.error('[CharacterProfileService][DEBUG] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: 'code' in error ? error.code : undefined
      });

      if (error instanceof Error) {
        console.error('[CharacterProfileService][DEBUG] Original error:', error);
      }
    }

    throw new Error(`Failed to identify main characters: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a detailed profile for a specific character using Claude
 */
async function generateCharacterProfile(characterName: string, bookTitle: string, bookContent: string, debug: boolean = false): Promise<CharacterProfile> {
  // Log verbosely if debug is enabled
  const log = debug ? console.log.bind(console) : function () { };

  // Create prompt parts without template literals
  const part1 = "Create a comprehensive character profile for " + characterName + " from the book \"" + bookTitle + "\" that will enable AI to authentically embody the character in conversation.\n\n";
  const part2 = "EXTREMELY IMPORTANT: Your response must be properly formatted JSON with all newlines and special characters correctly escaped.\n\n";
  const part3 = "Output your analysis in the following JSON format:\n\n";
  const part4 = "{\n  \"character_name\": \"" + characterName + "\",\n  \"character_profile\": \"Write a comprehensive, flowing narrative that covers the character's identity, psychology, communication style, relationships, character arc, thematic significance, response patterns, and knowledge boundaries. Make sure to place all section headers (IDENTITY, PSYCHOLOGY, etc.) inline with the text, using **bold formatting** for section headers instead of placing them on separate lines. Do not use actual line breaks in the text itself - format the entire profile as a single continuous string with formatting markup instead of separate lines.\"\n}\n\n";
  const part5 = "Here's an example of proper formatting for a section:\n\"**IDENTITY:** John Smith is a complex character who... **PSYCHOLOGY:** His thought patterns reveal...\"\n\n";
  const part6 = "DO NOT use actual line breaks between sections - the entire character_profile must be a single continuous string with no line breaks, using only formatting markers to indicate section changes.\n\n";
  const part7 = "This is CRITICAL: The character_profile value must be valid within a JSON string - any line breaks will break the JSON format.\n\n";
  const bookIntro = "Book Content (first 100,000 characters):\n";
  const part8 = bookIntro + bookContent.substring(0, 100000);

  // Combine all parts
  const prompt = part1 + part2 + part3 + part4 + part5 + part6 + part7 + part8;

  // Log the prompt length for debugging
  if (debug) {
    log(`[CharacterProfileService][DEBUG] Generated prompt with ${prompt.length} characters`);
  }

  try {
    console.log(`[CharacterProfileService] Sending profile generation request to Claude for character: ${characterName}...`);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      temperature: 0,
      system: "You are an AI assistant specialized in literary analysis and character development. You create comprehensive character profiles based on book text.",
      messages: [
        { role: "user", content: prompt }
      ],
    });

    // Check if the content block is a text block before accessing text property
    const contentBlock = response.content[0];
    const responseText = 'text' in contentBlock ? contentBlock.text : JSON.stringify(contentBlock);
    console.log(`[CharacterProfileService] Received profile response for ${characterName} (${responseText.length} chars)`);

    // With debug mode, show a snippet of the response
    if (debug) {
      log(`[CharacterProfileService][DEBUG] First 500 chars of response for ${characterName}:`);
      log(`${responseText.substring(0, 500)}...`);
    }

    // Extract JSON from the text if needed
    let jsonText = responseText.trim();

    // If the response doesn't start with '{', try to find the JSON object
    if (!jsonText.startsWith('{')) {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonText = match[0];
        if (debug) {
          log(`[CharacterProfileService][DEBUG] Extracted JSON object: ${jsonText.substring(0, 100)}...`);
        }
      }
    }

    try {
      const profile = JSON.parse(jsonText) as CharacterProfile;
      console.log(`[CharacterProfileService] ✅ Successfully parsed profile for ${characterName} (${profile.character_profile.length} characters)`);

      // Verify the JSON structure is correct
      if (!profile.character_name || !profile.character_profile) {
        throw new Error('Profile is missing required fields');
      }

      return profile;
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      console.error(`[CharacterProfileService] JSON parsing error: ${errorMessage}`);

      // Fallback: Use the original text as a profile
      if (debug) {
        log(`[CharacterProfileService][DEBUG] Falling back to using raw text response as profile`);
      }

      // Create a profile object manually
      const profile: CharacterProfile = {
        character_name: characterName,
        character_profile: responseText.trim()
      };

      console.log(`[CharacterProfileService] Created profile for ${characterName} using fallback (${profile.character_profile.length} characters)`);
      return profile;
    }
  } catch (error) {
    console.error(`[CharacterProfileService] Error generating profile for ${characterName}:`, error);
    throw new Error(`Failed to generate character profile: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface StorageResult {
  operation: 'create_table' | 'insert' | 'update';
  recordId?: string;
}

/**
 * Store character profiles in Supabase
 */
async function storeCharacterProfilesInSupabase(
  book_id: string,
  book_title: string,
  profiles: CharacterProfile[]
): Promise<StorageResult> {
  console.log(`[CharacterProfileService] Storing ${profiles.length} character profiles for book "${book_title}" (ID: ${book_id})`);

  // First, delete any existing profiles for this book
  console.log(`[CharacterProfileService] Deleting any existing profiles for book ID: ${book_id}`);
  const { error: deleteError } = await supabase
    .from('book_character_profiles')
    .delete()
    .eq('book_id', book_id);

  if (deleteError) {
    console.warn(`[CharacterProfileService] Warning while deleting existing profiles: ${deleteError.message}`);
  }

  // Insert each profile as a separate row
  console.log(`[CharacterProfileService] Inserting ${profiles.length} character profiles`);

  // Create an array of profile objects to insert
  const profilesToInsert = profiles.map(profile => ({
    book_id,
    book_title,
    character_name: profile.character_name,
    character_profile: profile.character_profile
  }));

  // Insert all profiles
  const { data: insertedData, error: insertError } = await supabase
    .from('book_character_profiles')
    .insert(profilesToInsert)
    .select('id');

  if (insertError) {
    console.error(`[CharacterProfileService] Error inserting profiles:`, insertError);
    throw new Error(`Failed to store character profiles: ${insertError.message}`);
  }

  console.log(`[CharacterProfileService] Successfully inserted ${insertedData?.length || 0} profiles`);
  return {
    operation: 'insert',
    recordId: 'multiple' // We're inserting multiple records
  };
}