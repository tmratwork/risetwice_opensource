-- SQL script to create the character profile processing tracking table
-- This is used by the coordinator to track progress across API calls

-- Create the tracking table
CREATE TABLE IF NOT EXISTS character_profile_processing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books_v2(id),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'error')),
  processed_chapters TEXT[] DEFAULT '{}',
  current_chapter TEXT,
  total_chapters INTEGER NOT NULL,
  error_chapters JSONB DEFAULT '[]',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on book_id for efficient lookups
CREATE INDEX IF NOT EXISTS character_profile_processing_book_id_idx ON character_profile_processing(book_id);

-- Add a unique constraint to ensure only one processing record per book
ALTER TABLE character_profile_processing ADD CONSTRAINT unique_book_processing UNIQUE (book_id);

-- NOTES:
-- Run this SQL script in your Supabase SQL editor or database client
-- The coordinator will use this table to track which chapters have been processed
-- and which ones encountered errors
--
-- The `processed_chapters` array contains chapter numbers that were successfully processed
-- The `error_chapters` JSONB array contains objects with chapter numbers and error messages
-- Example error_chapters: [{"chapter": "16", "error": "Rate limit exceeded"}]