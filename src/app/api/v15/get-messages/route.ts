import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const conversationId = searchParams.get('conversationId');
  
  if (!conversationId) {
    return NextResponse.json(
      { success: false, error: 'Conversation ID is required' },
      { status: 400 }
    );
  }
  
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch messages' 
      },
      { status: 500 }
    );
  }
}