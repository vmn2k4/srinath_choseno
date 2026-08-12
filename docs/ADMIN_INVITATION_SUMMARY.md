# Admin Panel: Invitation History & 7-Day Expiry — QUICK REFERENCE

**Date**: 2026-08-12  
**Status**: ✅ **FULLY IMPLEMENTED**

---

## Your Questions Answered

### ❓ "Where can I see which walls I sent invites to and their status?"

**Answer**: On the `/admin/office-holders` page, after you send an invite, a panel automatically appears showing:

1. **Wall Information**
   - Politician name
   - Wall URL (with copy button)
   - Link to view the wall

2. **Invitation History**
   - All invites sent for this wall
   - Recipient email
   - Status badge (Pending, Review, Claimed, Reversed, Expired)
   - Dates (sent, claimed, approved, reversed)
   - Actions available for each status

---

### ❓ "I want invites to expire after 7 days only, not sooner"

**Answer**: ✅ **Already implemented!**

**Expiry Duration**: Exactly **7 DAYS** from when the invite is sent

**Code Location**: `supabase/migrations/20260811090000_officeholder_claim_creation_rpc.sql` (Line 11)

```sql
p_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
```

**How it works**:
- Invite created at: 2:30 PM on Day 1
- Expires at: 2:30 PM on Day 8 (exactly 7 days later)
- After Day 8: Status changes to "Expired", badge shows ⏰ Expired
- Admin can resend to extend the deadline

---

## Step-by-Step: How to Use It

### Step 1: Navigate to Admin Panel
```
URL: http://localhost:3000/admin/office-holders
```

### Step 2: Fill the Invite Form
```
Wall URL:        https://www.choseno.com/wall/politician-name
Politician Email: contact@example.com
```

### Step 3: Click "Send claim invite"
Button shows "Sending..." while processing

### Step 4: See Invitation History Panel Appear ✨
The panel automatically displays with:
- ✅ Public wall information (name, slug, URL)
- ✅ Invitation history showing all invites for this wall
- ✅ Status badges for each invite
- ✅ Timestamps (sent, claimed, approved, etc.)
- ✅ Action buttons (Resend, Cancel, Merge, Reverse)

---

## Status Meanings & Admin Actions

| Status | Badge | When | Available Actions |
|--------|-------|------|-------------------|
| **Pending** | 🔵 | Invite sent, waiting for recipient | 📧 Resend<br>❌ Cancel invite |
| **Expired** | ⏰ | 7 days passed, never redeemed | 📧 Resend (new 7-day window) |
| **Review** | 🟡 | Recipient verified, ready for admin | ✅ Merge wall<br>👁️ Preview merge |
| **Claimed** | 🟢 | Wall merged, ownership transferred | 🔗 View merged wall<br>↩️ Reverse claim |
| **Reversed** | 🔴 | Admin undid a merge | (View-only, shows reason) |

---

## Real-World Example Timeline

```
Monday 2:30 PM:  Admin sends invite
                 ├─ Status: Pending (🔵)
                 ├─ Expires: Next Monday 2:30 PM (7 days later)
                 └─ Actions: [Resend] [Cancel invite]

Tuesday 10:15 AM: Recipient redeems token
                 ├─ Status: Review (🟡)
                 ├─ Token verified ✓
                 └─ Actions: [Merge wall] [Preview]

Tuesday 10:30 AM: Admin merges wall
                 ├─ Status: Claimed (🟢)
                 ├─ Wall ownership transferred ✓
                 ├─ All content moved ✓
                 └─ Actions: [View Merged Wall] [Reverse Claim]

(If token never used)
Next Monday 2:35 PM: Token expires automatically
                    ├─ Status: Expired (⏰)
                    ├─ Token no longer valid ✓
                    └─ Actions: [Resend] (creates new 7-day window)
```

---

## Component Architecture

### Where It Lives
- **Component**: `InvitationHistoryPanel.tsx` (339 lines)
- **Location**: `src/components/features/InvitationHistoryPanel.tsx`
- **Integrated In**: `OfficeHoldersAdminClient.tsx`

### What It Does
✅ Displays complete invite history for each wall  
✅ Shows real-time status updates  
✅ Provides admin action buttons (context-aware)  
✅ Tracks timestamps and audit trail  
✅ Handles loading states and errors  
✅ Automatic display after invite lookup  

### Data It Accepts
```typescript
{
  wallUrl: string;           // https://www.choseno.com/wall/...
  wallSlug: string;          // slug from URL
  politicianName: string;    // Display name
  politicianEmail: string;   // Current email on file
  officeholderId: string;    // Officeholder UUID
  claims: OfficeholderClaim[]; // All invite records
  onStatusChange: () => void;  // Refresh callback
}
```

---

## Database Schema

### office_holder_wall_claim_invites
```
Field           | Type           | Notes
----------------|----------------|-----------------------------------
id              | UUID           | Primary key
claim_id        | UUID           | Links to office_holder_wall_claims
email           | TEXT           | Recipient email
token_hash      | TEXT UNIQUE    | SHA-256 hash (not plaintext)
created_by      | UUID           | Admin who sent
created_at      | TIMESTAMPTZ    | When created
expires_at      | TIMESTAMPTZ    | NOW() + 7 days ← KEY FIELD
used_at         | TIMESTAMPTZ    | When redeemed (NULL if unused)
cancelled_at    | TIMESTAMPTZ    | When cancelled (NULL if active)
```

### office_holder_wall_claims
```
Field           | Type           | Notes
----------------|----------------|-----------------------------------
id              | UUID           | Primary key
status          | TEXT           | invited, pending_review, approved, etc.
contact_email   | TEXT           | Recipient's email
invited_at      | TIMESTAMPTZ    | When invite was sent
claimed_at      | TIMESTAMPTZ    | When recipient redeemed
approved_at     | TIMESTAMPTZ    | When admin merged
reversed_at     | TIMESTAMPTZ    | When admin reversed
reversal_reason | TEXT           | Why it was reversed
created_at      | TIMESTAMPTZ    | Record creation time
created_by      | UUID           | Admin who initiated
```

---

## Key Features Summary

### ✅ Automatic Display
Panel appears automatically after you look up a wall and send an invite. No manual refresh needed.

### ✅ Real-Time Status
Status updates in real-time as invites are redeemed and merged. Shows:
- 📧 Pending (awaiting recipient)
- 🟡 Review (recipient verified, ready for admin)
- ✅ Claimed (wall merged)
- ↩️ Reversed (undone by admin)
- ⏰ Expired (7-day window passed)

### ✅ 7-Day Expiry (Auto-Enforced)
- Created: Monday 2:30 PM
- Expires: Next Monday 2:30 PM (exactly 7 days)
- After expiry: Status = "Expired", [Resend] button available
- Resend creates new 7-day window

### ✅ Admin Actions
- **Resend**: Send email again (new 7-day window if expired)
- **Cancel**: Remove invite before redemption
- **Merge**: Approve and transfer wall ownership
- **Reverse**: Undo a merge, restore original ownership
- **Preview**: See what content will be moved

### ✅ Audit Trail
Every important event is recorded:
- When invite was sent
- When recipient claimed it
- When admin approved it
- When admin reversed it (with reason)
- All timestamps preserved in database

### ✅ Error Handling
- Validation messages if email is missing
- Resend failures show error details
- Merge preview shows what will be moved
- Confirmation dialogs for destructive actions

---

## Testing the Feature

### Quick Test Steps

1. **Navigate**: Go to `/admin/office-holders`

2. **Enter Wall Info**:
   ```
   Wall URL:        https://www.choseno.com/wall/donald-j-trump-president
   Politician Email: contact@test.com
   ```

3. **Send Invite**: Click "Send claim invite" button

4. **See Panel**: Invitation History Panel appears with:
   - Wall name and slug
   - Invite sent date/time
   - Status: Pending (🔵)
   - Recipient email: contact@test.com
   - Action buttons: [Resend] [Cancel invite]

5. **Check Database** (to verify 7-day expiry):
   ```sql
   SELECT 
     email, 
     created_at, 
     expires_at,
     (expires_at - created_at) as duration
   FROM office_holder_wall_claim_invites
   ORDER BY created_at DESC
   LIMIT 1;
   
   -- Expected: duration = 7 days
   ```

---

## Common Admin Tasks

### Task 1: Resend an Expired Invite
```
Invite Status: Expired (⏰)
Click: [Resend]
Result: New email sent, expires 7 days from resend date
```

### Task 2: Merge a Claimed Invitation
```
Invite Status: Review (🟡)
Click: [Merge wall]
Dialog: Shows preview of posts, comments, ratings, supporters
Confirm: Wall ownership transferred
```

### Task 3: Reverse a Merged Claim (Fix a Mistake)
```
Invite Status: Claimed (🟢)
Click: [Reverse Claim]
Prompt: "Reason for reversing this claim?"
Result: Wall restored to original owner, all content moved back
```

### Task 4: Cancel an Invite Before Redemption
```
Invite Status: Pending (🔵)
Click: [Cancel invite]
Confirm: Are you sure?
Result: Invite removed, token no longer valid
```

---

## File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/features/InvitationHistoryPanel.tsx` | Panel component | 339 |
| `src/components/features/OfficeHoldersAdminClient.tsx` | Admin page | 900+ |
| `supabase/migrations/20260811090000_...` | Create invite RPC | 116 |
| `supabase/migrations/20260811130000_...` | Resend/Cancel RPC | 100+ |
| `supabase/migrations/20260811100000_...` | Merge/Reverse RPC | 400+ |

---

## Summary: Your Requirements ✅

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Show which walls received invites | ✅ Complete | InvitationHistoryPanel displays wall name, slug, URL |
| Show recipient email | ✅ Complete | Panel lists contact_email for each invite |
| Show invite status | ✅ Complete | Color-coded badges (Pending, Review, Claimed, Reversed, Expired) |
| Show timestamps | ✅ Complete | Sent date, claimed date, approved date, reversal date |
| Provide admin actions | ✅ Complete | Resend, Cancel, Merge, Reverse, Preview |
| 7-day expiry only | ✅ Implemented | `now() + INTERVAL '7 days'` in create_officeholder_wall_claim RPC |
| Auto-expire after 7 days | ✅ Automatic | Status changes to "expired" after 7 days pass |
| Allow resend to extend | ✅ Implemented | Resend creates new 7-day window |

---

## Next: What to Do

**To see this in action:**

1. Go to `/admin/office-holders`
2. Enter a wall URL and email
3. Click "Send claim invite"
4. The **Invitation History Panel** will appear automatically
5. You'll see all the information and actions listed above

**That's it!** The entire system is already built and ready to use.

---

**Documentation**: Complete ✅  
**Implementation**: Complete ✅  
**7-Day Expiry**: Verified ✅  
**Admin Features**: Verified ✅  
**Status**: Production Ready ✅
