# Admin Panel Quick Start

## ✅ What You Need to Do

### 1. Apply Database Migration (Required)

Open Supabase Dashboard > SQL Editor and run:

```bash
# File: supabase/migrations/005_support_codes.sql
```

Copy-paste the entire file contents and execute.

### 2. Set Admin Key (Required)

In Supabase SQL Editor:

```sql
ALTER DATABASE postgres SET "app.admin_key" = 'PUT_YOUR_SECRET_KEY_HERE';
```

💡 Generate a strong key:
```bash
# On Mac/Linux:
openssl rand -base64 32

# Or use any password generator
```

**Save this key** - you'll need it to grant VIP access.

### 3. Create Admin Account (Required)

Supabase Dashboard > Authentication > Users > Add User

- Email: admin@yourcompany.com
- Password: (strong password)
- Auto-confirm email: ✓

### 4. Access Admin Panel

**Local Development:**
```bash
npx expo start --web
# Go to: http://localhost:8081/admin
```

**Production:**
```
https://yourapp.com/admin
```

## 🎯 How It Works

1. **User calls you**: "I want VIP access"
2. **User gives you their support code**: `WK-7X3M` (from Settings)
3. **You login**: Go to `/admin`, enter email/password
4. **Search user**: Enter `WK-7X3M`
5. **Grant VIP**: Enter admin key, click VIP button
6. **Done**: User now has unlimited access

## 🔒 Security

- ✅ Web-only (not in iOS/Android apps)
- ✅ Requires email/password login
- ✅ Admin key verified server-side
- ✅ All changes logged in database

## 📱 Support Code Location

Users see their support code at the bottom of Settings screen in the subscription card. They can tap it to copy.

---

See `ADMIN_SETUP.md` for detailed documentation.
