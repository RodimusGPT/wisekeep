-- WiseKeep User System Migration
-- Adds users, invite codes, usage tracking, and app configuration

-- ============================================
-- APP CONFIGURATION TABLE
-- Stores all configurable values for easy updates without code changes
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default configuration values
INSERT INTO app_config (key, value, description) VALUES
    -- Free tier settings
    ('free_tier_minutes', '30', 'Free tier: minutes of recording allowed per period'),
    ('free_tier_period', '"monthly"', 'Free tier: period for limit reset (daily, weekly, monthly)'),

    -- Premium tier settings (prices in TWD)
    ('premium_monthly_price_twd', '149', 'Premium monthly subscription price in TWD'),
    ('premium_yearly_price_twd', '1490', 'Premium yearly subscription price in TWD'),
    ('premium_yearly_savings_twd', '298', 'Amount saved with yearly subscription in TWD'),

    -- Feature flags
    ('allow_anonymous_recording', 'true', 'Whether anonymous users can record'),
    ('auto_transcribe', 'true', 'Whether to automatically transcribe recordings'),
    ('auto_summarize', 'true', 'Whether to automatically summarize transcriptions'),

    -- Limits
    ('max_recording_duration_minutes', '180', 'Maximum single recording duration in minutes (3 hours)'),
    ('max_audio_file_size_mb', '500', 'Maximum audio file size in MB')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- USERS TABLE
-- Supports anonymous auth with optional upgrade paths
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Device/Auth identification
    device_id TEXT UNIQUE, -- For anonymous users (legacy support)
    auth_user_id UUID UNIQUE, -- Supabase Auth user ID (for authenticated users)

    -- User tier
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'vip', 'premium')),

    -- VIP info (if applicable)
    invite_code_used TEXT, -- The invite code that made them VIP
    vip_granted_at TIMESTAMP WITH TIME ZONE,
    vip_granted_by TEXT, -- Who granted VIP (for audit)

    -- Premium subscription info (if applicable)
    subscription_status TEXT CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trial')),
    subscription_platform TEXT CHECK (subscription_platform IN ('ios', 'android', 'web')),
    subscription_product_id TEXT, -- App Store/Play Store product ID
    subscription_expires_at TIMESTAMP WITH TIME ZONE,

    -- User preferences (synced across devices if authenticated)
    preferences JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- INVITE CODES TABLE
-- For granting VIP access to family/friends
-- ============================================
CREATE TABLE IF NOT EXISTS invite_codes (
    code TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Code metadata
    label TEXT, -- Friendly name like "Grandma", "Uncle John"
    description TEXT, -- Optional notes

    -- Usage limits
    max_uses INTEGER DEFAULT 1, -- How many times this code can be used
    current_uses INTEGER DEFAULT 0, -- How many times it has been used

    -- Status
    is_active BOOLEAN DEFAULT true, -- Can be deactivated without deleting
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration date

    -- Audit
    created_by TEXT -- Who created this code
);

-- ============================================
-- USAGE TRACKING TABLE
-- Tracks recording minutes per user per period
-- ============================================
CREATE TABLE IF NOT EXISTS usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Period tracking
    period_start DATE NOT NULL, -- First day of the tracking period
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),

    -- Usage metrics
    minutes_recorded NUMERIC(10, 2) DEFAULT 0, -- Total minutes recorded this period
    minutes_transcribed NUMERIC(10, 2) DEFAULT 0, -- Total minutes transcribed this period
    recording_count INTEGER DEFAULT 0, -- Number of recordings this period

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),

    -- Ensure one record per user per period
    UNIQUE(user_id, period_start, period_type)
);

-- ============================================
-- UPDATE RECORDINGS TABLE
-- Add user_id reference and label field
-- ============================================
ALTER TABLE recordings
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS label TEXT; -- User-defined label for easy identification

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_active ON invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage(user_id, period_start);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;

-- App config: readable by all, writable by none (admin only via service role)
CREATE POLICY "Allow public read app_config" ON app_config
    FOR SELECT USING (true);

-- Users: users can read/update their own record
CREATE POLICY "Allow users to read own profile" ON users
    FOR SELECT USING (
        auth.uid() = auth_user_id
        OR device_id = current_setting('app.device_id', true)
    );

CREATE POLICY "Allow users to update own profile" ON users
    FOR UPDATE USING (
        auth.uid() = auth_user_id
        OR device_id = current_setting('app.device_id', true)
    );

-- Allow creating new users (for anonymous sign-up)
CREATE POLICY "Allow insert users" ON users
    FOR INSERT WITH CHECK (true);

-- Invite codes: readable by all (to validate), but not the sensitive fields
CREATE POLICY "Allow public read invite_codes" ON invite_codes
    FOR SELECT USING (true);

-- Usage: users can only see their own usage
CREATE POLICY "Allow users to read own usage" ON usage
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth.uid() = auth_user_id
            OR device_id = current_setting('app.device_id', true)
        )
    );

CREATE POLICY "Allow insert usage" ON usage
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update usage" ON usage
    FOR UPDATE USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth.uid() = auth_user_id
            OR device_id = current_setting('app.device_id', true)
        )
    );

-- Update recordings RLS to use user_id
DROP POLICY IF EXISTS "Allow read own recordings" ON recordings;
CREATE POLICY "Allow read own recordings" ON recordings
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth.uid() = auth_user_id
            OR device_id = current_setting('app.device_id', true)
        )
        OR device_id = current_setting('app.device_id', true) -- Legacy support
    );

DROP POLICY IF EXISTS "Allow update own recordings" ON recordings;
CREATE POLICY "Allow update own recordings" ON recordings
    FOR UPDATE USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth.uid() = auth_user_id
            OR device_id = current_setting('app.device_id', true)
        )
        OR device_id = current_setting('app.device_id', true)
    );

DROP POLICY IF EXISTS "Allow delete own recordings" ON recordings;
CREATE POLICY "Allow delete own recordings" ON recordings
    FOR DELETE USING (
        user_id IN (
            SELECT id FROM users
            WHERE auth.uid() = auth_user_id
            OR device_id = current_setting('app.device_id', true)
        )
        OR device_id = current_setting('app.device_id', true)
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get current period start date based on period type
CREATE OR REPLACE FUNCTION get_period_start(period_type TEXT)
RETURNS DATE AS $$
BEGIN
    CASE period_type
        WHEN 'daily' THEN
            RETURN CURRENT_DATE;
        WHEN 'weekly' THEN
            RETURN DATE_TRUNC('week', CURRENT_DATE)::DATE;
        WHEN 'monthly' THEN
            RETURN DATE_TRUNC('month', CURRENT_DATE)::DATE;
        ELSE
            RETURN DATE_TRUNC('month', CURRENT_DATE)::DATE;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if user has exceeded their limit
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

    -- Get current usage
    SELECT COALESCE(minutes_recorded, 0) INTO v_minutes_used
    FROM usage
    WHERE user_id = p_user_id
    AND period_start = v_period_start
    AND period_type = v_free_tier_period;

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

-- Function to redeem an invite code
CREATE OR REPLACE FUNCTION redeem_invite_code(p_user_id UUID, p_code TEXT)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_invite invite_codes%ROWTYPE;
    v_user users%ROWTYPE;
BEGIN
    -- Check if code exists and is valid
    SELECT * INTO v_invite FROM invite_codes WHERE code = p_code;

    IF v_invite IS NULL THEN
        RETURN QUERY SELECT false, 'Invalid invite code';
        RETURN;
    END IF;

    IF NOT v_invite.is_active THEN
        RETURN QUERY SELECT false, 'This invite code is no longer active';
        RETURN;
    END IF;

    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 'This invite code has expired';
        RETURN;
    END IF;

    IF v_invite.current_uses >= v_invite.max_uses THEN
        RETURN QUERY SELECT false, 'This invite code has reached its usage limit';
        RETURN;
    END IF;

    -- Check if user already used a code
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    IF v_user.tier = 'vip' THEN
        RETURN QUERY SELECT false, 'You already have VIP access';
        RETURN;
    END IF;

    -- Update user to VIP
    UPDATE users SET
        tier = 'vip',
        invite_code_used = p_code,
        vip_granted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Increment code usage
    UPDATE invite_codes SET
        current_uses = current_uses + 1
    WHERE code = p_code;

    RETURN QUERY SELECT true, 'VIP access granted successfully!';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update usage after recording
CREATE OR REPLACE FUNCTION update_usage(p_user_id UUID, p_minutes NUMERIC)
RETURNS VOID AS $$
DECLARE
    v_period_type TEXT;
    v_period_start DATE;
BEGIN
    -- Get period type from config
    SELECT TRIM(BOTH '"' FROM value::TEXT) INTO v_period_type
    FROM app_config WHERE key = 'free_tier_period';

    v_period_start := get_period_start(v_period_type);

    -- Upsert usage record
    INSERT INTO usage (user_id, period_start, period_type, minutes_recorded, recording_count)
    VALUES (p_user_id, v_period_start, v_period_type, p_minutes, 1)
    ON CONFLICT (user_id, period_start, period_type)
    DO UPDATE SET
        minutes_recorded = usage.minutes_recorded + p_minutes,
        recording_count = usage.recording_count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at on users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on app_config
CREATE TRIGGER update_app_config_updated_at
    BEFORE UPDATE ON app_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE app_config IS 'Configurable app settings that can be changed without code updates';
COMMENT ON TABLE users IS 'User accounts with support for anonymous, VIP, and premium tiers';
COMMENT ON TABLE invite_codes IS 'Invite codes for granting VIP access to family and friends';
COMMENT ON TABLE usage IS 'Tracks recording usage per user per time period';
COMMENT ON FUNCTION check_usage_limit IS 'Checks if a user has exceeded their free tier limit';
COMMENT ON FUNCTION redeem_invite_code IS 'Redeems an invite code and grants VIP access';
COMMENT ON FUNCTION update_usage IS 'Updates usage tracking after a recording';
