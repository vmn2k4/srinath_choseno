# Supabase Configuration & Setup

Development and production setup for Supabase backend, migrations, RLS policies, and local development.

---

## Overview

Choseno uses Supabase (PostgreSQL + auth + storage) with:
- **Local dev**: `supabase` CLI with docker-compose (schema matches prod)
- **Production**: Supabase cloud project (managed hosted PostgreSQL)
- **Migrations**: Numbered `.sql` files in `supabase/migrations/`
- **RLS**: All tables protected by Postgres policies

---

## Local Development Setup

### Prerequisites

```bash
# Install Supabase CLI
npm install -g supabase

# Install Docker (required for local Postgres)
brew install docker-desktop  # macOS
# OR https://docs.docker.com/install for other OS

# Start Docker Desktop
```

### Initialize Local Project

```bash
cd /Users/vmn2k4/Coding/Choseno

# Start local Supabase stack (postgres, auth, storage, etc.)
supabase start

# Output:
# API URL: http://localhost:54321
# anon key: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
# service_role key: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### Connect Dev Server to Local DB

**`.env.local`** (create if missing):
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...  # From supabase start output
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...       # Service role key
```

```bash
npm run dev
# App now uses local Postgres
```

### Stop Local Stack

```bash
supabase stop
```

### Reset Local Database

```bash
supabase db reset
# ⚠️ Deletes all data and re-runs all migrations from scratch
```

---

## Migrations

**Adding an index?** Don't guess — trace the actual query first. See [CHOSENO_ARCHITECTURE_GUIDE.md §13.7](CHOSENO_ARCHITECTURE_GUIDE.md#137-index-only-what-a-traced-query-actually-needs) for the method and `supabase/migrations/20260818000003_support_and_wall_query_indexes.sql` / `20260818000004_feed_and_admin_query_indexes.sql` for worked examples — each one's comment names the exact service function and existing (or missing) index that motivated it, not just what column it's on.

### Creating a Migration

**1. Write SQL**:
```bash
supabase migration new create_my_table
# Creates: supabase/migrations/20260809120000_create_my_table.sql
```

**2. Edit the file**:
```sql
-- supabase/migrations/20260809120000_create_my_table.sql
CREATE TABLE my_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp DEFAULT NOW()
);

ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_read_own_rows" ON my_table
  FOR SELECT
  USING (
    (SELECT id FROM auth.users WHERE id = auth.uid())
  );
```

**3. Test locally**:
```bash
supabase db push
# Applies migrations to local Postgres
```

**4. Verify data**:
```bash
psql postgresql://postgres:postgres@localhost:54321/postgres -c "
  SELECT table_name FROM information_schema.tables WHERE table_schema='public';
"
```

**5. Commit migration file** (never edit after push; create a new one if you need changes).

### Rollback

**⚠️ Supabase doesn't support automatic rollbacks.**

If a migration breaks production:
1. Write a new migration file that reverts the change
2. Apply it
3. Example:
   ```sql
   -- supabase/migrations/20260809120001_revert_my_table.sql
   DROP TABLE IF EXISTS my_table;
   ```

**Never** edit or delete a migration file that's already been applied.

---

## Production Setup

### Create Supabase Project

1. Log in to [supabase.com](https://supabase.com)
2. Create new project (name, password, region)
3. Wait ~2 minutes for provisioning
4. Get connection details from **Project Settings → Database**

### Connect App to Production

```bash
# Get production keys
supabase projects list
supabase projects api-key --project-id {project-id}
```

**`.env.production.local`**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### Push Migrations to Production

```bash
supabase db push --project-id {project-id}
# Applies all local migrations to production
# ⚠️ Verify in staging first; this cannot be undone
```

### Backup Production Database

```bash
# Via Supabase dashboard: Project Settings → Backups → Download latest
# OR via CLI:
supabase projects download-backup {project-id} --destination ~/backups/
```

---

## Schema & RLS

### Row-Level Security (RLS)

**Every table storing user data should have RLS enabled**:

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Users see own posts + public posts
CREATE POLICY "users_see_own_and_public_posts" ON posts
  FOR SELECT
  USING (
    profile_id = auth.uid() OR public = true
  );

-- Users can only update own posts
CREATE POLICY "users_update_own_posts" ON posts
  FOR UPDATE
  USING (profile_id = auth.uid());

-- Admins bypass all policies (anon user can't be admin)
CREATE POLICY "admins_bypass" ON posts
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

**Debugging RLS**:
```bash
# Check if table has RLS enabled
psql postgresql://postgres:postgres@localhost:54321/postgres -c "
  SELECT tablename, rowsecurity
  FROM pg_tables
  WHERE tablename = 'posts';
"

# List all policies on a table
psql postgresql://postgres:postgres@localhost:54321/postgres -c "
  SELECT policyname, qual, with_check
  FROM pg_policies
  WHERE tablename = 'posts';
"
```

---

## Authentication

### Supabase Auth Providers (Email/Password)

**Default**: Email + password only.

**Config in Supabase dashboard**:
1. **Authentication → Providers → Email**
   - Enable email/password
   - (Optional) Enable email confirmation
   - (Optional) Turn on CAPTCHA

2. **Authentication → URL Configuration**
   - Redirect URLs: `http://localhost:3000/auth/callback` (dev), `https://choseno.com/auth/callback` (prod)
   - Site URL: `http://localhost:3000` (dev), `https://choseno.com` (prod)

### OAuth (Future)

When adding Google/GitHub login:

```bash
# In Supabase dashboard:
# 1. Go to Authentication → Providers → Google (or GitHub)
# 2. Paste OAuth credentials from Google/GitHub console
# 3. Supabase auto-generates callback URL
```

```ts
// In app:
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'http://localhost:3000/auth/callback' }
});
```

---

## Storage Buckets

### Configure Buckets

**Via Supabase dashboard**: Storage → Create new bucket

| Bucket | Privacy | Purpose |
|---|---|---|
| `avatars` | Public | User profile pictures |
| `video-uploads` | Public | Politician/candidate videos |
| `article-images` | Public | News article hero images |
| `boundary-uploads` | Private | Temp files during shapefile import |

### Bucket Policies

**Example: Public read, authenticated write**:
```sql
-- Create policy
INSERT INTO storage.buckets (id, name, public) VALUES
('avatars', 'avatars', true);

-- Public read
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated users can upload own avatar
CREATE POLICY "auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text  -- Own folder only
  );
```

---

## Database Statistics & Monitoring

### Check Query Performance

```bash
# Local dev
psql postgresql://postgres:postgres@localhost:54321/postgres -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  LIMIT 10;
"

# Production (via Supabase dashboard → Logs → Postgres)
```

### Slow Queries

**Enable query logging** (Supabase dashboard → Database):
```sql
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 sec
SELECT pg_reload_conf();
```

---

## Scaling & Performance

### Indexes

**Add indexes to frequently-filtered columns**:
```sql
-- Speed up "find all posts for a boundary"
CREATE INDEX idx_posts_boundary_id ON posts(boundary_id);

-- Composite index for common queries
CREATE INDEX idx_elections_open_by_boundary ON elections(boundary_id, status)
WHERE status = 'open';
```

**Check existing indexes**:
```bash
psql postgresql://postgres:postgres@localhost:54321/postgres -c "
  SELECT schemaname, tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename;
"
```

### Connection Pooling

**Use PgBouncer** (Supabase provides this in paid plans):
- Connection pool between app and DB
- Reduces per-request overhead
- Config: `supabase/config.toml`

---

## Secrets & Environment Variables

### .env Files (Never commit)

```bash
# .env.local (dev, local Supabase)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# .env.production.local (prod, cloud Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Safety**:
- Never log keys
- Rotate keys in Supabase dashboard if leaked
- Service role key should only be in backend code/server

---

## Related Files

- **Config**: [`supabase/config.toml`](../supabase/config.toml)
- **Migrations**: [`supabase/migrations/`](../supabase/migrations/)
- **Types**: [`src/lib/supabase/types.ts`](../src/lib/supabase/types.ts) (auto-generated from schema)
- **Clients**:
  - [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) (browser)
  - [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) (server)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Error: password authentication failed` | Check `.env.local` has correct local Postgres credentials |
| `Database is locked` | Another process is accessing it; try `supabase stop && supabase start` |
| `Migrations not applying` | Run `supabase db push` explicitly; check SQL syntax with `supabase db lint` |
| `RLS blocking queries` | Debug policy with `SET log_statement = 'all'` and check actual user ID |

---

## Future Enhancements

- [ ] **Realtime subscriptions**: Postgres LISTEN/NOTIFY for live feeds
- [ ] **Full-text search**: PostgreSQL full-text index on posts/comments
- [ ] **Geospatial queries**: PostGIS for boundary point-in-polygon lookups
- [ ] **Read replicas**: Separate read pool for analytics queries
- [ ] **Compliance**: Automated backups, GDPR data export RPC
