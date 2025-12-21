# WiseKeep Setup Guide

This guide covers setting up WiseKeep with Supabase backend for authentication, storage, and transcription/summarization.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   WiseKeep App                          │
│              (React Native / Expo)                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Backend                       │
├─────────────────────────────────────────────────────────┤
│  Auth (Anonymous)  │  Storage  │  Database  │  Edge Fn  │
│                    │  (Audio)  │  (Users,   │  (Groq    │
│                    │           │  Records)  │   API)    │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │   Groq API    │
              │  (Whisper +   │
              │    Llama)     │
              └───────────────┘
```

## Prerequisites

1. Node.js 18+ and npm
2. A Supabase account (https://supabase.com)
3. A Groq API key (https://console.groq.com)

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - Name: `wisekeep` (or your preferred name)
   - Database Password: Generate a strong password (save this!)
   - Region: Choose closest to your users
5. Click "Create new project" and wait for setup

---

## Step 2: Run Database Migrations

### Option A: Via Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### Option B: Via Dashboard SQL Editor

1. Go to SQL Editor in Supabase Dashboard
2. Copy and run each migration file in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_user_system.sql`
   - `supabase/migrations/003_storage_bucket.sql`

---

## Step 3: Configure Storage Bucket

1. Go to Storage in Supabase Dashboard
2. Click "New Bucket"
3. Configure:
   - Name: `recordings`
   - Public bucket: **OFF** (unchecked)
   - File size limit: `524288000` (500MB)
   - Allowed MIME types: `audio/webm, audio/mp4, audio/mpeg, audio/wav`
4. Click "Create bucket"

---

## Step 4: Enable Anonymous Auth

1. Go to Authentication > Providers in Supabase Dashboard
2. Find "Anonymous Sign-ins"
3. Enable it

---

## Step 5: Set Up Edge Function Secrets

```bash
# Set the Groq API key as a secret
supabase secrets set GROQ_API_KEY=your_groq_api_key_here
```

---

## Step 6: Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy process-recording
supabase functions deploy check-usage
supabase functions deploy redeem-code
supabase functions deploy get-config
```

---

## Step 7: Configure App Environment

1. Copy the example env file:
```bash
cp .env.example .env
```

2. Get your Supabase credentials from Dashboard > Settings > API:
   - Project URL
   - anon public key

3. Edit `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## Step 8: Create Invite Codes for Family/Friends

Run this SQL in Supabase SQL Editor to create invite codes:

```sql
-- Create invite codes for your family/friends
INSERT INTO invite_codes (code, label, max_uses, is_active) VALUES
('GRANDMA-2024', 'For Grandma', 1, true),
('UNCLE-JOHN', 'For Uncle John', 1, true),
('FAMILY-2024', 'General family code', 10, true);
```

---

## Running the App

```bash
# Install dependencies
npm install

# Start development server
npm run web      # For web
npm run ios      # For iOS
npm run android  # For Android
```

---

## Pricing Tiers

The app has three tiers:

| Tier | Monthly Cost | Recording Limit |
|------|--------------|-----------------|
| **Free** | $0 | 30 min/month |
| **VIP** | $0 (invite code) | Unlimited |
| **Premium** | NT$149/month | Unlimited |

### Adjusting Limits

Update limits without code changes via SQL:

```sql
-- Change free tier limit to 60 minutes
UPDATE app_config SET value = '60' WHERE key = 'free_tier_minutes';

-- Change premium monthly price
UPDATE app_config SET value = '199' WHERE key = 'premium_monthly_price_twd';
```

---

## Security Notes

- ✅ Groq API key is stored server-side in Edge Functions
- ✅ Anonymous auth provides user isolation without login friction
- ✅ RLS policies ensure users can only access their own data
- ✅ Storage bucket is private with signed URLs
- ⚠️ Never expose `service_role` key in client code
- ⚠️ `.env` is gitignored - never commit it

---

## Troubleshooting

### "Auth initialization error"
- Check Supabase URL and anon key in `.env`
- Ensure Anonymous auth is enabled in Supabase

### "Failed to upload audio"
- Verify storage bucket `recordings` exists
- Check RLS policies are applied

### "Processing failed"
- Check Edge Function logs in Supabase Dashboard
- Verify GROQ_API_KEY secret is set

### "Usage limit exceeded"
- User has hit their free tier limit
- They need to wait for period reset or upgrade/use invite code

---

## For Production (EAS Build)

Set environment variables for production builds:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_anon_key_here
```
