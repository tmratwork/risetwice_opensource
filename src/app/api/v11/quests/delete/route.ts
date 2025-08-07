import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Missing quest ID' }, { status: 400 });
    }
    
    // First, check if this quest has any active user quests
    const { data: userQuests, error: checkError } = await supabase
      .from('user_quests')
      .select('id')
      .eq('quest_id', id);
    
    if (checkError) {
      console.error('Error checking user quests:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }
    
    // If there are user quests, don't allow deletion
    if (userQuests && userQuests.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete quest that has been started by users',
        userQuestsCount: userQuests.length 
      }, { status: 400 });
    }
    
    // Delete the quest
    const { error } = await supabase
      .from('book_quests')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting quest:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Quest deleted successfully' });
  } catch (error) {
    console.error('Error in quest deletion API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}