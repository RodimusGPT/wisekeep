-- WiseKeep Storage Bucket Migration
-- Creates the recordings storage bucket with appropriate policies

-- Note: Storage bucket creation must be done via Supabase Dashboard or API
-- This migration sets up the RLS policies for the bucket

-- The bucket should be created with:
-- - Name: recordings
-- - Public: false (private bucket, requires signed URLs)
-- - File size limit: 500MB (or as per app_config)

-- ============================================
-- Storage Policies
-- ============================================

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own recordings
CREATE POLICY "Users can read own recordings"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own recordings
CREATE POLICY "Users can delete own recordings"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own recordings
CREATE POLICY "Users can update own recordings"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- IMPORTANT: Manual Setup Required
-- ============================================
-- After running this migration, you must create the storage bucket
-- via Supabase Dashboard:
--
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New Bucket"
-- 3. Name: recordings
-- 4. Public bucket: OFF (unchecked)
-- 5. File size limit: 524288000 (500MB in bytes)
-- 6. Allowed MIME types: audio/webm, audio/mp4, audio/mpeg, audio/wav
--
-- Or via SQL (requires admin privileges):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'recordings',
--   'recordings',
--   false,
--   524288000,
--   ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav']
-- );
