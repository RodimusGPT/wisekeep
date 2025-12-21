-- Fix ambiguous column reference in check_usage_limit function
-- The period_type column needs to be qualified with table name

CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID)
RETURNS TABLE (
    allowed BOOLEAN,
    tier TEXT,
    minutes_used NUMERIC,
    minutes_limit NUMERIC,
    period_type TEXT
) AS $$
DECLARE
    v_user users%ROWTYPE;
    v_free_tier_minutes NUMERIC;
    v_free_tier_period TEXT;
    v_period_start DATE;
    v_minutes_used NUMERIC;
BEGIN
    -- Get user info
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    -- VIP and Premium users have unlimited access
    IF v_user.tier IN ('vip', 'premium') THEN
        RETURN QUERY SELECT
            true::BOOLEAN,
            v_user.tier,
            0::NUMERIC,
            -1::NUMERIC, -- -1 indicates unlimited
            'unlimited'::TEXT;
        RETURN;
    END IF;

    -- Get config values
    SELECT (value)::NUMERIC INTO v_free_tier_minutes
    FROM app_config WHERE key = 'free_tier_minutes';

    SELECT value::TEXT INTO v_free_tier_period
    FROM app_config WHERE key = 'free_tier_period';
    -- Remove quotes from JSON string
    v_free_tier_period := TRIM(BOTH '"' FROM v_free_tier_period);

    -- Get period start
    v_period_start := get_period_start(v_free_tier_period);

    -- Get current usage (FIX: Qualify column names to avoid ambiguity)
    SELECT COALESCE(minutes_recorded, 0) INTO v_minutes_used
    FROM usage
    WHERE usage.user_id = p_user_id
    AND usage.period_start = v_period_start
    AND usage.period_type = v_free_tier_period;

    IF v_minutes_used IS NULL THEN
        v_minutes_used := 0;
    END IF;

    RETURN QUERY SELECT
        (v_minutes_used < v_free_tier_minutes)::BOOLEAN,
        v_user.tier,
        v_minutes_used,
        v_free_tier_minutes,
        v_free_tier_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_usage_limit IS 'Checks if a user has exceeded their free tier limit (fixed ambiguous column reference)';
