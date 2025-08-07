# Book Content Upload Tool

This tool uploads book content from a text file to the Supabase `books_v2` table.

## Prerequisites

- Node.js and npm installed
- Access to the Supabase database with appropriate permissions
- Valid book record already created in the `books_v2` table (the script only updates the content)

## Setup

Ensure your `.env.local` file in the project root contains the Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase
```

If you're running this script in an environment where you already have Next.js running, 
these variables should already be configured.

## Usage

1. Create your book content file:
   - Create or copy your book content to `/Users/tmr/github/living_books/src/tools/complete_book.txt`

2. Edit the script to set your book ID:
   - Open `/Users/tmr/github/living_books/src/tools/insert_content_supabase.mjs`
   - Locate the `BOOK_ID` constant near the top of the file:
     ```javascript
     // ====== CONFIGURATION ======
     // Set your book ID here (UUID format from books_v2 table)
     const BOOK_ID = '123e4567-e89b-12d3-a456-426614174000'; // Replace with your actual book ID
     // ===========================
     ```
   - Replace the example UUID with your actual book ID from the `books_v2` table

3. Run the script:
   ```
   cd /Users/tmr/github/living_books
   node src/tools/insert_content_supabase.mjs
   ```

4. Verify the upload:
   - The script will print confirmation of successful upload
   - You can check the Supabase dashboard to confirm the content was updated

## Script Features

- Validates book ID format (must be a valid UUID)
- Verifies the book exists in the database before attempting to update
- Provides detailed logging throughout the process
- Handles errors gracefully with clear messages
- Displays content size and book information upon successful update
- Securely loads credentials from environment variables

## Important Notes

- The book ID must exist in the `books_v2` table before running this script
- This script only updates the `content` field and does not modify any other fields
- Large content uploads may take some time depending on your network connection
- Make sure your Supabase storage plan can accommodate the content size
- This script does not create vector embeddings for the content - use the embedding tools for that

## Troubleshooting

If you encounter errors:

1. Verify the book ID exists in the `books_v2` table
2. Check Supabase connection and credentials in your `.env.local` file
3. Ensure the content file is in UTF-8 format and exists in the correct location
4. For very large files, you may need to increase the timeout settings
5. Ensure you have the dotenv package installed (`npm install dotenv`)