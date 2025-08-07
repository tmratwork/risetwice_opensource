-- Create table for storing search progress updates
CREATE TABLE IF NOT EXISTS progress_updates (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  stage TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Index for efficient filtering by request_id
  INDEX idx_progress_updates_request_id (request_id),
  -- Index for cleanup of old records
  INDEX idx_progress_updates_created_at (created_at)
);

-- Enable Row Level Security
ALTER TABLE progress_updates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own progress updates
CREATE POLICY "Users can view own progress updates" ON progress_updates
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: System can insert progress updates for authenticated users
CREATE POLICY "System can insert progress updates" ON progress_updates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE progress_updates;

-- Function to clean up old progress updates (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_progress_updates()
RETURNS void AS $$
BEGIN
  DELETE FROM progress_updates
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup (requires pg_cron extension)
-- Run this separately if pg_cron is available:
-- SELECT cron.schedule('cleanup-progress-updates', '0 * * * *', 'SELECT cleanup_old_progress_updates();');