// src/app/api/v11/quests/route.ts
/**
 * V11 API - Quests Endpoint
 * 
 * This endpoint retrieves quests for a book and tracks user quest status.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// interface Quest {
//   id: string;
//   book_id: string;
//   chapter_number: number;
//   chapter_title: string;
//   quest_title: string;
//   introduction: string;
//   challenge: string;
//   reward: string;
//   starting_question: string;
//   status?: string; // Added for user specific status
//   created_at?: string;
// }

export async function GET(request: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V11-API-Quests][${requestId}]`;

  console.log(`${logPrefix} === STARTING QUESTS REQUEST ===`);

  try {
    // Get query parameters
    const url = new URL(request.url);
    const bookId = url.searchParams.get('book_id');
    const userId = url.searchParams.get('user_id');

    console.log(`${logPrefix} Request parameters: bookId=${bookId}, userId=${userId}`);

    // Validate parameters
    if (!bookId) {
      console.error(`${logPrefix} Missing required book_id parameter`);
      return NextResponse.json(
        { error: 'Book ID is required' },
        { status: 400 }
      );
    }

    // If userId is provided, fetch quests with user status
    if (userId) {
      console.log(`${logPrefix} Fetching quests with user status for userId: ${userId}`);

      // Get all quests for the book
      const { data: quests, error } = await supabase
        .from('book_quests')
        .select('*')
        .eq('book_id', bookId)
        .order('chapter_number', { ascending: true });

      if (error) {
        console.error(`${logPrefix} Database error:`, error);
        return NextResponse.json(
          { error: 'Failed to fetch quests', details: error.message },
          { status: 500 }
        );
      }

      // Fetch user status separately
      const { data: userQuests, error: userQuestsError } = await supabase
        .from('user_quests')
        .select('*')
        .eq('user_id', userId);

      if (userQuestsError) {
        console.error(`${logPrefix} Error fetching user quests:`, userQuestsError);
        // Continue anyway, just without user status
      }

      // Transform the data to include status
      const transformedQuests = quests?.map(quest => {
        const userQuest = userQuests?.find(uq => uq.quest_id === quest.id);

        return {
          ...quest,
          status: userQuest?.status || 'not_started',
          completion_date: userQuest?.completion_date || null
        };
      });

      console.log(`${logPrefix} Successfully fetched ${transformedQuests?.length || 0} quests with user status`);
      return NextResponse.json(transformedQuests || []);
    }

    // If no userId, just fetch all quests for the book
    else {
      console.log(`${logPrefix} Fetching all quests for bookId: ${bookId} (no user status)`);

      const { data: quests, error } = await supabase
        .from('book_quests')
        .select('*')
        .eq('book_id', bookId)
        .order('chapter_number', { ascending: true });

      if (error) {
        console.error(`${logPrefix} Database error:`, error);
        return NextResponse.json(
          { error: 'Failed to fetch quests', details: error.message },
          { status: 500 }
        );
      }

      console.log(`${logPrefix} Successfully fetched ${quests?.length || 0} quests`);
      return NextResponse.json(quests || []);
    }

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

// Update quest status (mark as active or completed)
export async function POST(request: Request) {
  const requestId = Date.now().toString().slice(-6);
  const logPrefix = `[V11-API-Quests][${requestId}]`;

  console.log(`${logPrefix} === STARTING UPDATE QUEST STATUS REQUEST ===`);

  try {
    // Parse request body
    const body = await request.json();
    const { user_id, quest_id, status } = body;

    console.log(`${logPrefix} Request body:`, JSON.stringify(body, null, 2));

    // Validate parameters
    if (!user_id || !quest_id || !status) {
      console.error(`${logPrefix} Missing required parameters`);
      return NextResponse.json(
        { error: 'user_id, quest_id, and status are required' },
        { status: 400 }
      );
    }

    // Validate status value
    if (status !== 'active' && status !== 'completed') {
      console.error(`${logPrefix} Invalid status value: ${status}`);
      return NextResponse.json(
        { error: 'Status must be "active" or "completed"' },
        { status: 400 }
      );
    }

    console.log(`${logPrefix} Updating quest status to "${status}" for user ${user_id}, quest ${quest_id}`);

    // Check if record already exists
    const { data: existingRecord, error: checkError } = await supabase
      .from('user_quests')
      .select('id, status')
      .eq('user_id', user_id)
      .eq('quest_id', quest_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error code
      console.error(`${logPrefix} Error checking existing record:`, checkError);
      return NextResponse.json(
        { error: 'Failed to check existing record', details: checkError.message },
        { status: 500 }
      );
    }

    let result;

    // If record exists, update it
    if (existingRecord) {
      console.log(`${logPrefix} Updating existing record ${existingRecord.id} from "${existingRecord.status}" to "${status}"`);

      const updateData: { status: string; completion_date?: string | null } = {
        status,
      };

      // If status is completed, set completion date
      if (status === 'completed') {
        updateData.completion_date = new Date().toISOString();
      }

      const { data, error: updateError } = await supabase
        .from('user_quests')
        .update(updateData)
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (updateError) {
        console.error(`${logPrefix} Error updating record:`, updateError);
        return NextResponse.json(
          { error: 'Failed to update quest status', details: updateError.message },
          { status: 500 }
        );
      }

      result = data;
    }
    // If record doesn't exist, create it
    else {
      console.log(`${logPrefix} Creating new record for user ${user_id}, quest ${quest_id} with status "${status}"`);

      const insertData: { user_id: string; quest_id: string; status: string; completion_date?: string | null } = {
        user_id,
        quest_id,
        status,
      };

      // If status is completed, set completion date
      if (status === 'completed') {
        insertData.completion_date = new Date().toISOString();
      }

      const { data, error: insertError } = await supabase
        .from('user_quests')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error(`${logPrefix} Error creating record:`, insertError);
        return NextResponse.json(
          { error: 'Failed to create quest status', details: insertError.message },
          { status: 500 }
        );
      }

      result = data;
    }

    console.log(`${logPrefix} Successfully ${existingRecord ? 'updated' : 'created'} quest status:`, result);

    return NextResponse.json({
      success: true,
      message: `Quest marked as ${status}`,
      data: result
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