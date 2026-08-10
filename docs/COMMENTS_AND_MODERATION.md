# Comments & Moderation System

Threaded discussion, content moderation, and flag/report workflows across posts, candidacies, news, and politician walls.

---

## Overview

All user-generated content (posts, comments, video descriptions) can be:
- **Replied to** in threads (same Ghost ID, nested replies)
- **Flagged for moderation** by any user (spam, harassment, misinformation)
- **Reviewed by admins** (mod dashboard at `/admin/moderation`)
- **Hidden/deleted** (soft-delete: content stays in DB, marked `hidden=true`)

Comments use the same **Ghost ID** system as posts (anonymous, rotating per user).

---

## Schema

### Post/Comment Tables

**`posts`** (Feed posts, wall posts, candidacy posts)
- `id` (uuid, PK)
- `ghost_id` (text) — Poster's anonymous identity
- `profile_id` (uuid, FK → profiles) — Owner (real account)
- `content` (text)
- `image_url` (text, nullable)
- `video_url` (text, nullable)
- `link_preview` (jsonb, nullable) — Extracted from URL
- `hidden` (bool, default false) — Soft-delete flag
- `created_at`, `updated_at`

**`comments`** (Replies to posts)
- `id` (uuid, PK)
- `post_id` (uuid, FK → posts)
- `ghost_id` (text) — Commenter's Ghost ID
- `profile_id` (uuid, FK → profiles)
- `content` (text)
- `parent_comment_id` (uuid, FK → comments, nullable) — For nested replies
- `hidden` (bool, default false)
- `created_at`, `updated_at`

### Moderation Tables

**`content_flags`** (User reports)
- `id` (uuid, PK)
- `flagged_by_profile_id` (uuid, FK → profiles) — Who reported it
- `flagged_ghost_id` (text, nullable) — Ghost ID of content author (if known)
- `content_type` (text: 'post', 'comment', 'profile')
- `content_id` (uuid) — PK of flagged content
- `reason` (text enum: 'spam', 'harassment', 'misinformation', 'hate_speech', 'nsfw', 'other')
- `description` (text, nullable) — Free-text explanation
- `status` (text: 'pending', 'reviewed', 'ignored')
- `admin_notes` (text, nullable) — Notes from mod
- `created_at`, `reviewed_at`

**`hidden_content_log`** (Audit trail for admin actions)
- `id` (uuid, PK)
- `content_type` (text: 'post', 'comment', 'profile')
- `content_id` (uuid)
- `action` (text: 'hidden', 'restored', 'deleted')
- `reason` (text, nullable)
- `hidden_by_admin_id` (uuid, FK → profiles)
- `created_at`

---

## Threaded Comments

### Structure

Posts can have multiple top-level comments, and each comment can have nested replies:

```
Post: "Climate action is urgent"
├─ Comment A: "Absolutely agree"
│  └─ Reply A1: "Count me in"
│  └─ Reply A2: "What policies?"
├─ Comment B: "It's about the economy"
└─ Comment C: "Science agrees"
```

**Implementation**:
- Top-level comments: `comments.parent_comment_id = NULL`
- Nested replies: `comments.parent_comment_id = <comment_id>`
- Query by `post_id` + order by `created_at`; UI groups by `parent_comment_id`

### Depth Limit

**Max nesting**: Comments can reply to comments, but replies to replies can't reply further (2 levels total).

**Enforced by**:
- Form UI doesn't show a reply box on nested replies
- RLS policy blocks inserts if `parent_comment.parent_comment_id IS NOT NULL`

### Pinned Comments

**Owner-only**: A post/candidacy owner can pin one top-level comment to the top of the thread.

- `comments.pinned_by_author` (bool)
- Pinned comments sort first in the feed; others sort by `created_at DESC`

---

## Flagging & Moderation

### User-Facing Flow

**On any post/comment**, a **"•••" menu button** reveals:
- Copy link
- **Report** (only if not your own)

**Clicking Report**:
1. Modal opens: "What's wrong?" dropdown
   - Spam
   - Harassment/bullying
   - Misinformation
   - Hate speech
   - NSFW content
   - Other (reason)
2. Optional text box: "Tell us more..."
3. Confirm → Flag submitted

**After flagging**:
- "Thank you for reporting" toast
- User can't flag the same content again
- Flag count on post (not visible to users, admins only)

### Admin Moderation Dashboard (`/admin/moderation`)

**Three sections**:

1. **Pending Flags**
   - Table: timestamp, flagged content excerpt, reason, flag count (if multiple users flagged)
   - Click row → detail panel
   - Bulk actions: "Mark Reviewed" (batch move to "Reviewed" without action)

2. **Detail Panel** (right-side drawer)
   - Full flagged content (post/comment + surrounding context)
   - All flags on this content (reason + user notes)
   - **Admin actions**:
     - ✓ Dismiss (mark reviewed, no action)
     - 🚫 Hide Content (soft-delete, not visible to users)
     - 🔗 View User Profile (jump to profile_id)
     - Add admin note

3. **Hidden Content Log**
   - Audit trail: timestamp, what was hidden, why, by which admin
   - Can't restore directly (requires database admin)

### RLS for Moderation

**Admins see all flags**:
```sql
CREATE POLICY "admins_see_all_flags" ON content_flags
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  OR flagged_by_profile_id = auth.uid()  -- See your own flags
);
```

**Hiding content** (admin-only):
```sql
CREATE POLICY "admins_can_hide" ON posts
AS PERMISSIVE FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

---

## Hidden Content Behavior

### User View

**Soft-deleted posts/comments**:
- Don't appear in feeds
- If directly linked, show "This post was removed" placeholder
- Replies to hidden comments still visible (not cascading delete)

**Soft-deleted profiles**:
- All posts/comments disappear from feeds
- Wall URL returns 404
- Candidacy pages show "Candidate profile removed"

### Admin View

- Can still see hidden content (marked with a 🚫 badge)
- Can restore (set `hidden = false`) from the audit log
- Hard-delete not exposed in UI (only in raw database)

---

## Spam & Abuse Prevention

### One-Flag-Per-Content-Per-User

**RLS enforces**:
```sql
CREATE POLICY "one_flag_per_user_per_content" ON content_flags
AS RESTRICTIVE FOR INSERT TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM content_flags cf
    WHERE cf.flagged_by_profile_id = auth.uid()
      AND cf.content_type = NEW.content_type
      AND cf.content_id = NEW.content_id
  )
);
```

### Rapid-Fire Post Prevention

**Not yet implemented, but design**:
- Rate limit: max 5 posts per 10 minutes per Ghost ID
- Enforced by app logic before insert (check created_at < NOW() - 10 min)
- Future: add to RLS policy

---

## Components & Services

| Component | Purpose |
|---|---|
| [`CommentComposer.tsx`](../src/components/features/CommentComposer.tsx) | Reply box + submit |
| [`NewsComments.tsx`](../src/components/features/NewsComments.tsx) | News-specific comment thread |
| [`ReportDialog.tsx`](../src/components/features/ReportDialog.tsx) | Flag/report form |
| [`ModerationPageClient.tsx`](../src/components/features/ModerationPageClient.tsx) | Admin mod dashboard |

| Service | Purpose |
|---|---|
| `getPostComments(postId)` | Fetch all comments + nested replies for a post |
| `createComment(postId, content, ...)` | Submit new comment/reply |
| `flagContent(type, id, reason, notes)` | File a report |
| `getUnreviewedFlags()` | Fetch pending flags for admin |
| `hideContent(type, id, reason)` | Soft-delete (admin) |

All in [`src/lib/services/moderation.ts`](../src/lib/services/moderation.ts).

---

## Related Files

- **Migrations**: 
  - [`20260806000006_test_content_flag.sql`](../supabase/migrations/20260806000006_test_content_flag.sql)
  - [`20260806000007_test_content_flag_rpcs.sql`](../supabase/migrations/20260806000007_test_content_flag_rpcs.sql)
  - [`20260806000009_test_profile_flag.sql`](../supabase/migrations/20260806000009_test_profile_flag.sql)
- **Service**: [`src/lib/services/moderation.ts`](../src/lib/services/moderation.ts)
- **Admin Component**: [`src/components/features/ModerationPageClient.tsx`](../src/components/features/ModerationPageClient.tsx)

---

## Future Enhancements

- [ ] **Auto-moderation**: ML spam/harassment detection (future ML API)
- [ ] **Appeal workflow**: Users can appeal hidden content (reviewed by admin)
- [ ] **Muting**: Users can mute a Ghost ID (content doesn't appear in their feed)
- [ ] **Shadowban**: Hidden only from specific user (not globally)
- [ ] **User warnings**: Track mod actions per user, escalate to temp ban
- [ ] **Rate limiting**: Auto-flag rapid-fire posting
- [ ] **Keyword filters**: Auto-hide content with certain terms (admin-configurable)
