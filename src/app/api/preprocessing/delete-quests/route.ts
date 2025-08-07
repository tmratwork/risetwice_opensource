/**
 * API route for deleting all quest data for a specific book
 * Removes entries from book_quests table as well as associated user_quests records
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Ensure we don't use cached data
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[MH-Quests-Delete][${requestId}]`;

  console.log(`${logPrefix} Starting quest deletion process`);

  try {
    // Get the request body
    const body = await request.json();
    const { bookId } = body;

    if (!bookId) {
      console.error(`${logPrefix} Missing book ID`);
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    console.log(`${logPrefix} Deleting quests for book ID: ${bookId}`);

    // First, verify the book exists
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('title')
      .eq('id', bookId)
      .single();

    if (bookError) {
      console.error(`${logPrefix} Error fetching book:`, bookError);
      return NextResponse.json(
        { error: `Book not found or error: ${bookError.message}` },
        { status: 404 }
      );
    }

    console.log(`${logPrefix} Found book: "${bookData.title}"`);

    // Step 1: Get all quest IDs for this book to delete associated user_quests records
    const { data: questIds, error: questIdsError } = await supabase
      .from('book_quests')
      .select('id')
      .eq('book_id', bookId);

    if (questIdsError) {
      console.error(`${logPrefix} Error fetching quest IDs:`, questIdsError);
      // Continue anyway, as we'll try to delete all quests
    }

    let userQuestsDeletedCount = 0;

    // Step 2: Delete associated user_quests records if any quests were found
    if (questIds && questIds.length > 0) {
      console.log(`${logPrefix} Found ${questIds.length} quests, deleting associated user quest records`);

      // Extract just the IDs into an array
      const ids = questIds.map(q => q.id);

      // Delete all user_quests records for these quest IDs (without count)
      const { error: userQuestsError } = await supabase
        .from('user_quests')
        .delete()
        .in('quest_id', ids);

      if (userQuestsError) {
        console.error(`${logPrefix} Error deleting user quests records:`, userQuestsError);
        // Continue anyway to delete the book_quests records
      } else {
        // We don't know exact count, just using IDs count as approximation
        userQuestsDeletedCount = ids.length;
        console.log(`${logPrefix} Deleted user quest records for ${userQuestsDeletedCount} quests`);
      }
    } else {
      console.log(`${logPrefix} No quests found for this book`);
    }

    // Step 3: Delete all book_quests records for this book without returning
    const { error: deleteError } = await supabase
      .from('book_quests')
      .delete()
      .eq('book_id', bookId);

    if (deleteError) {
      console.error(`${logPrefix} Error deleting quests:`, deleteError);
      return NextResponse.json(
        { error: `Failed to delete quests: ${deleteError.message}` },
        { status: 500 }
      );
    }

    // We can't get the count directly but can assume success if no error
    const questsDeletedCount = questIds?.length || 0;
    console.log(`${logPrefix} Deleted ${questsDeletedCount} book quest records`);

    // Step 4: Delete any quest_processing records for this book if the table exists
    try {
      const { error: processError } = await supabase
        .from('quest_processing')
        .delete()
        .eq('book_id', bookId);

      if (processError) {
        console.log(`${logPrefix} Note: quest_processing table might not exist or no records found`);
      }
    } catch (err) {
      console.log(`${logPrefix} Note: quest_processing table might not exist, error:`, err);
      // This is not critical, so we just log and continue
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${questsDeletedCount} quests and ${userQuestsDeletedCount} user quest records for book: ${bookData.title}`,
      deletedCounts: {
        book_quests: questsDeletedCount,
        user_quests: userQuestsDeletedCount
      }
    });

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}