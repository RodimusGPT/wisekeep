-- Migration: Create get_or_create_user function
-- This function handles the case where a user's anonymous session changes
-- but their device remains the same. It bypasses RLS to allow session recovery.

-- Function to get or create user by auth_user_id and device_id
-- Uses SECURITY DEFINER to bypass RLS for this specific operation
CREATE OR REPLACE FUNCTION get_or_create_user(
  p_auth_user_id UUID,
  p_device_id TEXT
)
RETURNS TABLE (
  id UUID,
  auth_user_id UUID,
  device_id TEXT,
  tier TEXT,
  invite_code_used TEXT,
  subscription_status TEXT,
  subscription_expires_at TIMESTAMPTZ,
  support_code TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- First, try to find user by auth_user_id
  SELECT * INTO v_user FROM users u WHERE u.auth_user_id = p_auth_user_id LIMIT 1;

  IF FOUND THEN
    -- User found by auth_user_id, return it
    RETURN QUERY SELECT
      v_user.id,
      v_user.auth_user_id,
      v_user.device_id,
      v_user.tier,
      v_user.invite_code_used,
      v_user.subscription_status,
      v_user.subscription_expires_at,
      v_user.support_code,
      v_user.created_at,
      v_user.updated_at;
    RETURN;
  END IF;

  -- Not found by auth_user_id, try to find by device_id
  SELECT * INTO v_user FROM users u WHERE u.device_id = p_device_id LIMIT 1;

  IF FOUND THEN
    -- Found by device_id - update auth_user_id to link to new session
    UPDATE users SET
      auth_user_id = p_auth_user_id,
      updated_at = NOW()
    WHERE users.id = v_user.id;

    -- Return the updated user
    RETURN QUERY SELECT
      v_user.id,
      p_auth_user_id,  -- Return the new auth_user_id
      v_user.device_id,
      v_user.tier,
      v_user.invite_code_used,
      v_user.subscription_status,
      v_user.subscription_expires_at,
      v_user.support_code,
      v_user.created_at,
      NOW();  -- Updated timestamp
    RETURN;
  END IF;

  -- Not found at all - create new user
  INSERT INTO users (auth_user_id, device_id, tier)
  VALUES (p_auth_user_id, p_device_id, 'free')
  RETURNING * INTO v_user;

  RETURN QUERY SELECT
    v_user.id,
    v_user.auth_user_id,
    v_user.device_id,
    v_user.tier,
    v_user.invite_code_used,
    v_user.subscription_status,
    v_user.subscription_expires_at,
    v_user.support_code,
    v_user.created_at,
    v_user.updated_at;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_or_create_user(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user(UUID, TEXT) TO anon;
