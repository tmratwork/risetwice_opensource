/**
 * API endpoint for generating educational quests from a book chapter by chapter
 * 
 * This endpoint is specifically designed for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)
 * which is too large to process as a single unit. It processes a range of chapters with coordination.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Quests-Coordinator][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING CHAPTER-BY-CHAPTER QUEST GENERATION COORDINATOR ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id, start_chapter, end_chapter } = body;
    
    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }
    
    // Only allow psychology textbook
    if (book_id !== '2b169bda-011b-4834-8454-e30fed95669d') {
      return NextResponse.json({ 
        error: 'This endpoint is only for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)'
      }, { status: 400 });
    }
    
    if (!start_chapter || !end_chapter) {
      return NextResponse.json({ 
        error: 'Start and end chapter numbers are required'
      }, { status: 400 });
    }
    
    if (start_chapter < 1 || start_chapter > 30 || end_chapter < start_chapter || end_chapter > 30) {
      return NextResponse.json({ 
        error: 'Invalid chapter range. Start chapter must be between 1 and 30, and end chapter must be between start chapter and 30.'
      }, { status: 400 });
    }
    
    // Check if book exists in Supabase
    const { data: book, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title')
      .eq('id', book_id)
      .single();
    
    if (bookError || !book) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json({ 
        error: 'Failed to fetch book',
        details: bookError
      }, { status: 404 });
    }
    
    console.log(`${logPrefix} Found book: ${book.title}`);
    
    // Create tracking table if it doesn't exist
    const { error: tableCheckError } = await supabase
      .from('quest_processing')
      .select('id')
      .limit(1);
    
    if (tableCheckError) {
      // Table doesn't exist, create it
      console.log(`${logPrefix} Creating quest_processing table...`);
      
      // This would normally be in a SQL migration, but for this example we'll create it via API
      await supabase.rpc('create_quest_processing_table');
    }
    
    // Check if processing is already in progress
    const { data: processingData, error: processingError } = await supabase
      .from('quest_processing')
      .select('*')
      .eq('book_id', book_id)
      .eq('status', 'in_progress');
    
    if (processingError) {
      console.error(`${logPrefix} Error checking processing status:`, processingError);
      return NextResponse.json({ 
        error: 'Failed to check processing status',
        details: processingError
      }, { status: 500 });
    }
    
    if (processingData && processingData.length > 0) {
      return NextResponse.json({ 
        warning: 'Quest generation is already in progress for this book',
        details: {
          current_processing: processingData[0]
        }
      }, { status: 200 });
    }
    
    // Check key concepts exist for book
    const { data: conceptsData, error: conceptsError } = await supabase
      .from('book_concepts')
      .select('id')
      .eq('book_id', book_id)
      .maybeSingle();
      
    if (conceptsError || !conceptsData) {
      console.error(`${logPrefix} Key concepts not found for book:`, conceptsError);
      return NextResponse.json({ 
        error: 'Key concepts not found for this book. Please generate key concepts first.',
        details: conceptsError
      }, { status: 400 });
    }
    
    // Create tracking entries for each chapter
    console.log(`${logPrefix} Creating tracking entries for chapters ${start_chapter} to ${end_chapter}...`);
    
    const chapterEntries = [];
    for (let chapNum = start_chapter; chapNum <= end_chapter; chapNum++) {
      chapterEntries.push({
        book_id: book_id,
        chapter_number: chapNum,
        status: chapNum === start_chapter ? 'pending' : 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    // Insert tracking entries
    const { error: insertError } = await supabase
      .from('quest_processing')
      .insert(chapterEntries);
    
    if (insertError) {
      console.error(`${logPrefix} Error creating tracking entries:`, insertError);
      return NextResponse.json({ 
        error: 'Failed to create tracking entries',
        details: insertError
      }, { status: 500 });
    }
    
    // Process the first chapter to initiate the queue
    console.log(`${logPrefix} Initiating quest generation with chapter ${start_chapter}...`);
    
    // Update status of first chapter to "in_progress"
    const { error: updateError } = await supabase
      .from('quest_processing')
      .update({ 
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('book_id', book_id)
      .eq('chapter_number', start_chapter);
    
    if (updateError) {
      console.error(`${logPrefix} Error updating first chapter status:`, updateError);
      return NextResponse.json({ 
        error: 'Failed to update first chapter status',
        details: updateError
      }, { status: 500 });
    }
    
    // Return success with information about the queued processing
    return NextResponse.json({
      success: true,
      message: `Initiated quest generation for chapters ${start_chapter} to ${end_chapter}`,
      book: {
        id: book.id,
        title: book.title
      },
      processing_info: {
        total_chapters: end_chapter - start_chapter + 1,
        start_chapter,
        end_chapter,
        status: 'initiated'
      },
      // Add flag to indicate this is chapter-by-chapter processing to prevent truncation warnings
      chapter_by_chapter: true
    });
    
  } catch (error) {
    console.error(`${logPrefix} Error in quest generation coordinator:`, error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}