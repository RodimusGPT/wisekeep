-- Migration: Add new status values for on-demand processing model
-- Drop old constraint and add new one with additional status values

ALTER TABLE recordings DROP CONSTRAINT IF EXISTS recordings_status_check;

ALTER TABLE recordings ADD CONSTRAINT recordings_status_check
CHECK (status = ANY (ARRAY[
  'recorded'::text,           -- NEW: saved but not yet processed
  'processing_notes'::text,   -- transcription in progress
  'notes_ready'::text,        -- NEW: transcription complete, summary not started
  'processing_summary'::text, -- summarization in progress
  'ready'::text,              -- fully processed
  'error'::text               -- processing failed
]));

COMMENT ON COLUMN recordings.status IS 'Recording status: recorded (saved only), processing_notes (transcribing), notes_ready (transcribed), processing_summary (summarizing), ready (complete), error (failed)';
