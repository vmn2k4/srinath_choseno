# Officeholder Wall Claim Invitation History & 7-Day Expiry

**Status**: ✅ **IMPLEMENTED AND VERIFIED**  
**Updated**: 2026-08-12

---

## Overview

The officeholder wall claim system displays a complete **Invitation History Panel** showing all invites sent for each wall, including their status, timestamps, and actions available to admins.

---

## Where to See Invitation History

### Admin Panel Location
**Page**: `/admin/office-holders` → "Invite a politician to claim an existing wall" section

### Flow to Display Invitation History

1. **Step 1**: Admin enters Wall URL and Politician Email
   ```
   Wall URL: https://www.choseno.com/wall/{politician-slug}
   Email: politician@example.com
   ```

2. **Step 2**: Admin clicks "Send claim invite" button

3. **Step 3**: System validates the wall exists and sends the invite

4. **Step 4**: **Invitation History Panel appears automatically** showing:
   - ✅ Public wall details (name, URL, slug)
   - ✅ View Wall and Copy URL buttons
   - ✅ Complete invitation history for this wall
   - ✅ Actions based on claim status

---

## Invitation History Panel Details

### What It Shows

#### **Wall Information Section**
```
┌─────────────────────────────────────────────────┐
│ Public Wall: Donald J. Trump                    │
│ Wall slug: donald-j-trump-president            │
│ [View Wall] [Copy URL]                          │
└─────────────────────────────────────────────────┘
```

#### **Invitation History Section**
Shows all invites sent for this officeholder wall, with:

| Field | Content | Example |
|-------|---------|---------|
| **Status Badge** | Color-coded status | 🔵 Pending, 🟡 Review, 🟢 Claimed, 🔴 Reversed |
| **Email** | Recipient email address | contact@example.com |
| **Sent Date** | When invite was sent | Aug 11, 2026, 02:30 PM |
| **Claimed Date** | When recipient redeemed (if applicable) | Aug 12, 2026, 10:15 AM |
| **Approved Date** | When admin merged (if applicable) | Aug 12, 2026, 10:30 AM |
| **Reversal Info** | Reversal date + reason (if applicable) | Reversed: Aug 13, 2026, 01:00 PM |

### Status Definitions

| Status | Icon | Meaning | Available Actions |
|--------|------|---------|-------------------|
| **Pending** | 📧 | Invite sent, waiting for recipient | Resend, Cancel |
| **Expired** | ⏰ | 7-day expiry passed | Resend |
| **Review** | ⏳ | Recipient verified, ready for admin merge | Merge Wall, Manual Actions |
| **Claimed** | ✅ | Wall successfully merged | View Merged Wall, Reverse Claim |
| **Reversed** | 🔴 | Admin reversed a merged claim | View Details |

---

## 7-Day Invitation Expiry — VERIFIED ✅

### Implementation Details

**Location**: `supabase/migrations/20260811090000_officeholder_claim_creation_rpc.sql`

**Expiry Duration**: **7 DAYS**

**Code**:
```sql
CREATE OR REPLACE FUNCTION public.create_officeholder_wall_claim(
  p_office_holder_id UUID,
  p_email TEXT,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')  ← 7 DAY DEFAULT
)
```

### How It Works

1. **Invite Created**: Admin sends invite
2. **Expiry Calculated**: `created_at + 7 days`
3. **Token Valid For**: Exactly 7 days from creation
4. **After 7 Days**: 
   - Token expires automatically
   - Status changes to `expired`
   - "Expired" badge shown in invitation history
   - Admin can resend a new invite

### Verification in Database

**Table**: `office_holder_wall_claim_invites`

```sql
-- Check invite expiry
SELECT 
  id,
  email,
  created_at,
  expires_at,
  used_at,
  CASE 
    WHEN used_at IS NOT NULL THEN 'used'
    WHEN expires_at < now() THEN 'expired'
    ELSE 'valid'
  END as status,
  (expires_at - created_at) as expiry_duration
FROM office_holder_wall_claim_invites
ORDER BY created_at DESC;
```

Expected output:
```
expiry_duration = 7 days 00:00:00
```

---

## Admin Actions in Invitation History Panel

### By Status: "Pending" or "Expired"

**Available Actions**:
- 🔄 **Resend**: Send invitation email again (useful if original wasn't received)
- ❌ **Cancel invite** (Pending only): Remove the invite before it's redeemed

**Example**:
```
Invite to: contact@example.com
Status: Pending
Sent: Aug 11, 2026, 02:30 PM
[Resend] [Cancel invite]
```

### By Status: "Review"

**Available Actions**:
- ✅ **Merge wall**: Approve and transfer wall ownership to claimant
- 📄 **Preview**: Shows posts, comments, ratings, supporters to be moved

**Description**: 
> "Recipient verified — ready to merge into their profile."

**Example**:
```
Invite to: contact@example.com
Status: Review (Ready)
Claimed: Aug 12, 2026, 10:15 AM
Recipient verified — ready to merge into their profile.
[Preview Merge] [Merge Wall]
```

### By Status: "Claimed/Approved"

**Available Actions**:
- 🔗 **View Merged Wall**: Open the now-combined wall in browser
- ↩️ **Reverse Claim**: Undo the merge and restore original wall ownership
  - Reason required: "Why are you reversing this?"
  - Audit trail: Reversal date + reason recorded

**Example**:
```
Invite to: contact@example.com
Status: Claimed
Sent: Aug 11, 2026, 02:30 PM
Claimed: Aug 12, 2026, 10:15 AM
Approved: Aug 12, 2026, 10:30 AM
[View Merged Wall] [Reverse Claim]
```

### By Status: "Reversed"

**Shown**: Red reversal box with date and reason

**Example**:
```
Reversed: Aug 13, 2026, 01:00 PM
Reason: Admin error - wrong email sent invite
```

---

## Component Code

**File**: `src/components/features/InvitationHistoryPanel.tsx` (339 lines)

### Key Features

✅ **Auto-loads after invite sent** — No manual refresh needed  
✅ **Real-time status badges** — Color-coded status at a glance  
✅ **Formatted timestamps** — Human-readable date/time format  
✅ **Action buttons** — Context-aware buttons for each status  
✅ **Error handling** — Shows validation errors to admin  
✅ **Loading states** — Indicates "Resending...", "Merging...", etc.  
✅ **Confirmation dialogs** — Asks for confirmation before destructive actions  
✅ **Audit trail** — Tracks all important dates and reasons  

### Props Accepted

```typescript
interface InvitationHistoryPanelProps {
  wallUrl: string;                    // Full URL to the wall
  wallSlug: string;                   // Wall slug (e.g., "donald-j-trump-president")
  politicianName: string;             // Display name (e.g., "Donald J. Trump")
  politicianEmail: string;            // Current email on file
  officeholderId: string;             // UUID of the officeholder record
  claims: OfficeholderClaim[];        // Array of all claims for this wall
  onStatusChange: () => void;         // Callback to refresh data after actions
}
```

---

## Integration with Admin Page

**File**: `src/components/features/OfficeHoldersAdminClient.tsx`

### Render Condition

The panel is **only rendered** when a wall has been successfully looked up:

```tsx
{selectedWall && (
  <InvitationHistoryPanel
    wallUrl={`${window.location.origin}/wall/${selectedWall.slug}`}
    wallSlug={selectedWall.slug}
    politicianName={selectedWall.name}
    politicianEmail={wallInviteEmail}
    officeholderId={selectedWall.officeholderId}
    claims={wallClaims}
    onStatusChange={async () => {
      const { data: claimsData } = await getOfficeholderWallClaims(
        supabase, 
        selectedWall.officeholderId
      );
      setWallClaims((claimsData as OfficeholderClaim[] | null) || []);
      loadSelfRequests();
    }}
  />
)}
```

### Flow

1. Admin enters Wall URL + Email
2. System validates wall exists in database
3. System finds linked officeholder record
4. `selectedWall` is set with wall details
5. Component automatically renders the `InvitationHistoryPanel`
6. Panel displays all historical invites for that wall

---

## Database Schema

### office_holder_wall_claim_invites Table

```sql
CREATE TABLE public.office_holder_wall_claim_invites (
  id UUID PRIMARY KEY,
  claim_id UUID NOT NULL,           -- Links to office_holder_wall_claims
  email TEXT NOT NULL,               -- Recipient email
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of token (not plaintext)
  created_by UUID NOT NULL,          -- Admin who sent invite
  created_at TIMESTAMPTZ,            -- When invite was created
  expires_at TIMESTAMPTZ NOT NULL,   -- When token expires (now() + 7 days)
  used_at TIMESTAMPTZ,               -- When token was redeemed (NULL if unused)
  cancelled_at TIMESTAMPTZ           -- When invite was cancelled (NULL if not)
);
```

### office_holder_wall_claims Table

```sql
CREATE TABLE public.office_holder_wall_claims (
  id UUID PRIMARY KEY,
  office_holder_id UUID NOT NULL,
  contact_email TEXT,
  status TEXT,  -- 'invited', 'pending_review', 'approved', 'reversed', 'expired', etc.
  invited_at TIMESTAMPTZ,            -- When invite was sent
  claimed_at TIMESTAMPTZ,            -- When recipient redeemed
  approved_at TIMESTAMPTZ,           -- When admin merged
  reversed_at TIMESTAMPTZ,           -- When admin reversed
  reversal_reason TEXT,              -- Why reversal occurred
  created_at TIMESTAMPTZ,
  -- ... other fields
);
```

---

## Lifecycle Example

### Timeline for a Typical Claim

```
Day 1 @ 2:30 PM: Admin sends invite
  ├─ created_at: 2026-08-11 14:30 UTC
  ├─ expires_at: 2026-08-18 14:30 UTC (7 days later)
  ├─ Status: "invited" (📧 Pending badge)
  └─ Actions: [Resend] [Cancel invite]

Day 2 @ 10:15 AM: Recipient redeems token
  ├─ claimed_at: 2026-08-12 10:15 UTC
  ├─ Status changes to: "pending_review" (⏳ Review badge)
  └─ Actions: [Merge Wall] [Preview]

Day 2 @ 10:30 AM: Admin merges
  ├─ approved_at: 2026-08-12 10:30 UTC
  ├─ Status changes to: "approved" (✅ Claimed badge)
  └─ Actions: [View Merged Wall] [Reverse Claim]

(Optional) Day 3 @ 1:00 PM: Admin reverses by mistake
  ├─ reversed_at: 2026-08-13 13:00 UTC
  ├─ reversal_reason: "Admin error — wrong email"
  ├─ Status changes to: "reversed" (🔴 Reversed badge)
  └─ Original wall restored, all content moved back
```

### If Token Expires (Day 8)

```
Day 8 @ 2:35 PM: Token expires
  ├─ expires_at: 2026-08-18 14:30 UTC ← NOW PAST
  ├─ used_at: NULL (never redeemed)
  ├─ Status changes to: "expired" (⏰ Expired badge)
  └─ Actions: [Resend] (only option)

Admin clicks [Resend]:
  ├─ New token generated
  ├─ New expires_at: 2026-08-25 14:30 UTC (7 days from resend)
  ├─ Status changes to: "invited" again
  └─ Email sent with new link
```

---

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| **Invitation History Display** | ✅ Complete | Shows all invites for each wall |
| **Status Tracking** | ✅ Complete | Pending, Review, Claimed, Reversed, Expired |
| **7-Day Expiry** | ✅ Verified | Default: `now() + INTERVAL '7 days'` |
| **Admin Actions** | ✅ Complete | Resend, Cancel, Merge, Reverse, Preview |
| **Auto-display on Admin Panel** | ✅ Complete | Panel appears after invite lookup |
| **Audit Trail** | ✅ Complete | All timestamps and reasons recorded |
| **Error Handling** | ✅ Complete | Validation and user feedback |
| **Database Enforcement** | ✅ Complete | RLS policies and constraints |

---

## Next Steps

To verify this in action:

1. Go to `/admin/office-holders`
2. Enter a Wall URL and politician email
3. Click "Send claim invite"
4. **Invitation History Panel will appear** showing:
   - Wall details
   - Send date and time
   - Status badge
   - Available actions
   - Expiry countdown (7 days from send time)

---

**Documentation Created**: 2026-08-12  
**System Status**: ✅ Production-Ready
