-- =============================================
-- Support Code System for Admin Management
-- =============================================
-- Adds support codes to users for easy lookup by admins
-- Format: WK-XXXX (e.g., WK-7X3M)

-- Add support_code column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS support_code TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_support_code ON users(support_code);

-- Function to generate support code from UUID
-- Uses same algorithm as client-side for consistency
CREATE OR REPLACE FUNCTION generate_support_code(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  clean_id TEXT;
  hash_val BIGINT := 0;
  char_code INT;
  i INT;
  code TEXT := '';
  code_length INT := 4;
BEGIN
  -- Remove hyphens and convert to lowercase
  clean_id := LOWER(REPLACE(user_uuid::TEXT, '-', ''));

  -- Create hash from UUID (same algorithm as JS)
  FOR i IN 1..LENGTH(clean_id) LOOP
    char_code := ASCII(SUBSTRING(clean_id FROM i FOR 1));
    hash_val := ((hash_val * 31) + char_code) & 2147483647; -- Keep as 32-bit
  END LOOP;

  -- Make hash positive
  hash_val := ABS(hash_val);

  -- Convert hash to alphabet
  FOR i IN 1..code_length LOOP
    code := code || SUBSTRING(alphabet FROM (hash_val % 29) + 1 FOR 1);
    hash_val := hash_val / 29;
  END LOOP;

  RETURN 'WK-' || code;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-generate support code on user creation
CREATE OR REPLACE FUNCTION set_user_support_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.support_code IS NULL THEN
    NEW.support_code := generate_support_code(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_support_code ON users;
CREATE TRIGGER trigger_set_support_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_user_support_code();

-- Update existing users with support codes
UPDATE users
SET support_code = generate_support_code(id)
WHERE support_code IS NULL;

-- =============================================
-- Admin Functions
-- =============================================

-- Function to look up user by support code
CREATE OR REPLACE FUNCTION lookup_user_by_support_code(p_support_code TEXT)
RETURNS TABLE (
  id UUID,
  device_id TEXT,
  tier TEXT,
  support_code TEXT,
  created_at TIMESTAMPTZ,
  minutes_used NUMERIC,
  minutes_limit INT,
  period_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.device_id,
    u.tier,
    u.support_code,
    u.created_at,
    COALESCE(uu.minutes_used, 0) as minutes_used,
    COALESCE(uu.minutes_limit, 30) as minutes_limit,
    COALESCE(uu.period_type, 'monthly') as period_type
  FROM users u
  LEFT JOIN user_usage uu ON u.id = uu.user_id
  WHERE UPPER(u.support_code) = UPPER(p_support_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set user tier (for admin use)
CREATE OR REPLACE FUNCTION admin_set_user_tier(
  p_support_code TEXT,
  p_tier TEXT,
  p_admin_key TEXT
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_expected_key TEXT;
BEGIN
  -- Simple admin key check (set this in Supabase secrets)
  v_expected_key := current_setting('app.admin_key', true);

  IF v_expected_key IS NULL OR p_admin_key != v_expected_key THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid admin key'
    );
  END IF;

  -- Validate tier
  IF p_tier NOT IN ('free', 'premium', 'vip') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid tier. Must be: free, premium, or vip'
    );
  END IF;

  -- Find user by support code
  SELECT id INTO v_user_id
  FROM users
  WHERE UPPER(support_code) = UPPER(p_support_code);

  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User not found with support code: ' || p_support_code
    );
  END IF;

  -- Update user tier
  UPDATE users SET tier = p_tier WHERE id = v_user_id;

  -- If setting to VIP/premium, update usage to unlimited
  IF p_tier IN ('vip', 'premium') THEN
    UPDATE user_usage
    SET minutes_limit = 999999,
        period_type = 'unlimited'
    WHERE user_id = v_user_id;
  ELSE
    -- Reset to free tier limits
    UPDATE user_usage
    SET minutes_limit = 30,
        period_type = 'monthly'
    WHERE user_id = v_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'User tier updated to ' || p_tier,
    'user_id', v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
