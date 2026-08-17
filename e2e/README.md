# E2E Tests — Playwright Test Suite

This directory contains end-to-end tests for the Choseno application using Playwright.

## Setup: One-time fixture seeding

Before running tests, you must seed the dev Supabase project with test fixture accounts. This is a **one-time setup per dev environment**.

### 1. Set the E2E test password

Edit `.env.local` (in the repo root) and add:
```
E2E_TEST_PASSWORD=your_secure_test_password
```

**Requirements:**
- Must be different from production passwords
- Use something strong enough for security but remember this is dev-only
- Used by `e2e/helpers.ts` (Playwright) and `sql/seed_e2e_users.sql` (Supabase seed)

### 2. Run the seed script

```bash
# Get your Supabase credentials:
# - Project ref: visible in Supabase dashboard URL
# - Database password: in Supabase project settings > Database

PGPASSWORD='<your_supabase_db_password>' psql \
  "postgresql://postgres@db.<project-ref>.supabase.co:5432/postgres" \
  -v e2e_password="$E2E_TEST_PASSWORD" \
  -f sql/seed_e2e_users.sql
```

The script is idempotent — safe to re-run if needed.

### 3. Verify fixture accounts

If the script succeeded, you'll see output listing the created accounts:
```
          email           |                  id
e2e.admin@choseno.test
e2e.politician1@choseno.test
e2e.politician2@choseno.test
e2e.citizen1@choseno.test
e2e.citizen2@choseno.test
```

## Running tests

Start the dev server in one terminal:
```bash
npm run dev
```

In another terminal, run Playwright:
```bash
# Interactive mode (recommended for development)
npx playwright test --ui

# Headless mode
npx playwright test

# Single test file
npx playwright test flow-a-election-and-engagement.spec.ts
```

## Fixture accounts

All test accounts are created with the password from `E2E_TEST_PASSWORD` and are pre-onboarded:

| Email | Role | Purpose |
|-------|------|---------|
| `e2e.admin@choseno.test` | Admin | Site administration |
| `e2e.politician1@choseno.test` | Politician | Self-nominated seat |
| `e2e.politician2@choseno.test` | Politician | Admin-added seat claiming |
| `e2e.citizen1@choseno.test` | Citizen | Posts, comments, support |
| `e2e.citizen2@choseno.test` | Citizen | Election admin self-nomination |

## Helper functions

See `helpers.ts` for utilities:
- `loginAs(page, who)` — Log in as a fixture account
- `adminCreateElectionWithSeat(page, electionName)` — Full admin flow for test setup
- `runTag()` — Generate unique suffixes to avoid data collisions
- `confirmDialog()` — Confirm destructive actions
- `expectVisibleText()` — Wait for text to appear

## Troubleshooting

**"E2E_TEST_PASSWORD env var is not set"**
- Copy `.env.local.example` to `.env.local`
- Add your test password to `E2E_TEST_PASSWORD`
- Restart your dev server

**"Could not connect to database"**
- Check your Supabase project ref and db password
- Verify you're connecting to the **dev** project, not production
- Check that `postgres` user has access to the `public` schema

**"Invalid password"**
- Run the seed script again with `-v e2e_password="..."` to update all accounts
- Must match what's in `.env.local`

**Tests time out or fail to log in**
- Verify fixtures were seeded correctly (`SELECT email FROM auth.users WHERE email LIKE 'e2e.%'`)
- Check that `.env.local` has the correct `E2E_TEST_PASSWORD`
- Restart the dev server to reload env vars
