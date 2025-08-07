// src/tools/insert_content_supabase.mjs
/**
 * Script to insert book content from a file into Supabase 'books_v2' table
 * 
 * This script reads the content of complete_book.txt and updates the 'content' field
 * of the specified book ID in the 'books_v2' table.
 * 
 * Usage:
 * 1. Set the BOOK_ID constant below to the UUID of the book in books_v2 table
 * 2. Run the script with: node src/tools/insert_content_supabase.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local file (Next.js convention)
dotenv.config({ path: '.env.local' });

// ====== CONFIGURATION ======
// Set your book ID here (UUID format from books_v2 table)
const BOOK_ID = '2b169bda-011b-4834-8454-e30fed95669d'; // Replace with your actual book ID
// ===========================

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const BOOK_CONTENT_PATH = path.join(__dirname, 'complete_book.txt');

// Check for required environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[BookContentUploader] ❌ Error: Missing Supabase environment variables');
  console.error('Please ensure your .env.local file contains:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key');
  process.exit(1);
}

// Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`[BookContentUploader] Starting content upload process...`);

  try {
    // Validate the book ID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(BOOK_ID)) {
      throw new Error(`Invalid book ID format: ${BOOK_ID}. Must be a valid UUID.`);
    }

    // Read the content file
    console.log(`[BookContentUploader] Reading content file: ${BOOK_CONTENT_PATH}`);
    if (!fs.existsSync(BOOK_CONTENT_PATH)) {
      throw new Error(`Content file not found: ${BOOK_CONTENT_PATH}`);
    }

    const content = fs.readFileSync(BOOK_CONTENT_PATH, 'utf8');
    console.log(`[BookContentUploader] Successfully read ${content.length} characters`);

    // Verify the book exists in books_v2 table
    console.log(`[BookContentUploader] Verifying book ID exists in books_v2 table...`);
    const { data: bookData, error: bookError } = await supabase
      .from('books_v2')
      .select('id, title, author')
      .eq('id', BOOK_ID)
      .single();

    if (bookError) {
      throw new Error(`Book ID ${BOOK_ID} not found in books_v2 table: ${bookError.message}`);
    }

    console.log(`[BookContentUploader] Found book: "${bookData.title}" by ${bookData.author}`);

    // Update the book content
    console.log(`[BookContentUploader] Updating book content (${content.length} characters)...`);
    const { error: updateError } = await supabase
      .from('books_v2')
      .update({ content })
      .eq('id', BOOK_ID);

    if (updateError) {
      throw new Error(`Failed to update book content: ${updateError.message}`);
    }

    console.log(`[BookContentUploader] ✅ Successfully updated content for book:`);
    console.log(`  - ID: ${BOOK_ID}`);
    console.log(`  - Title: ${bookData.title}`);
    console.log(`  - Author: ${bookData.author}`);
    console.log(`  - Content size: ${(content.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error(`[BookContentUploader] ❌ Error:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute the main function
main().catch(err => {
  console.error(`[BookContentUploader] Unhandled error:`, err instanceof Error ? err.message : String(err));
  process.exit(1);
}).then(() => {
  console.log(`[BookContentUploader] Process complete.`);
});