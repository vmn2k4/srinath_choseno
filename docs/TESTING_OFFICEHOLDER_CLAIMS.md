# Testing Officeholder Wall Claims — Practical Guide

This guide walks through testing the complete officeholder wall claim system using the Supabase API, mailsac test accounts, and curl commands. All examples use real IDs from the dev database.

## Prerequisites

### Environment Setup

```bash
# Supabase dev project
export SUPABASE_URL="https://qlzyfdwrkcxyqapewxwg.supabase.co"
export ANON_KEY="sb_publishable_m7I392hi0eurPIRFrr6IZQ_VOQa7EzK"
export SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsenlmZHdya2N4eXFhcGV3eHdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1MDcxNiwiZXhwIjoyMTAwMjI2NzE2fQ.iVpmzqXYhNiMihTI1CAuuo4RjXhtqUbMcwM-yMcPDU4"

# Admin account
export ADMIN_EMAIL="vmn2k4@gmail.com"
export ADMIN_PASSWORD="Happy@123"

# Mailsac test accounts (from .env.local)
export TEST_EMAIL_1="chosenovoter1@mailsac.com"
export TEST_PASSWORD_1="TestVoter_Pass!2024"
export TEST_EMAIL_2="chosenovoter2@mailsac.com"
export TEST_PASSWORD_2="TestVoter_Pass!2024"
export TEST_EMAIL_3="chosenovoter3@mailsac.com"
export TEST_PASSWORD_3="TestVoter3Pass!2024"
```

### Database Connection

```bash
export PGHOST="db.qlzyfdwrkcxyqapewxwg.supabase.co"
export PGUSER="postgres"
export PGPASSWORD="pa.8tX5+Hh/GZn2"
export PGDATABASE="postgres"

# Quick test
psql -c "select 1 as connected"
```

### Mailsac Access

- View inbox: `https://mailsac.com/inbox/<email-address>`
- API (no auth): `https://mailsac.com/api/addresses/<email-address>/messages`

## Test Flow 1: Admin-Initiated Invite → Auto-Merge

This tests the primary flow: admin sends invite → claimant redeems → wall auto-merges (no manual approval needed).

### Step 1: Get Admin Auth Token

```bash
ADMIN_TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | jq -r '.access_token')

echo "Admin token: ${ADMIN_TOKEN:0:20}..."
```

### Step 2: Find an Unclaimed Officeholder

```bash
psql << 'EOF'
-- Find officeholders with no open claims
SELECT oh.id, oh.full_name, ert.role_title, ms.name
FROM public.office_holders oh
LEFT JOIN public.election_role_types ert ON ert.id = oh.election_role_type_id
LEFT JOIN public.map_shapes ms ON ms.id = oh.map_shape_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_holder_wall_claims c
  WHERE c.office_holder_id = oh.id
    AND c.status IN ('draft', 'invited', 'pending_confirmation', 'pending_review', 'approved')
)
LIMIT 5;
EOF

# Example output:
# f873ea5d-51a0-4231-b0ab-6d94149451d4 | Laxman Savadi | MLA | Athani
```

### Step 3: Generate Invite Token and Hash

```bash
# Generate a random 32-byte hex string
TOKEN=$(openssl rand -hex 32)

# Hash it with SHA-256
TOKEN_HASH=$(echo -n "$TOKEN" | sha256sum | cut -d' ' -f1)

echo "Token: $TOKEN"
echo "Hash: $TOKEN_HASH"

# Save for later use:
export CLAIM_TOKEN="$TOKEN"
export CLAIM_TOKEN_HASH="$TOKEN_HASH"
export OFFICEHOLDER_ID="f873ea5d-51a0-4231-b0ab-6d94149451d4"
export TEST_EMAIL="$TEST_EMAIL_1"
```

### Step 4: Create Admin Invite (create_officeholder_wall_claim)

```bash
INVITE_RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/create_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_office_holder_id\": \"$OFFICEHOLDER_ID\",
    \"p_email\": \"$TEST_EMAIL\",
    \"p_token_hash\": \"$CLAIM_TOKEN_HASH\"
  }")

echo "$INVITE_RESULT" | jq .

CLAIM_ID=$(echo "$INVITE_RESULT" | jq -r '.[0].claim_id')
INVITE_ID=$(echo "$INVITE_RESULT" | jq -r '.[0].invite_id')

echo "Claim ID: $CLAIM_ID"
echo "Invite ID: $INVITE_ID"
```

**Expected response:**
```json
[
  {
    "claim_id": "d564a8d3-489f-4597-9cf1-4edd2f1e3da0",
    "invite_id": "a0bf80dc-a466-410a-9e9b-f5a3238cc9ef",
    "office_holder_id": "f873ea5d-51a0-4231-b0ab-6d94149451d4",
    "source_profile_id": "4d092d47-bc7c-4e06-a8b4-342929803e3b",
    "source_ghost_id": "6cf81ca5-6838-4279-bbde-4d4efb91cfa8",
    "expires_at": "2026-08-19T03:42:26.632295+00:00"
  }
]
```

### Step 5: Verify Claim Status Before Redemption

```bash
psql << EOF
SELECT id, status, target_profile_id, claimed_at, approved_at
FROM public.office_holder_wall_claims
WHERE id = '$CLAIM_ID';
EOF

# Expected: status = 'invited', target_profile_id = NULL, claimed_at = NULL
```

### Step 6: Get Test Account Auth Token

```bash
# This account already exists and is email-confirmed (see docs/TEST_ACCOUNTS.md)
TEST_TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD_1\"}" \
  | jq -r '.access_token')

echo "Test token: ${TEST_TOKEN:0:20}..."
```

### Step 7: Redeem the Invite (AUTO-MERGE TEST)

```bash
REDEEM_RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/redeem_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"p_token_hash\": \"$CLAIM_TOKEN_HASH\"}")

echo "$REDEEM_RESULT" | jq .

RETURNED_STATUS=$(echo "$REDEEM_RESULT" | jq -r '.[0].status')
echo "Returned status: $RETURNED_STATUS"
```

**Expected response** (status should be `approved`, NOT `pending_review`):
```json
[
  {
    "claim_id": "d564a8d3-489f-4597-9cf1-4edd2f1e3da0",
    "office_holder_id": "f873ea5d-51a0-4231-b0ab-6d94149451d4",
    "target_profile_id": "5c844be5-142b-4d0b-b6cf-11b32db80581",
    "status": "approved"
  }
]
```

### Step 8: Verify Auto-Merge Success

```bash
# Check claim status
psql << EOF
SELECT id, status, target_profile_id, claimed_at, approved_at, approved_by
FROM public.office_holder_wall_claims
WHERE id = '$CLAIM_ID';
EOF

# Expected:
# status = 'approved'
# target_profile_id = <test account profile id>
# claimed_at = <timestamp, should equal approved_at>
# approved_by = <admin profile id>
```

```bash
# Check officeholder link was updated
psql << EOF
SELECT id, full_name, linked_profile_id
FROM public.office_holders
WHERE id = '$OFFICEHOLDER_ID';
EOF

# Expected: linked_profile_id should now point to the test account
```

```bash
# Check profile was prefilled with officeholder data
psql << EOF
SELECT id, wall_slug, political_target_role, target_boundary_name
FROM public.politician_profiles
WHERE id = (SELECT target_profile_id FROM public.office_holder_wall_claims WHERE id = '$CLAIM_ID');
EOF

# Expected:
# wall_slug = 'user-mla' (or similar, generated from name + role)
# political_target_role = 'MLA' (from officeholder)
# target_boundary_name = 'Athani' (from officeholder)
```

### Step 9: Verify Public Wall Redirect

```bash
psql << EOF
SELECT old_wall_slug, target_profile_id
FROM public.office_holder_wall_redirects
WHERE claim_id = '$CLAIM_ID';
EOF

# Expected: old_wall_slug should be something like 'laxman-savadi-mla'
```

## Test Flow 2: Self-Requested Claim (Still Requires Admin Approval)

This tests the self-service flow: user asserts ownership → claim lands in pending_review → admin reviews and merges.

### Step 1: Verify Wall is Claimable

```bash
PROFILE_ID="d62de94f-7b17-48de-a383-7ec27fcedba6"  # Example unclaimed officeholder wall

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_wall_claim_eligibility" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_profile_id\": \"$PROFILE_ID\"}" \
  | jq .

# Expected:
# {
#   "kind": "unclaimed_officeholder",
#   "office_holder_id": "..."
# }
```

### Step 2: User Submits Self-Requested Claim

```bash
# As an authenticated citizen (not admin)
CITIZEN_TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"munaruna86@gmail.com\",\"password\":\"Test@123\"}" \
  | jq -r '.access_token')

SELF_REQUEST=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/request_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_office_holder_id\": \"<officeholder_id>\",
    \"p_contact_email\": \"citizen@example.com\",
    \"p_note\": \"I am the actual officeholder\"
  }")

echo "$SELF_REQUEST" | jq .

SELF_CLAIM_ID=$(echo "$SELF_REQUEST" | jq -r '.[0].claim_id')
```

**Expected:**
- Claim created in `pending_review` status
- No auto-merge (self-requested claims require human review)
- Profile promoted to `politician` role
- Profile prefilled with officeholder data

### Step 3: Check Pending Claims Admin View

```bash
# Admin can list all pending self-requested claims
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/list_pending_self_requested_officeholder_claims" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq .

# Expected: claim_id, office_holder_name, requester_name, contact_email, claimed_at
```

### Step 4: Admin Reviews and Merges

```bash
# Admin can call merge_officeholder_wall_claim() to approve
MERGE_RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/merge_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"p_claim_id\": \"$SELF_CLAIM_ID\"}")

echo "$MERGE_RESULT" | jq .

# Or, admin can reject if it looks fraudulent
REJECT_RESULT=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/reject_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_claim_id\": \"$SELF_CLAIM_ID\",
    \"p_reason\": \"Unable to verify identity\"
  }")

echo "$REJECT_RESULT" | jq .
```

## Test Flow 3: Verify Merged Claim State

After either flow (auto-merge or manual merge), verify the wall is fully transferred.

```bash
# Get claim details
psql << EOF
SELECT 
  id, status, office_holder_id, source_profile_id, target_profile_id,
  claimed_at, approved_at, approved_by, reversed_at
FROM public.office_holder_wall_claims
WHERE id = '$CLAIM_ID';
EOF
```

```bash
# Get moved items (posts, comments, supporters, ratings, etc.)
psql << EOF
SELECT 
  entity_type, COUNT(*) as count,
  COUNT(*) FILTER (WHERE moved_at IS NOT NULL AND reversed_at IS NULL) as active
FROM public.office_holder_wall_claim_items
WHERE claim_id = '$CLAIM_ID'
GROUP BY entity_type;
EOF

# Example:
# entity_type              | count | active
# wall_route              |     1 |      1
# politician_profile      |     1 |      1
# post                    |     3 |      3
# rating                  |     2 |      2
```

```bash
# Verify old wall URL redirects to new wall
psql << EOF
SELECT old_wall_slug, target_profile_id
FROM public.office_holder_wall_redirects
WHERE claim_id = '$CLAIM_ID';
EOF
```

## Test Flow 4: Auto-Merge Fallback (Edge Case)

This tests what happens when auto-merge can't complete (rare edge case).

### Scenario: Officeholder's Link Was Changed After Invite

```bash
# Manually change the officeholder's linked_profile_id (simulating it being claimed elsewhere)
psql << EOF
UPDATE public.office_holders 
SET linked_profile_id = '<some-other-profile-id>'
WHERE id = '$OFFICEHOLDER_ID';
EOF

# Create a new invite
TOKEN=$(openssl rand -hex 32)
TOKEN_HASH=$(echo -n "$TOKEN" | sha256sum | cut -d' ' -f1)

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/create_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_office_holder_id\": \"$OFFICEHOLDER_ID\",
    \"p_email\": \"$TEST_EMAIL_2\",
    \"p_token_hash\": \"$TOKEN_HASH\"
  }" > /dev/null

# Redeem the invite
TEST_TOKEN_2=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL_2\",\"password\":\"$TEST_PASSWORD_2\"}" \
  | jq -r '.access_token')

REDEEM=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/redeem_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $TEST_TOKEN_2" \
  -H "Content-Type: application/json" \
  -d "{\"p_token_hash\": \"$TOKEN_HASH\"}")

echo "$REDEEM" | jq .

# Expected: status = 'pending_review' (fallback, auto-merge failed)
# The claimant's signup/login still succeeded, claim just needs manual merge
```

### Admin Can Still Merge It Manually

```bash
NEW_CLAIM_ID=$(echo "$REDEEM" | jq -r '.[0].claim_id')

# Restore the officeholder link first (if needed)
psql << EOF
UPDATE public.office_holders 
SET linked_profile_id = '<original-profile-id>'
WHERE id = '$OFFICEHOLDER_ID';
EOF

# Now merge manually
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/merge_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"p_claim_id\": \"$NEW_CLAIM_ID\"}" | jq .
```

## Test Flow 5: Reverse an Approved Claim

This tests the admin ability to undo a merge if it was done in error.

```bash
# Reverse a claim that's already been merged (status = 'approved')
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/reverse_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"p_claim_id\": \"$CLAIM_ID\",
    \"p_reason\": \"Merged in error, user was impersonating\"
  }" | jq .

# Verify status changed to 'reversed'
psql << EOF
SELECT id, status, reversed_at, metadata->>'reversal_reason' as reason
FROM public.office_holder_wall_claims
WHERE id = '$CLAIM_ID';
EOF

# Verify posts/comments were restored to original owner
psql << EOF
SELECT entity_type, COUNT(*) as count
FROM public.office_holder_wall_claim_items
WHERE claim_id = '$CLAIM_ID' AND reversed_at IS NOT NULL
GROUP BY entity_type;
EOF
```

## Common Query Patterns

### Find All Claims for an Officeholder

```bash
OFFICEHOLDER_ID="f873ea5d-51a0-4231-b0ab-6d94149451d4"

psql << EOF
SELECT 
  c.id, c.status, c.contact_email, c.claimed_at, c.approved_at,
  oh.full_name as officeholder_name,
  p.full_name as target_name
FROM public.office_holder_wall_claims c
JOIN public.office_holders oh ON oh.id = c.office_holder_id
LEFT JOIN public.profiles p ON p.id = c.target_profile_id
WHERE c.office_holder_id = '$OFFICEHOLDER_ID'
ORDER BY c.created_at DESC;
EOF
```

### Find All Claims for a Profile

```bash
PROFILE_ID="5c844be5-142b-4d0b-b6cf-11b32db80581"

psql << EOF
SELECT 
  c.id, c.status, oh.full_name as officeholder_name, c.claimed_at,
  CASE c.status
    WHEN 'approved' THEN 'Merged — wall is yours'
    WHEN 'pending_review' THEN 'Waiting for admin review'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'reversed' THEN 'Reversed'
    ELSE c.status
  END as state_label
FROM public.office_holder_wall_claims c
JOIN public.office_holders oh ON oh.id = c.office_holder_id
WHERE c.target_profile_id = '$PROFILE_ID'
ORDER BY c.claimed_at DESC;
EOF
```

### Count Claims by Status

```bash
psql << EOF
SELECT 
  status, COUNT(*) as count
FROM public.office_holder_wall_claims
GROUP BY status
ORDER BY count DESC;
EOF
```

## Browser Testing

### Test the Invite Link

```
http://localhost:3000/officeholder-claim/<TOKEN>
```

**When logged out**: Shows dual-link chooser ("New to Choseno — sign up" or "I already have an account — merge into it")

**When logged in as citizen**: Redeems automatically, shows success screen:
- If auto-merged: "Wall claimed — ...now yours"
- If fallback (pending_review): "Claim submitted — ...administrator will review"

### Test the Admin UI

```
http://localhost:3000/admin/office-holders
```

1. Enter wall URL (e.g., `https://www.choseno.com/wall/laxman-savadi-mla`)
2. Enter invite email
3. Click "Send Invite"
4. Email sent via send-officeholder-claim function
5. View invitation history showing all claims, with merge button for pending_review

## Troubleshooting

### "Duplicate key value violates unique constraint office_holder_wall_claims_one_open_claim_idx"

The officeholder already has an open/approved claim. Find another officeholder using the query above, or cancel the existing claim:

```bash
EXISTING_CLAIM_ID="..."

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/cancel_officeholder_wall_claim" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"p_claim_id\": \"$EXISTING_CLAIM_ID\"}" | jq .
```

### "admin accounts cannot claim an officeholder wall"

You're logged in as an admin. Log out first or use a non-admin test account.

### Token keeps getting rejected ("claim invitation is invalid, used, cancelled, or expired")

- Token was already consumed (used_at set) — generate a fresh one
- Claim was cancelled — check status, create a new invite
- Invite expired (7 days by default) — create a new invite with `p_expires_at` parameter

## Resources

- **Design Doc**: [docs/OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md](OFFICEHOLDER_WALL_CLAIM_AND_MERGE.md)
- **Test Accounts**: [docs/TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)
- **Auto-Merge Tests**: [docs/TEST_RESULTS_AUTO_MERGE.md](TEST_RESULTS_AUTO_MERGE.md)
- **API Reference**: Check migrations in `supabase/migrations/2026081*` for RPC signatures
