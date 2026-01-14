-- Migration: Add function to increment AI usage tracking
-- Used by process-recording Edge Function after transcription

-- Create function to increment AI processing minutes
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID, p_minutes NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE;
BEGIN
  -- Get current period (first day of current month)
  v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;

  -- Insert or update usage record
  INSERT INTO usage (user_id, period_start, period_type, minutes_recorded, minutes_transcribed, recording_count)
  VALUES (p_user_id, v_period_start, 'monthly', 0, p_minutes, 0)
  ON CONFLICT (user_id, period_start, period_type)
  DO UPDATE SET
    minutes_transcribed = usage.minutes_transcribed + p_minutes;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION increment_ai_usage TO authenticated, service_role;

COMMENT ON FUNCTION increment_ai_usage IS 'Increments AI processing minutes for a user in the current period';
