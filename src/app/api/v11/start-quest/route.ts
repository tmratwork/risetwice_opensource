// src/app/api/v11/start-quest/route.ts
/**
 * V11 API - Start Quest Endpoint
 * 
 * This endpoint initializes a specific quest session.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface StartQuestRequest {
  userId?: string;
  questId: string;
}

export async function POST(request: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V11-API-StartQuest][${requestId}]`;
  
  console.log(`${logPrefix} === STARTING QUEST REQUEST ===`);
  
  try {
    // Parse request body
    const body = await request.json() as StartQuestRequest;
    const { userId, questId } = body;
    
    console.log(`${logPrefix} Request body:`, JSON.stringify({
      userId: userId || 'not provided',
      questId
    }, null, 2));
    
    // Validate parameters
    if (!questId) {
      console.error(`${logPrefix} Missing required questId parameter`);
      return NextResponse.json(
        { error: 'Quest ID is required' },
        { status: 400 }
      );
    }
    
    // Fetch the quest
    console.log(`${logPrefix} Fetching quest with ID: ${questId}`);
    const { data: quest, error: questError } = await supabase
      .from('book_quests')
      .select('*, books_v2!inner(title, author)')
      .eq('id', questId)
      .single();
    
    if (questError) {
      console.error(`${logPrefix} Error fetching quest:`, questError);
      return NextResponse.json(
        { error: 'Failed to fetch quest', details: questError.message },
        { status: 500 }
      );
    }
    
    if (!quest) {
      console.error(`${logPrefix} Quest not found with ID: ${questId}`);
      return NextResponse.json(
        { error: 'Quest not found' },
        { status: 404 }
      );
    }
    
    console.log(`${logPrefix} Found quest: "${quest.quest_title}" (Chapter ${quest.chapter_number})`);
    
    // Create a new conversation if userId provided
    let conversationId = null;
    if (userId) {
      console.log(`${logPrefix} Creating new conversation for user: ${userId}`);
      
      try {
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            human_id: userId,
            is_active: true
          })
          .select('id')
          .single();
        
        if (convError) {
          console.error(`${logPrefix} Error creating conversation:`, convError);
        } else if (conversation) {
          conversationId = conversation.id;
          console.log(`${logPrefix} Created conversation with ID: ${conversationId}`);
        }
      } catch (convErr) {
        console.error(`${logPrefix} Unexpected error creating conversation:`, convErr);
        // Continue despite error - conversation ID is optional
      }
    } else {
      console.log(`${logPrefix} No userId provided, skipping conversation creation`);
    }
    
    // If userId provided, mark the quest as active in user_quests table
    if (userId) {
      console.log(`${logPrefix} Marking quest as active for user: ${userId}`);
      
      try {
        // Check if record already exists
        const { data: existingRecord, error: checkError } = await supabase
          .from('user_quests')
          .select('id, status')
          .eq('user_id', userId)
          .eq('quest_id', questId)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error code
          console.error(`${logPrefix} Error checking existing record:`, checkError);
        }
        
        // If record exists, update it to active (unless it's already completed)
        if (existingRecord) {
          if (existingRecord.status !== 'completed') {
            console.log(`${logPrefix} Updating existing record to active status`);
            await supabase
              .from('user_quests')
              .update({ status: 'active' })
              .eq('id', existingRecord.id);
          } else {
            console.log(`${logPrefix} Quest already marked as completed, not changing status`);
          }
        } 
        // If no record exists, create one
        else {
          console.log(`${logPrefix} Creating new record with active status`);
          await supabase
            .from('user_quests')
            .insert({
              user_id: userId,
              quest_id: questId,
              status: 'active'
            });
        }
      } catch (userQuestErr) {
        console.error(`${logPrefix} Error updating user_quests:`, userQuestErr);
        // Continue despite error - status tracking is optional
      }
    }
    
    // Combine quest information
    const combinedQuestion = `${quest.introduction} To earn ${quest.reward} ${quest.challenge} ${quest.starting_question}`;
    
    // Prepare the response
    const response = {
      questionId: quest.id,
      question: combinedQuestion,
      bookTitle: quest.books_v2.title,
      bookId: quest.book_id,
      bookAuthor: quest.books_v2.author,
      conversationId,
      chapterInfo: `Chapter ${quest.chapter_number}: ${quest.chapter_title}`,
      quest_title: quest.quest_title,
      type: 'quest'
    };
    
    console.log(`${logPrefix} Returning quest information`);
    console.log(`${logPrefix} === QUEST REQUEST COMPLETED SUCCESSFULLY ===`);
    
    return NextResponse.json(response);
    
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