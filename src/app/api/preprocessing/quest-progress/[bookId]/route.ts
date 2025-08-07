/**
 * API route for tracking quest generation progress
 * Returns the current progress for a specific book ID
 */
import { NextResponse, NextRequest } from 'next/server';

// Define interface for progress data
interface ProgressData {
  percentage: number;
  status: string;
  updatedAt: Date;
}

// Extend global NodeJS namespace to include our custom properties
declare global {
  // Using var is required for global declarations, despite the linting rule
  // eslint-disable-next-line no-var
  var questProgressStore: Map<string, ProgressData>;
}

// Global progress store (in-memory)
// In a production environment, this could be replaced with Redis or another persistent store
if (!global.questProgressStore) {
  global.questProgressStore = new Map<string, ProgressData>();
}

export const dynamic = 'force-dynamic'; // Never cache this route

/**
 * Get the current progress for a book ID
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  // Using the Next.js 15 Promise-based params
  const { bookId } = await params;
  
  if (!bookId) {
    return NextResponse.json(
      { error: 'Book ID is required' },
      { status: 400 }
    );
  }

  // Get progress from store
  const progressData = global.questProgressStore.get(bookId) || {
    percentage: 0,
    status: 'Not started',
    updatedAt: new Date()
  };

  // Auto-expire old progress data after 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (progressData.updatedAt < thirtyMinutesAgo) {
    global.questProgressStore.delete(bookId);
    return NextResponse.json({
      bookId,
      percentage: 0,
      status: 'Expired',
      updatedAt: new Date()
    });
  }

  return NextResponse.json({
    bookId,
    ...progressData
  });
}