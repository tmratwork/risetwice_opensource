// src/app/api/v10/books/route.ts
/**
 * V10 API - Books Endpoint
 * 
 * This endpoint fetches books from the database with their UUID IDs.
 * Adapted from V9 implementation to work with the V10 WebRTC approach.
 */
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface Book {
  id: string;  // UUID format
  title: string;
  author: string;
  created_at: string;
}

export async function GET() {
  const logPrefix = '[V10-API-Books]';
  
  try {
    console.log(`${logPrefix} Fetching books from database`);
    
    // Fetch books from the database
    const { data: books, error } = await supabase
      .from('books_v2')
      .select('id, title, author, created_at')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error(`${logPrefix} Error fetching books:`, error);
      return NextResponse.json(
        { error: 'Failed to fetch books' },
        { status: 500 }
      );
    }
    
    // If no books found, return empty array
    if (!books || books.length === 0) {
      console.warn(`${logPrefix} No books found in database`);
      return NextResponse.json<Book[]>([]);
    }
    
    console.log(`${logPrefix} Successfully fetched ${books.length} books`);
    
    // Return the books data with UUID IDs directly as Book[] array
    return NextResponse.json<Book[]>(books);
    
  } catch (error) {
    console.error(`${logPrefix} Unexpected error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}