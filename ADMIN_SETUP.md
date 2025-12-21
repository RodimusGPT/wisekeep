# Admin Panel Setup Guide

## Overview

The WiseKeep admin panel is a **web-only** interface for managing user VIP access. It's completely excluded from iOS and Android builds for security.

## Security Features

- ✅ **Platform-restricted**: `.web.tsx` extension excludes from mobile builds
- ✅ **Supabase Auth**: Requires email/password authentication
- ✅ **Encrypted connection**: Only works over HTTPS in production
- ✅ **Database-level security**: Admin key verified server-side

## Setup Instructions

### 1. Run Database Migration

Execute the support codes migration in Supabase SQL Editor:

```sql
-- Located in: supabase/migrations/005_support_codes.sql
-- Run the entire file in Supabase dashboard > SQL Editor
```

This creates:
- `support_code` column on users table
- Auto-generation trigger for new users
- `lookup_user_by_support_code()` function
- `admin_set_user_tier()` function

### 2. Set Admin Key in Supabase

The admin key is stored as a Supabase database setting:

```sql
ALTER DATABASE postgres SET "app.admin_key" = 'your_secret_admin_key_here';
```

**Important**:
- Use a strong, random key (e.g., generate with `openssl rand -base64 32`)
- Keep this secret - it's required to modify user tiers
- Store it securely (password manager)

### 3. Create Admin User in Supabase Auth

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add user" > "Create new user"
3. Enter:
   - **Email**: your admin email (e.g., admin@wisekeep.com)
   - **Password**: strong password
   - Confirm email: ✓ (auto-confirm)
4. Click "Create user"

### 4. Deploy Web App

Your web app must be deployed to access the admin panel. The route `/admin` will be available at:

```
https://yourapp.com/admin
```

For local testing:
```bash
npx expo start --web
# Then navigate to: http://localhost:8081/admin
```

## How to Use

### Accessing the Admin Panel

1. Navigate to `https://yourapp.com/admin` in a web browser
2. Login with your Supabase Auth credentials (email/password)
3. You're now in the admin panel

### Managing Users

1. **Get Support Code from User**
   - User opens Settings in the mobile app
   - Support code is displayed at bottom of subscription card
   - Format: `WK-XXXX` (e.g., `WK-7X3M`)
   - User can tap to copy and send to you

2. **Look Up User**
   - Enter support code in search box
   - Click search button
   - User details appear

3. **Grant/Revoke VIP Access**
   - Enter your admin key (the one you set in step 2)
   - Click the desired tier button:
     - **FREE**: 30 min/month limit
     - **PREMIUM**: Unlimited (via RevenueCat purchase)
     - **VIP**: Unlimited (manual grant)
   - Confirmation alert appears
   - User's tier updates immediately

### User Details Displayed

- Support Code
- Current Tier (FREE/PREMIUM/VIP)
- Usage: X.X / Y minutes
- Period Type (monthly/unlimited)
- Account Creation Date
- User ID (UUID)

## Security Best Practices

### Protecting Admin Access

1. **Strong Credentials**
   - Use a unique password for admin account
   - Enable 2FA in Supabase if available
   - Rotate passwords regularly

2. **Admin Key Management**
   - Never commit admin key to git
   - Store in password manager
   - Rotate periodically
   - Only share with trusted administrators

3. **Access Logging**
   - Monitor Supabase Auth logs for admin logins
   - Check for unusual access patterns
   - Review user tier changes periodically

4. **Network Security** (Production)
   - Serve over HTTPS only
   - Consider IP whitelisting at hosting level
   - Use Supabase Row Level Security (RLS) policies

### Hosting Considerations

For production deployment:

```bash
# Example: Deploy to Vercel
npx expo export:web
# Deploy the web-build directory

# Or use EAS:
eas build --platform web
```

The admin panel will be accessible at:
- `https://yourapp.vercel.app/admin`
- `https://yourapp.com/admin` (with custom domain)

## Troubleshooting

### "Invalid admin key" Error

- Verify admin key in database:
  ```sql
  SELECT current_setting('app.admin_key', true);
  ```
- Make sure you set it with `ALTER DATABASE` (not `ALTER USER`)
- Check for typos when entering the key

### Login Failed

- Verify user exists in Supabase Auth
- Check email is confirmed
- Try password reset if needed
- Check Supabase Auth logs for errors

### User Not Found

- Verify support code format: `WK-XXXX`
- Check if migration ran successfully:
  ```sql
  SELECT support_code FROM users LIMIT 5;
  ```
- Ensure user exists in database

### Admin Panel Not Loading

- Confirm web app is deployed
- Check browser console for errors
- Verify `/admin` route exists (`.web.tsx` file)
- Clear browser cache and try again

## API Reference

### Database Functions

#### `lookup_user_by_support_code(p_support_code TEXT)`

Returns user details by support code.

**Returns:**
```sql
{
  id: UUID,
  device_id: TEXT,
  tier: TEXT,
  support_code: TEXT,
  created_at: TIMESTAMPTZ,
  minutes_used: NUMERIC,
  minutes_limit: INT,
  period_type: TEXT
}
```

#### `admin_set_user_tier(p_support_code TEXT, p_tier TEXT, p_admin_key TEXT)`

Updates user tier with admin key verification.

**Parameters:**
- `p_support_code`: User's support code (e.g., 'WK-7X3M')
- `p_tier`: New tier ('free', 'premium', or 'vip')
- `p_admin_key`: Admin authentication key

**Returns:**
```json
{
  "success": true/false,
  "message": "User tier updated to vip",
  "user_id": "uuid"
}
```

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Supabase logs
3. Contact development team
