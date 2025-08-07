// src/app/api/v11/next-question/route.ts
/**
 * V11 API - Next Question Endpoint
 * 
 * This endpoint retrieves the next question for a book conversation,
 * tracking which questions have already been asked.
 * Adapted from V10 implementation to work with the V11 WebRTC approach.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Set max duration for the request (2 minutes)

interface NextQuestionRequestBody {
  userId?: string;
  book: string;
  conversationId?: string;
  exclude?: string[];
  resetCompleted?: boolean; // Flag to allow retrieving completed quests
  currentContext?: {
    lastUserResponse?: string;
    currentTopic?: string;
    sessionLength?: number;
  };
}

// Debug endpoint that always returns a valid response
export async function GET() {
  return NextResponse.json({
    questionId: 'debug-question',
    question: "What do you think about the main character's development throughout the story?",
    bookTitle: "Debug Book"
  });
}

export async function POST(req: Request) {
  // Generate a unique request ID for tracing through logs
  const requestId = new Date().getTime().toString().slice(-6);
  const logPrefix = `[V11-API-NextQuestion][${requestId}]`;

  console.log(`${logPrefix} === STARTING NEXT QUESTION REQUEST ===`);

  try {
    // Parse request body
    let body: NextQuestionRequestBody;
    try {
      body = await req.json();
      console.log(`${logPrefix} Raw request body:`, JSON.stringify(body));
    } catch (parseError) {
      console.error(`${logPrefix} Error parsing request JSON:`, parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Destructure with explicit typing to avoid implicit any
    const { userId, book, exclude, resetCompleted, currentContext }: NextQuestionRequestBody = body;
    
    // Log if resetCompleted flag is provided
    if (resetCompleted) {
      console.log(`${logPrefix} Reset completed quests flag is enabled - will include completed quests in selection`);
    }
    // We're not using conversationId from the request anymore
    // We'll create a new one for each request

    console.log(`${logPrefix} API called with:`, {
      userId: userId || 'missing',
      book: book || 'missing',
      excludeCount: exclude?.length || 0,
      resetCompleted: resetCompleted || false,
      currentContext: currentContext ? 'provided' : 'not provided',
      timestamp: new Date().toISOString()
    });

    // Validate required parameters
    if (!book) {
      console.error(`${logPrefix} Missing required book parameter`);
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // Check for Supabase configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error(`${logPrefix} Supabase configuration missing, this is a critical error`);
      return NextResponse.json({
        error: 'Supabase configuration missing',
        details: 'Database credentials not properly configured'
      }, { status: 500 });
    }

    try {
      // Verify Supabase connection with a quick test
      const testQuery = await supabase.from('books').select('count', { count: 'exact', head: true });

      if (testQuery.error) {
        console.error(`${logPrefix} Supabase connection failed:`, testQuery.error);
        return NextResponse.json({
          error: 'Database connection failed',
          details: testQuery.error.message
        }, { status: 500 });
      }

      console.log(`${logPrefix} Supabase connection verified successfully`);
    } catch (connectionError) {
      console.error(`${logPrefix} Supabase connection test failed:`, connectionError);
      return NextResponse.json({
        error: 'Database connection test failed',
        details: connectionError instanceof Error ? connectionError.message : String(connectionError)
      }, { status: 500 });
    }

    // If we've got context information, log it for debugging
    if (currentContext) {
      console.log(`${logPrefix} Context information:`, {
        lastUserResponse: currentContext.lastUserResponse || 'none',
        responseLength: currentContext.lastUserResponse ? currentContext.lastUserResponse.length : 0,
        currentTopic: currentContext.currentTopic || 'none',
        sessionLength: currentContext.sessionLength || 0
      });
    }

    // Step 1: Get previously asked questions
    console.log(`${logPrefix} Getting previously asked questions...`);
    let excludedQuestionIds: string[] = [];

    // Use provided exclude list if available
    if (exclude && exclude.length > 0) {
      excludedQuestionIds = exclude;
      console.log(`${logPrefix} Using provided exclude list with ${exclude.length} questions`);
    }

    // Query the messages table for previously asked questions
    try {
      console.log(`${logPrefix} Fetching previously asked questions from messages table...`);

      // For V11, we only care about UUID quest_ids, not older numeric question_ids
      // Query only messages with non-null quest_id
      const { data: askedQuestions, error: askedQuestionsError } = await supabase
        .from('messages')
        .select('quest_id')
        .not('quest_id', 'is', null);

      if (askedQuestionsError) {
        console.error(`${logPrefix} Error getting previously asked questions:`, askedQuestionsError);
      } else if (askedQuestions && askedQuestions.length > 0) {
        // Extract only UUID quest_ids
        const uuidQuestIds = askedQuestions
          .filter(m => m.quest_id)
          .map(m => m.quest_id)
          .filter(id => id);
          
        // Log the count for diagnostic purposes
        console.log(`${logPrefix} Found ${uuidQuestIds.length} UUID quest_ids from messages table`);

        // Merge with any provided exclude list
        excludedQuestionIds = [...new Set([...excludedQuestionIds, ...uuidQuestIds])];
        console.log(`${logPrefix} Found ${uuidQuestIds.length} previously asked questions from messages table`);
        console.log(`${logPrefix} Total excluded questions: ${excludedQuestionIds.length}`);
      } else {
        console.log(`${logPrefix} No previously asked questions found in messages table`);
      }
    } catch (fetchError) {
      console.error(`${logPrefix} Error fetching previously asked questions:`, fetchError);
      // Continue despite error - this is not a critical failure
    }

    // Step 2: Get available questions for this book that haven't been asked yet
    console.log(`${logPrefix} Retrieving available questions for book ${book}...`);

    // Use the original book ID as-is - this field accepts UUIDs in the database
    const bookIdForQuery = book;

    // Log the format we're using
    if (book && book.includes('-')) {
      console.log(`${logPrefix} Book ID is in UUID format: ${book}`);
    } else {
      console.log(`${logPrefix} Book ID is in non-UUID format: ${book}`);
    }

    // Before executing the main query, add diagnostic queries
    console.log(`${logPrefix} Testing table existence and permissions...`);
    const tableTest = await supabase
      .from('book_quests')
      .select('count', { count: 'exact', head: true });

    if (tableTest.error) {
      console.error(`${logPrefix} Table book_quests access error:`, tableTest.error);
      // Log specific error code and message
      console.error(`${logPrefix} Error code: ${tableTest.error.code}, Message: ${tableTest.error.message}`);
    } else {
      console.log(`${logPrefix} Table book_quests exists and is accessible`);
    }

    // Test if the book exists in books_v2 table
    const bookTest = await supabase
      .from('books_v2')
      .select('id')
      .eq('id', book)
      .single();

    if (bookTest.error) {
      console.error(`${logPrefix} Book ID ${book} existence check failed:`, bookTest.error);
    } else {
      console.log(`${logPrefix} Book ID ${book} exists in books_v2 table`);
      // We're already using the original book ID, no need to reassign
    }

    // Step 2.1: Get already active or completed quests from user_quests table
    let excludedQuestIds: string[] = [];

    if (userId) {
      console.log(`${logPrefix} Fetching user's active and completed quests...`);
      
      try {
        // If resetCompleted flag is true, only exclude active quests, allowing completed ones to be selected again
        // Otherwise exclude both active and completed quests
        const statusesToExclude = resetCompleted ? ['active'] : ['active', 'completed'];
        console.log(`${logPrefix} Excluding quests with status: ${statusesToExclude.join(', ')}`);
        
        const { data: userQuestsData, error: userQuestsError } = await supabase
          .from('user_quests')
          .select('quest_id, status')
          .eq('user_id', userId)
          .in('status', statusesToExclude);

        if (userQuestsError) {
          console.error(`${logPrefix} Error fetching user quests:`, userQuestsError);
        } else if (userQuestsData && userQuestsData.length > 0) {
          // Extract quest IDs from user_quests records
          excludedQuestIds = userQuestsData.map(q => q.quest_id);
          
          const activeQuests = userQuestsData.filter(q => q.status === 'active').length;
          const completedQuests = userQuestsData.filter(q => q.status === 'completed').length;
          
          console.log(`${logPrefix} Found ${userQuestsData.length} user quests to exclude (${activeQuests} active, ${completedQuests} completed)`);
          
          // For V11, we're only tracking quest_ids (UUIDs), not mixing with numeric IDs
          // This is our primary exclusion source - clear any previous IDs first to avoid type mixing
          excludedQuestionIds = [...excludedQuestIds];
          console.log(`${logPrefix} Using only UUID quest IDs from user_quests table for exclusion`);
        } else {
          console.log(`${logPrefix} No active or completed quests found for user ${userId}`);
        }
      } catch (error) {
        console.error(`${logPrefix} Error in user_quests query:`, error);
        // Continue despite error - not critical
      }
    } else {
      console.log(`${logPrefix} No userId provided, skipping user_quests exclusion check`);
    }

    // Log the actual query being constructed (safe version for logs)
    console.log(`${logPrefix} Query structure:`, {
      table: 'book_quests',
      selections: 'id, introduction, challenge, reward, starting_question, chapter_number, chapter_title',
      bookFilter: bookIdForQuery,
      excludeCount: excludedQuestionIds.length,
      // Log a sample of excluded IDs if there are many
      excludedSample: excludedQuestionIds.length > 10
        ? excludedQuestionIds.slice(0, 5).join(',') + '...'
        : excludedQuestionIds.join(','),
    });

    // Use the book ID as-is since book_quests.book_id is UUID format
    console.log(`${logPrefix} Using book ID for book_quests query: ${bookIdForQuery}`);

    // Create query to get available quests, properly filtering out active and completed ones
    let query = supabase
      .from('book_quests')
      .select('id, introduction, challenge, reward, starting_question, chapter_number, chapter_title')
      .eq('book_id', bookIdForQuery);
      
    // SAFETY OVERRIDE FOR TESTING: Add limit and order by to ensure consistent results
    query = query.order('chapter_number', { ascending: true }).order('id').limit(10);

    // Apply filtering logic for quest IDs - only if there's at least one UUID to exclude 
    // Skip empty arrays and make sure we're only filtering with UUIDs
    if (excludedQuestIds.length > 0) {
      // Use excludedQuestIds which contains only UUIDs from user_quests table
      // This avoids mixing numeric IDs and UUIDs which causes SQL errors
      console.log(`${logPrefix} Filtering out ${excludedQuestIds.length} quests that are already active or completed`);
      
      // Supabase requires a proper array for IN/NOT IN filters with UUIDs
      try {
        // For each UUID, filter it individually to avoid syntax errors with comma-separated lists
        for (const questId of excludedQuestIds) {
          console.log(`${logPrefix} Excluding quest ID: ${questId}`);
          query = query.neq('id', questId);
        }
      } catch (error) {
        console.error(`${logPrefix} Error setting up quest exclusion filters:`, error);
        // Continue without filtering if there's an error
      }
    } else {
      console.log(`${logPrefix} No quests to exclude - all quests are available`);
    }

    const { data: availableQuestions, error: questionsError } = await query;

    if (questionsError) {
      console.error(`${logPrefix} Error fetching available questions:`, {
        error: questionsError,
        errorCode: questionsError.code,
        errorMessage: questionsError.message,
        errorDetails: questionsError.details || 'No additional details',
        hint: questionsError.hint || 'No hint provided'
      });

      // Try a simpler query as a fallback test
      const simpleQuery = await supabase
        .from('opening_lines_v1')
        .select('id')
        .limit(1);

      if (simpleQuery.error) {
        console.error(`${logPrefix} Even simplified query failed:`, simpleQuery.error);
      } else {
        console.log(`${logPrefix} Simplified query succeeded, problem might be with filters`);
      }

      // Properly treat this as a breaking error - no fallbacks
      console.error(`${logPrefix} CRITICAL ERROR: Database query failed - this is a breaking error`);
      console.error(`${logPrefix} The application must be fixed to work with the correct database schema`);

      return NextResponse.json({
        error: 'Database query failed',
        details: questionsError.message,
        errorCode: questionsError.code || 'unknown',
      }, { status: 500 });
    }

    console.log(`${logPrefix} Found ${availableQuestions?.length || 0} available questions`);

    // If no more questions are available
    if (!availableQuestions || availableQuestions.length === 0) {
      console.log(`${logPrefix} No more available quests for this book that haven't been active or completed`);

      // Get book title for the response from books_v2 table (for consistent behavior)
      const { data: bookData, error: bookError } = await supabase
        .from('books_v2')
        .select('title')
        .eq('id', book)
        .single();

      const bookTitle = bookError ? "Unknown Book" : bookData?.title || "Unknown Book";
      
      // Check if this is because all quests are completed
      if (userId && excludedQuestIds.length > 0) {
        console.log(`${logPrefix} User ${userId} has ${excludedQuestIds.length} active or completed quests`);
        
        // Get total count of quests for this book - use a new query to avoid filter issues
        const countQuery = supabase
          .from('book_quests')
          .select('id', { count: 'exact' })
          .eq('book_id', book);
          
        const { count: totalQuestCount, error: countError } = await countQuery;
          
        if (!countError && totalQuestCount !== null) {
          const completedPercentage = Math.round((excludedQuestIds.length / totalQuestCount) * 100);
          
          console.log(`${logPrefix} User has completed/active ${excludedQuestIds.length} out of ${totalQuestCount} quests (${completedPercentage}%)`);
          
          // Return a success response with achievement information
          return NextResponse.json({
            allQuestsCompleted: true,
            questsCompleted: excludedQuestIds.length,
            totalQuests: totalQuestCount,
            completedPercentage,
            bookTitle,
            message: `Congratulations! You've completed ${completedPercentage}% of all available quests for "${bookTitle}". Would you like to restart a quest you've already completed?`,
            questionId: 'all-quests-completed',
            question: `Congratulations! You've completed ${completedPercentage}% of all available quests for "${bookTitle}". Would you like to restart a quest you've already completed?`
          });
        }
      }

      // Default response if we couldn't determine completion status
      return NextResponse.json({
        error: 'No available quests',
        details: 'All available quests have been started or completed for this book',
        bookTitle: bookTitle
      }, { status: 500 });
    }

    // Step 3: Randomly select a question from available questions
    console.log(`${logPrefix} Selecting next question...`);

    // Randomly select a question from available questions
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    // Combine the question parts into a single string
    const combinedQuestion = `${selectedQuestion.introduction} To earn ${selectedQuestion.reward} ${selectedQuestion.challenge} ${selectedQuestion.starting_question}`;

    // Get book title for the response from books_v2 table
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('title')
      .eq('id', book)
      .single();

    const bookTitle = bookError ? "Unknown Book" : bookData?.title || "Unknown Book";

    console.log(`${logPrefix} Selected question:`, {
      id: selectedQuestion.id,
      chapter: `Chapter ${selectedQuestion.chapter_number}: ${selectedQuestion.chapter_title}`,
      introduction: selectedQuestion.introduction.substring(0, 50) + '...',
      challenge: selectedQuestion.challenge.substring(0, 50) + '...',
      reward: selectedQuestion.reward.substring(0, 50) + '...',
      startingQuestion: selectedQuestion.starting_question.substring(0, 50) + '...',
      fullQuestion: combinedQuestion.substring(0, 100) + '...',
      questionLength: combinedQuestion.length,
      // Database doesn't have category field, use default value
      category: 'general',
      bookTitle
    });

    // Step 4: Create a new conversation and store the selected question
    let newConversationId = null;

    if (userId) {
      // Always create a new conversation for each request
      console.log(`${logPrefix} Creating new conversation record...`);

      try {
        // Create conversation record with a Supabase-generated UUID
        const { data: newConversation, error: createConversationError } = await supabase
          .from('conversations')
          .insert({
            human_id: userId,
            is_active: true
          })
          .select('id')
          .single();

        if (createConversationError) {
          console.error(`${logPrefix} Error creating conversation record:`, createConversationError);
        } else if (newConversation) {
          newConversationId = newConversation.id;
          console.log(`${logPrefix} Successfully created conversation record with ID: ${newConversationId}`);

          // We no longer save the question to messages table here
          // It will be saved by the WebRTC hook when the AI responds
          console.log(`${logPrefix} Question will be saved when displayed to user by WebRTC hook`);
        }
      } catch (convError) {
        console.error(`${logPrefix} Unexpected error creating conversation:`, convError);
        // Continue despite error
      }
    } else {
      console.log(`${logPrefix} No user ID provided, skipping conversation creation`);
    }

    // Step 5: Attempt to update quest status in user_quests table
    if (userId) {
      console.log(`${logPrefix} Attempting to update quest status in user_quests table...`);
      
      try {
        // First check if the table exists
        const { error: tableCheckError } = await supabase
          .from('user_quests')
          .select('count', { count: 'exact', head: true });
        
        // If the table doesn't exist, report a clear error
        if (tableCheckError && tableCheckError.code === 'PGRST301') { // Relation does not exist
          const errorMessage = `CRITICAL ERROR: user_quests table does not exist. Run migrations to create required tables before continuing.`;
          console.error(`${logPrefix} ${errorMessage}`);
          throw new Error(errorMessage);
        }
        
        console.log(`${logPrefix} user_quests table exists, proceeding with update`);
        
        // Check if record already exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('user_quests')
          .select('id, status')
          .eq('user_id', userId)
          .eq('quest_id', selectedQuestion.id)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error code
          console.error(`${logPrefix} Error checking existing quest record:`, checkError);
          throw new Error(`Failed to check if quest status exists: ${checkError.message}`);
        } 
        
        if (existingRecord) {
          // Only update if not already completed
          if (existingRecord.status !== 'completed') {
            console.log(`${logPrefix} Updating existing quest record ${existingRecord.id} to "active"`);
            
            const { error: updateError } = await supabase
              .from('user_quests')
              .update({ status: 'active' })
              .eq('id', existingRecord.id);

            if (updateError) {
              console.error(`${logPrefix} Error updating quest record:`, updateError);
              throw new Error(`Failed to update quest status: ${updateError.message}`);
            }
            
            console.log(`${logPrefix} Successfully updated quest status to "active"`);
          } else {
            console.log(`${logPrefix} Quest already marked as completed, not updating`);
          }
        } else {
          // Create a new record
          console.log(`${logPrefix} Creating new user_quests record for user ${userId}, quest ${selectedQuestion.id}`);
          
          const { error: insertError } = await supabase
            .from('user_quests')
            .insert({
              user_id: userId,
              quest_id: selectedQuestion.id,
              status: 'active'
            });

          if (insertError) {
            console.error(`${logPrefix} Error creating quest record:`, insertError);
            throw new Error(`Failed to create quest status record: ${insertError.message}`);
          }
          
          console.log(`${logPrefix} Successfully created quest status record as "active"`);
        }
      } catch (questError) {
        console.error(`${logPrefix} ERROR UPDATING USER_QUESTS TABLE:`, questError);
        // We're not returning an HTTP error response because we still want to return the question,
        // but we're making the error very visible in logs for debugging
        console.error(`${logPrefix} ⚠️ QUEST STATUS NOT UPDATED! The above error must be fixed for proper quest tracking.`);
        
        // Continue despite error - we want the question to be delivered even if tracking fails
      }
    } else {
      console.log(`${logPrefix} No user ID provided, skipping user_quests update`);
    }

    // Step 6: Return the selected question
    console.log(`${logPrefix} === NEXT QUESTION REQUEST COMPLETED SUCCESSFULLY ===`);

    return NextResponse.json({
      questionId: selectedQuestion.id,
      question: combinedQuestion,
      bookTitle: bookTitle,
      category: 'general', // Database doesn't have a category column
      topic: currentContext?.currentTopic || null,
      conversationId: newConversationId, // Return the new conversation ID in case it's needed
      chapterInfo: `Chapter ${selectedQuestion.chapter_number}: ${selectedQuestion.chapter_title}`
    });

  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined
    });

    console.log(`${logPrefix} === FAILED TO COMPLETE NEXT QUESTION REQUEST ===`);

    // Provide a fallback response with error information
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
      // Always include a fallback question
      questionId: 'error-fallback-question',
      question: "I'd like to continue our discussion about the book. What aspect of the story would you like to explore next?",
      bookTitle: "Current Book"
    }, { status: 500 })
  }
}