-- V16 Memory System Schema Enhancements
-- Run this SQL in Supabase to add detailed extraction tracking

-- Add new columns to v16_conversation_analyses table
ALTER TABLE v16_conversation_analyses 
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_details JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skip_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS processing_duration_ms INTEGER DEFAULT 0;

-- Add comments to document the new columns
COMMENT ON COLUMN v16_conversation_analyses.message_count IS 'Number of messages in the conversation';
COMMENT ON COLUMN v16_conversation_analyses.total_tokens IS 'Estimated token count for this conversation';
COMMENT ON COLUMN v16_conversation_analyses.processing_status IS 'Status: pending, processing, completed, failed, skipped';
COMMENT ON COLUMN v16_conversation_analyses.error_details IS 'Detailed error information if processing failed';
COMMENT ON COLUMN v16_conversation_analyses.extraction_metadata IS 'Metadata about the extraction process (model used, prompts, etc)';
COMMENT ON COLUMN v16_conversation_analyses.quality_score IS 'Quality score (1-10) determining if conversation should be processed';
COMMENT ON COLUMN v16_conversation_analyses.skip_reason IS 'Reason why conversation was skipped (too_short, insufficient_quality, etc)';
COMMENT ON COLUMN v16_conversation_analyses.processing_duration_ms IS 'Time taken to process this conversation in milliseconds';

-- Create index for efficient querying by status
CREATE INDEX IF NOT EXISTS idx_v16_conversation_analyses_status 
ON v16_conversation_analyses(processing_status);

-- Create index for querying by user and status
CREATE INDEX IF NOT EXISTS idx_v16_conversation_analyses_user_status 
ON v16_conversation_analyses(user_id, processing_status);

-- Add new columns to v16_memory_jobs for better job tracking
ALTER TABLE v16_memory_jobs
ADD COLUMN IF NOT EXISTS conversations_skipped INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversations_failed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_quality_score DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS processing_start_time TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS processing_end_time TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments for job tracking columns
COMMENT ON COLUMN v16_memory_jobs.conversations_skipped IS 'Number of conversations skipped due to quality/length';
COMMENT ON COLUMN v16_memory_jobs.conversations_failed IS 'Number of conversations that failed processing';
COMMENT ON COLUMN v16_memory_jobs.average_quality_score IS 'Average quality score of processed conversations';
COMMENT ON COLUMN v16_memory_jobs.total_tokens_processed IS 'Total tokens processed across all conversations';
COMMENT ON COLUMN v16_memory_jobs.processing_start_time IS 'When background processing actually started';
COMMENT ON COLUMN v16_memory_jobs.processing_end_time IS 'When background processing completed';

-- Create a new table for detailed processing logs (optional - for debugging)
CREATE TABLE IF NOT EXISTS v16_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES v16_memory_jobs(id) ON DELETE CASCADE,
    conversation_id UUID DEFAULT NULL,
    log_level TEXT NOT NULL CHECK (log_level IN ('INFO', 'WARN', 'ERROR', 'DEBUG')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for processing logs
CREATE INDEX IF NOT EXISTS idx_v16_processing_logs_job_id ON v16_processing_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_v16_processing_logs_level ON v16_processing_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_v16_processing_logs_created_at ON v16_processing_logs(created_at);

-- Add RLS policies for the new logs table
ALTER TABLE v16_processing_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see logs for their own jobs
CREATE POLICY "Users can access their own processing logs" 
ON v16_processing_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM v16_memory_jobs 
        WHERE v16_memory_jobs.id = v16_processing_logs.job_id 
        AND v16_memory_jobs.user_id = auth.uid()::text
    )
);

-- Policy: Service role can do everything
CREATE POLICY "Service role full access to processing logs" 
ON v16_processing_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Update existing records to have default status
UPDATE v16_conversation_analyses 
SET processing_status = 'completed'
WHERE processing_status IS NULL AND analysis_result IS NOT NULL;

UPDATE v16_conversation_analyses 
SET processing_status = 'skipped', skip_reason = 'insufficient_quality'
WHERE processing_status IS NULL AND (analysis_result->>'skipped')::boolean = true;