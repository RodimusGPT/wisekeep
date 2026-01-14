-- Migration: On-Demand AI Processing Model
-- Changes recording from auto-process to user-initiated processing
-- Recording is unlimited, AI processing is metered

-- 1. Add new recording status 'recorded' (audio saved, not yet processed)
-- No need to alter enum, just start using new status value

-- 2. Update usage table comments (table already has minutes_transcribed column)
COMMENT ON COLUMN usage.minutes_recorded IS 'Total minutes of audio recorded (unlimited for all tiers)';
COMMENT ON COLUMN usage.minutes_transcribed IS 'Minutes of AI transcription processing used (metered for free tier)';

-- 3. Update app_config with new tier limits
-- Storage limits (max recordings stored)
INSERT INTO app_config (key, value, description) VALUES
  ('free_tier_max_recordings', '10', 'Maximum recordings stored for free tier users')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

INSERT INTO app_config (key, value, description) VALUES
  ('premium_tier_max_recordings', '100', 'Maximum recordings stored for premium tier users')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

INSERT INTO app_config (key, value, description) VALUES
  ('vip_tier_max_recordings', '-1', 'Maximum recordings stored for VIP tier users (-1 = unlimited)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Update AI processing limits (transcription/summary)
UPDATE app_config SET
  description = 'AI processing minutes per month for free tier (transcription uses minutes, summary is free)'
WHERE key = 'free_tier_minutes';

INSERT INTO app_config (key, value, description) VALUES
  ('premium_tier_ai_unlimited', 'true', 'Premium tier has unlimited AI processing')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

INSERT INTO app_config (key, value, description) VALUES
  ('vip_tier_ai_unlimited', 'true', 'VIP tier has unlimited AI processing')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 4. Create function to check storage limit for user
CREATE OR REPLACE FUNCTION check_storage_limit(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_max_recordings INT;
  v_current_count INT;
  v_can_record BOOLEAN;
  v_remaining INT;
BEGIN
  -- Get user's tier
  SELECT tier INTO v_tier
  FROM users
  WHERE id = p_user_id;

  -- Get max recordings for tier
  IF v_tier = 'free' THEN
    SELECT value::INT INTO v_max_recordings
    FROM app_config
    WHERE key = 'free_tier_max_recordings';
  ELSIF v_tier = 'premium' THEN
    SELECT value::INT INTO v_max_recordings
    FROM app_config
    WHERE key = 'premium_tier_max_recordings';
  ELSIF v_tier = 'vip' THEN
    SELECT value::INT INTO v_max_recordings
    FROM app_config
    WHERE key = 'vip_tier_max_recordings';
    IF v_max_recordings = -1 THEN
      -- Unlimited
      RETURN jsonb_build_object(
        'can_record', true,
        'max_recordings', -1,
        'current_count', 0,
        'remaining', -1
      );
    END IF;
  END IF;

  -- Count current recordings (exclude soft-deleted)
  SELECT COUNT(*) INTO v_current_count
  FROM recordings
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;

  -- Check if can record
  v_can_record := v_current_count < v_max_recordings;
  v_remaining := v_max_recordings - v_current_count;

  RETURN jsonb_build_object(
    'can_record', v_can_record,
    'max_recordings', v_max_recordings,
    'current_count', v_current_count,
    'remaining', GREATEST(v_remaining, 0)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_storage_limit TO authenticated, anon;

-- 5. Update check_usage function to check AI processing minutes
CREATE OR REPLACE FUNCTION check_usage(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_ai_minutes_used NUMERIC(10, 2);
  v_ai_minutes_limit INT;
  v_period_start DATE;
  v_can_process BOOLEAN;
  v_storage_check jsonb;
BEGIN
  -- Get user's tier
  SELECT tier INTO v_tier
  FROM users
  WHERE id = p_user_id;

  -- Check storage limit
  v_storage_check := check_storage_limit(p_user_id);

  -- Get current usage period
  SELECT
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    COALESCE(minutes_transcribed, 0)
  INTO v_period_start, v_ai_minutes_used
  FROM usage
  WHERE user_id = p_user_id
    AND period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE;

  -- If no usage record exists, create one
  IF NOT FOUND THEN
    INSERT INTO usage (user_id, period_start, period_type, minutes_recorded, minutes_transcribed, recording_count)
    VALUES (p_user_id, DATE_TRUNC('month', CURRENT_DATE)::DATE, 'monthly', 0, 0, 0);
    v_ai_minutes_used := 0;
  END IF;

  -- Determine AI processing limit based on tier
  IF v_tier = 'free' THEN
    SELECT value::INT INTO v_ai_minutes_limit
    FROM app_config
    WHERE key = 'free_tier_minutes';
    v_can_process := v_ai_minutes_used < v_ai_minutes_limit;
  ELSE
    -- Premium and VIP have unlimited AI processing
    v_ai_minutes_limit := -1;
    v_can_process := true;
  END IF;

  RETURN jsonb_build_object(
    'tier', v_tier,
    'can_record', v_storage_check->>'can_record',
    'can_process', v_can_process,
    'ai_minutes_used', v_ai_minutes_used,
    'ai_minutes_limit', v_ai_minutes_limit,
    'ai_minutes_remaining', CASE
      WHEN v_ai_minutes_limit = -1 THEN -1
      ELSE GREATEST(v_ai_minutes_limit - v_ai_minutes_used, 0)
    END,
    'storage_used', (v_storage_check->>'current_count')::INT,
    'storage_limit', (v_storage_check->>'max_recordings')::INT,
    'storage_remaining', (v_storage_check->>'remaining')::INT,
    'period_start', v_period_start
  );
END;
$$;

-- Update grant for new function
GRANT EXECUTE ON FUNCTION check_usage TO authenticated, anon;

COMMENT ON FUNCTION check_storage_limit IS 'Checks if user can store more recordings based on tier limits';
COMMENT ON FUNCTION check_usage IS 'Returns comprehensive usage info: AI processing minutes and storage limits';
