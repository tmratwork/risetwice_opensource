import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const quest = await request.json();
    
    if (!quest || !quest.id) {
      return NextResponse.json({ error: 'Invalid quest data - missing ID' }, { status: 400 });
    }
    
    // Required fields validation
    const requiredFields = ['book_id', 'chapter_number', 'chapter_title', 'quest_title', 'introduction', 'challenge', 'reward', 'starting_question'];
    
    for (const field of requiredFields) {
      if (!quest[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }
    
    // Update the quest in the database
    const { data, error } = await supabase
      .from('book_quests')
      .update({
        book_id: quest.book_id,
        chapter_number: quest.chapter_number,
        chapter_title: quest.chapter_title,
        quest_title: quest.quest_title,
        introduction: quest.introduction,
        challenge: quest.challenge,
        reward: quest.reward,
        starting_question: quest.starting_question,
        ai_prompt: quest.ai_prompt || null, // Handle null case for optional field
      })
      .eq('id', quest.id)
      .select();
    
    if (error) {
      console.error('Error updating quest:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Quest updated successfully', data });
  } catch (error) {
    console.error('Error in quest update API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}