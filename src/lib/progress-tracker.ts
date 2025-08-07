/**
 * Utility for tracking and updating progress of long-running operations
 */

// Define a type for progress data
export interface ProgressData {
  percentage: number;
  status: string;
  updatedAt: Date;
}

// Initialize the global progress store if it doesn't exist
if (typeof global !== 'undefined' && !global.questProgressStore) {
  global.questProgressStore = new Map<string, ProgressData>();
}

// Store the last logged percentage for each book ID
const lastLoggedPercentage: Record<string, number> = {};

// Significant milestones are defined in the commented code below
// Removed unused constant

/**
 * Update the progress for a specific book
 * @param bookId The book ID to update progress for
 * @param percentage The progress percentage (0-100)
 * @param status A descriptive status message
 */
export function updateQuestProgress(
  bookId: string, 
  percentage: number, 
  status: string
): void {
  if (typeof global === 'undefined' || !global.questProgressStore) return;
  
  // Ensure percentage is between 0 and 100
  const validPercentage = Math.max(0, Math.min(100, Math.round(percentage)));
  
  // Always update the progress in the store
  global.questProgressStore.set(bookId, {
    percentage: validPercentage,
    status,
    updatedAt: new Date()
  });
  
  // Last logged percentage would be used for threshold checks in logging
  // (Code currently commented out)
  
  // Logging criteria (commented out)
  // 1. Status contains error or important keywords
  // 2. It's a significant milestone (0%, 25%, 50%, 75%, 100%)
  // 3. Progress change exceeds threshold (10% minimum jump)
  
  // NOTE: Logging is currently disabled and these criteria are no longer used
  
  // Completely disable progress logging
  /*
  // Example for conditionally logging progress:
  // Define significant milestones
  const significantMilestones = [0, 25, 50, 75, 100];
  // Get the last logged percentage
  const lastPercentage = lastLoggedPercentage[bookId] || -1;
  
  if (
    status.toLowerCase().includes('error') || 
    status.toLowerCase().includes('complete') ||
    status.toLowerCase().includes('fail') ||
    status.toLowerCase().includes('start') ||
    significantMilestones.includes(validPercentage) ||
    Math.abs(validPercentage - lastPercentage) >= 10
  ) {
    // Only log if it meets our criteria
    console.log(`[ProgressTracker] Book ${bookId}: ${validPercentage}% - ${status}`);
    
    // Update the last logged percentage
    lastLoggedPercentage[bookId] = validPercentage;
  }
  */
}

/**
 * Get the current progress for a book
 * @param bookId The book ID to get progress for
 * @returns The progress data, or null if no progress is found
 */
export function getQuestProgress(bookId: string): ProgressData | null {
  if (typeof global === 'undefined' || !global.questProgressStore) return null;
  
  return global.questProgressStore.get(bookId) || null;
}

/**
 * Clear the progress for a book
 * @param bookId The book ID to clear progress for
 */
export function clearQuestProgress(bookId: string): void {
  if (typeof global === 'undefined' || !global.questProgressStore) return;
  
  global.questProgressStore.delete(bookId);
  
  // Also clear the last logged percentage
  if (bookId in lastLoggedPercentage) {
    delete lastLoggedPercentage[bookId];
  }
  
  // Comment out progress clearing log
  // console.log(`[ProgressTracker] Cleared progress for book ${bookId}`);
}

/**
 * Clear all progress data
 */
export function clearAllQuestProgress(): void {
  if (typeof global === 'undefined' || !global.questProgressStore) return;
  
  global.questProgressStore.clear();
  
  // Clear all last logged percentages
  Object.keys(lastLoggedPercentage).forEach(key => {
    delete lastLoggedPercentage[key];
  });
  
  // Comment out progress clearing log
  // console.log('[ProgressTracker] Cleared all progress data');
}