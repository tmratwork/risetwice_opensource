import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Export-Book-Data][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING BOOK DATA EXPORT ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id } = body;
    
    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }
    
    console.log(`${logPrefix} Fetching book data for book ID: ${book_id}`);
    
    // Step 1: Get book details
    console.log(`${logPrefix} Fetching book details...`);
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author')
      .eq('id', book_id)
      .single();
    
    if (bookError || !book) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json({ 
        error: 'Failed to fetch book details',
        details: bookError
      }, { status: 404 });
    }
    
    console.log(`${logPrefix} Found book: "${book.title}"`);
    
    // Step 2: Get key concepts
    console.log(`${logPrefix} Fetching key concepts...`);
    const { data: conceptsData, error: conceptsError } = await supabase
      .from('book_concepts')
      .select('concepts')
      .eq('book_id', book_id)
      .single();
    
    let concepts = [];
    if (conceptsError) {
      console.warn(`${logPrefix} Warning: Could not fetch concepts:`, conceptsError.message);
    } else if (conceptsData && conceptsData.concepts && conceptsData.concepts.key_concepts) {
      concepts = conceptsData.concepts.key_concepts;
      console.log(`${logPrefix} Found ${concepts.length} key concepts`);
    } else {
      console.warn(`${logPrefix} Warning: No key concepts found for this book`);
    }
    
    // Step 3: Get character profiles
    console.log(`${logPrefix} Fetching character profiles...`);
    const { data: profiles, error: profilesError } = await supabase
      .from('book_character_profiles')
      .select('character_name, character_profile')
      .eq('book_id', book_id);
    
    if (profilesError) {
      console.warn(`${logPrefix} Warning: Could not fetch character profiles:`, profilesError.message);
    } else {
      console.log(`${logPrefix} Found ${profiles?.length || 0} character profiles`);
    }
    
    // Step 4: Get opening lines
    console.log(`${logPrefix} Fetching opening lines...`);
    const { data: openingLines, error: openingLinesError } = await supabase
      .from('opening_lines_v1')
      .select('character_name, type, opening_line, related_concepts, example_conversation, chapter_number, chapter_title')
      .eq('book_id', book_id);
    
    if (openingLinesError) {
      console.warn(`${logPrefix} Warning: Could not fetch opening lines:`, openingLinesError.message);
    } else {
      console.log(`${logPrefix} Found ${openingLines?.length || 0} opening lines`);
    }
    
    // Step 5: Get quests
    console.log(`${logPrefix} Fetching quests...`);
    const { data: quests, error: questsError } = await supabase
      .from('book_quests')
      .select('quest_title, introduction, challenge, reward, starting_question, chapter_number, chapter_title')
      .eq('book_id', book_id);
    
    if (questsError) {
      console.warn(`${logPrefix} Warning: Could not fetch quests:`, questsError.message);
    } else {
      console.log(`${logPrefix} Found ${quests?.length || 0} quests`);
    }
    
    // Step 6: Return all the data
    const response = {
      book,
      concepts,
      character_profiles: profiles || [],
      opening_lines: openingLines || [],
      quests: quests || []
    };
    
    console.log(`${logPrefix} ========== BOOK DATA EXPORT COMPLETE ==========`);
    console.log(`${logPrefix} Book: "${book.title}" (ID: ${book.id})`);
    console.log(`${logPrefix} Total Concepts: ${concepts.length}`);
    console.log(`${logPrefix} Total Character Profiles: ${profiles?.length || 0}`);
    console.log(`${logPrefix} Total Opening Lines: ${openingLines?.length || 0}`);
    console.log(`${logPrefix} Total Quests: ${quests?.length || 0}`);
    console.log(`${logPrefix} =======================================`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error(`[Export-Book-Data][${requestId}] Error fetching book data:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}