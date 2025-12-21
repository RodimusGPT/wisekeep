-- Migration: Grant execute permissions on admin functions
-- The admin functions were created without GRANT statements,
-- so authenticated users (including admins) couldn't execute them

-- Grant execute permission on lookup function to authenticated users
GRANT EXECUTE ON FUNCTION lookup_user_by_support_code(TEXT) TO authenticated;

-- Grant execute permission on admin_set_user_tier to authenticated users
GRANT EXECUTE ON FUNCTION admin_set_user_tier(TEXT, TEXT, TEXT) TO authenticated;

-- Note: These functions use SECURITY DEFINER so they run with elevated privileges
-- but the caller still needs EXECUTE permission to call them
