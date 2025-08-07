/**
 * API endpoint for coordinating chapter-by-chapter quest generation
 * 
 * This endpoint is called by the client to check status and process the next chapter in the queue.
 * It coordinates the processing of multiple chapters with appropriate delays to avoid rate limits.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic responses to prevent caching
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[Quests-Coordinator][${requestId}]`;
  
  console.log(`${logPrefix} === PROCESSING NEXT CHAPTER FOR QUEST GENERATION ===`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { book_id } = body;
    
    if (!book_id) {
      return NextResponse.json({ error: 'Book ID is required' }, { status: 400 });
    }
    
    // Only allow psychology textbook
    if (book_id !== '2b169bda-011b-4834-8454-e30fed95669d') {
      return NextResponse.json({ 
        error: 'This endpoint is only for the psychology textbook (ID: 2b169bda-011b-4834-8454-e30fed95669d)'
      }, { status: 400 });
    }
    
    // Get processing status
    const { data: processingData, error: processingError } = await supabase
      .from('quest_processing')
      .select('*')
      .eq('book_id', book_id)
      .order('chapter_number', { ascending: true });
    
    if (processingError) {
      console.error(`${logPrefix} Error checking processing status:`, processingError);
      return NextResponse.json({ 
        error: 'Failed to check processing status',
        details: processingError
      }, { status: 500 });
    }
    
    if (!processingData || processingData.length === 0) {
      return NextResponse.json({ 
        error: 'No chapters found in the processing queue for this book'
      }, { status: 404 });
    }
    
    // Get summary of processing status
    const inProgress = processingData.filter(p => p.status === 'in_progress');
    const completed = processingData.filter(p => p.status === 'completed');
    const failed = processingData.filter(p => p.status === 'failed');
    const pending = processingData.filter(p => p.status === 'pending');
    const queued = processingData.filter(p => p.status === 'queued');
    
    // Check if there are any chapters still processing
    if (inProgress.length > 0) {
      return NextResponse.json({
        status: 'processing',
        message: `Chapter ${inProgress[0].chapter_number} is currently being processed`,
        processing_info: {
          total_chapters: processingData.length,
          completed: completed.length,
          in_progress: inProgress.length,
          failed: failed.length,
          pending: pending.length,
          queued: queued.length
        }
      });
    }
    
    // Check if all chapters are completed
    if (completed.length === processingData.length) {
      return NextResponse.json({
        status: 'completed',
        message: 'All chapters have been processed',
        processing_info: {
          total_chapters: processingData.length,
          completed: completed.length,
          in_progress: 0,
          failed: 0,
          pending: 0,
          queued: 0
        }
      });
    }
    
    // Find the next chapter to process (with status 'pending' or 'queued')
    const nextChapter = processingData.find(p => p.status === 'pending' || p.status === 'queued');
    
    if (!nextChapter) {
      return NextResponse.json({
        status: 'no_pending_chapters',
        message: 'No pending chapters found for processing',
        processing_info: {
          total_chapters: processingData.length,
          completed: completed.length,
          in_progress: 0,
          failed: failed.length,
          pending: 0,
          queued: 0
        }
      });
    }
    
    // Update next chapter to "in_progress"
    const { error: updateError } = await supabase
      .from('quest_processing')
      .update({ 
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', nextChapter.id);
    
    if (updateError) {
      console.error(`${logPrefix} Error updating chapter status:`, updateError);
      return NextResponse.json({ 
        error: 'Failed to update chapter status',
        details: updateError
      }, { status: 500 });
    }
    
    console.log(`${logPrefix} Starting processing for chapter ${nextChapter.chapter_number}...`);
    
    // Process this chapter by calling the generate-quests endpoint
    const generateResponse = await fetch(new URL('/api/preprocessing/generate-quests', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        book_id,
        chapter_by_chapter: true,
        start_chapter: nextChapter.chapter_number,
        end_chapter: nextChapter.chapter_number
      })
    });
    
    const generateData = await generateResponse.json();
    
    if (!generateResponse.ok) {
      console.error(`${logPrefix} Error processing chapter ${nextChapter.chapter_number}:`, generateData.error);
      
      // Update status to failed
      await supabase
        .from('quest_processing')
        .update({ 
          status: 'failed',
          error_details: generateData.error,
          updated_at: new Date().toISOString()
        })
        .eq('id', nextChapter.id);
      
      return NextResponse.json({
        status: 'error',
        message: `Failed to process chapter ${nextChapter.chapter_number}`,
        error: generateData.error,
        chapter_number: nextChapter.chapter_number
      }, { status: 500 });
    }
    
    // Update status to completed
    const { error: completeError } = await supabase
      .from('quest_processing')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', nextChapter.id);
    
    if (completeError) {
      console.error(`${logPrefix} Error updating chapter completion status:`, completeError);
    }
    
    console.log(`${logPrefix} Successfully processed chapter ${nextChapter.chapter_number}`);
    
    // Return success with information about the processed chapter
    return NextResponse.json({
      status: 'success',
      message: `Successfully processed chapter ${nextChapter.chapter_number}`,
      chapter_number: nextChapter.chapter_number,
      quest_count: generateData.quest_count || 0,
      processing_info: {
        total_chapters: processingData.length,
        completed: completed.length + 1,
        in_progress: 0,
        failed: failed.length,
        pending: pending.length - 1,
        queued: queued.length
      },
      next_chapters: processingData
        .filter(p => p.status === 'pending' || p.status === 'queued')
        .map(p => p.chapter_number)
        .sort((a, b) => a - b),
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