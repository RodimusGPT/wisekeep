-- WiseKeep Database Schema
-- This migration creates the tables needed for the WiseKeep app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recordings table
-- Stores metadata about audio recordings
CREATE TABLE IF NOT EXISTS recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    device_id TEXT NOT NULL, -- Anonymous device identifier
    duration INTEGER NOT NULL, -- Duration in seconds
    audio_url TEXT NOT NULL, -- Supabase Storage URL
    status TEXT NOT NULL DEFAULT 'processing_notes' CHECK (status IN ('processing_notes', 'processing_summary', 'ready', 'error')),
    notes JSONB, -- Array of note objects with timestamp, text, speaker
    summary JSONB, -- Array of summary points
    language TEXT DEFAULT 'zh-TW', -- Recording language
    error_message TEXT -- Error details if status is 'error'
);

-- Processing queue table
-- Tracks transcription and summarization jobs
CREATE TABLE IF NOT EXISTS processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    step TEXT NOT NULL CHECK (step IN ('transcription', 'summarization')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recordings_device_id ON recordings(device_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_recording_id ON processing_queue(recording_id);

-- Enable Row Level Security
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recordings
-- Allow anonymous users to create recordings
CREATE POLICY "Allow anonymous create recordings" ON recordings
    FOR INSERT
    WITH CHECK (true);

-- Allow users to read their own recordings by device_id
CREATE POLICY "Allow read own recordings" ON recordings
    FOR SELECT
    USING (true); -- In production, filter by device_id from JWT or session

-- Allow users to update their own recordings
CREATE POLICY "Allow update own recordings" ON recordings
    FOR UPDATE
    USING (true);

-- Allow users to delete their own recordings
CREATE POLICY "Allow delete own recordings" ON recordings
    FOR DELETE
    USING (true);

-- RLS Policies for processing_queue
CREATE POLICY "Allow read processing queue" ON processing_queue
    FOR SELECT
    USING (true);

CREATE POLICY "Allow insert processing queue" ON processing_queue
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow update processing queue" ON processing_queue
    FOR UPDATE
    USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on processing_queue
CREATE TRIGGER update_processing_queue_updated_at
    BEFORE UPDATE ON processing_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for audio files
-- Note: This needs to be created via Supabase dashboard or API
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

COMMENT ON TABLE recordings IS 'Stores audio recording metadata for WiseKeep app';
COMMENT ON TABLE processing_queue IS 'Tracks transcription and summarization processing jobs';
COMMENT ON COLUMN recordings.device_id IS 'Anonymous device identifier for tracking user recordings';
COMMENT ON COLUMN recordings.notes IS 'JSON array of {id, timestamp, text, speaker} objects';
COMMENT ON COLUMN recordings.summary IS 'JSON array of summary point strings';
