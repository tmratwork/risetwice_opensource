// src/app/api/v10/next-question/route.ts
/**
 * V10 API - Next Question Endpoint
 * 
 * This endpoint retrieves the next question for a book conversation,
 * tracking which questions have already been asked.
 * Adapted from V9 implementation to work with the V10 WebRTC approach.
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
  const logPrefix = `[V10-API-NextQuestion][${requestId}]`;

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
    const { userId, book, exclude, currentContext }: NextQuestionRequestBody = body;
    // We're not using conversationId from the request anymore
    // We'll create a new one for each request

    console.log(`${logPrefix} API called with:`, {
      userId: userId || 'missing',
      book: book || 'missing',
      excludeCount: exclude?.length || 0,
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
      
      // Query all messages with non-null question_id
      const { data: askedQuestions, error: askedQuestionsError } = await supabase
        .from('messages')
        .select('question_id')
        .not('question_id', 'is', null);
      
      if (askedQuestionsError) {
        console.error(`${logPrefix} Error getting previously asked questions:`, askedQuestionsError);
      } else if (askedQuestions && askedQuestions.length > 0) {
        const questionIds = askedQuestions
          .map(m => m.question_id)
          .filter(id => id && id !== 'error-fallback-question' && id !== 'debug-question');
        
        // Merge with any provided exclude list
        excludedQuestionIds = [...new Set([...excludedQuestionIds, ...questionIds])];
        console.log(`${logPrefix} Found ${questionIds.length} previously asked questions from messages table`);
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
      .from('opening_lines_v1')
      .select('count', { count: 'exact', head: true });

    if (tableTest.error) {
      console.error(`${logPrefix} Table opening_lines_v1 access error:`, tableTest.error);
      // Log specific error code and message
      console.error(`${logPrefix} Error code: ${tableTest.error.code}, Message: ${tableTest.error.message}`);
    } else {
      console.log(`${logPrefix} Table opening_lines_v1 exists and is accessible`);
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

    // Log the actual query being constructed (safe version for logs)
    console.log(`${logPrefix} Query structure:`, {
      table: 'opening_lines_v1',
      selections: 'id, opening_line, book_id',
      bookFilter: bookIdForQuery,
      excludeCount: excludedQuestionIds.length,
      // Log a sample of excluded IDs if there are many
      excludedSample: excludedQuestionIds.length > 10
        ? excludedQuestionIds.slice(0, 5).join(',') + '...'
        : excludedQuestionIds.join(','),
    });

    // Use the book ID as-is since opening_lines_v1.book_id is UUID format
    console.log(`${logPrefix} Using book ID for opening_lines_v1 query: ${bookIdForQuery}`);

    let query = supabase
      .from('opening_lines_v1')
      .select('id, opening_line, book_id')
      .eq('book_id', bookIdForQuery);

    // Add filter to exclude already asked questions
    if (excludedQuestionIds.length > 0) {
      query = query.not('id', 'in', `(${excludedQuestionIds.join(',')})`);
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
      console.error(`${logPrefix} No more available questions for this book`);

      // Get book title for the response
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('title')
        .eq('id', book)
        .single();

      const bookTitle = bookError ? "Unknown Book" : bookData?.title || "Unknown Book";

      // Return an error response
      return NextResponse.json({
        error: 'No available questions',
        details: 'All available questions have been asked for this book',
        bookTitle: bookTitle
      }, { status: 500 });
    }

    // Step 3: Randomly select a question from available questions
    console.log(`${logPrefix} Selecting next question...`);

    // Randomly select a question from available questions
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    // Get book title for the response from books_v2 table
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('title')
      .eq('id', book)
      .single();

    const bookTitle = bookError ? "Unknown Book" : bookData?.title || "Unknown Book";

    console.log(`${logPrefix} Selected question:`, {
      id: selectedQuestion.id,
      fullQuestion: selectedQuestion.opening_line, // Show full question instead of truncated version
      questionLength: selectedQuestion.opening_line.length, // Add length for debugging
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

    // Step 5: Return the selected question
    console.log(`${logPrefix} === NEXT QUESTION REQUEST COMPLETED SUCCESSFULLY ===`);

    return NextResponse.json({
      questionId: selectedQuestion.id,
      question: selectedQuestion.opening_line,
      bookTitle: bookTitle,
      category: 'general', // Database doesn't have a category column
      topic: currentContext?.currentTopic || null,
      conversationId: newConversationId // Return the new conversation ID in case it's needed
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