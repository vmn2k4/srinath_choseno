# Authentication & Account Management

User registration, login, role assignment, and session management patterns in Choseno.

---

## Overview

- **Email + password only** (no OAuth/social login in current version)
- **Three account roles**: Citizen (`'normal'`), Politician (`'politician'`), Admin (`'admin'`)
- **Supabase Auth** backend, with custom `profiles` table extending user metadata
- **Role switching**: Citizens can become politicians anytime from Profile page; no separate signup path

---

## Authentication Lifecycle

### 1. Sign Up (`/auth`)

**Form**: Email + password (both required)

**Flow**:
```
User fills form → POST /auth/signup
  ↓ (Supabase auth.signUp)
  Email confirmation email sent (if email verification enabled)
  ↓
Redirect to `/onboarding` (regardless of confirmation status)
```

**Behind the scenes**:
- `signUp()` in `src/lib/services/auth.ts` calls Supabase `auth.signUp()`
- Auto-creates a `profiles` row with:
  - `id` = user's `auth.users.id` (UUID)
  - `role` = `'normal'` (default citizen)
  - `onboarding_completed` = `false`
- No confirmation flow blocks progress (email verification can be optional per project config)

### 2. Onboarding (`/onboarding`)

**Required first-run flow** (checked by middleware; redirects back if skipped).

**Steps** (see SCREENS_AND_FEATURES.md for detail):
1. **Role** — Citizen or Politician?
2. **Location** — Auto-detect or manual boundary selection
3. **Username** — Optional for citizens, required for politicians
4. **Political Details** (politicians only) — Party, education, hometown, bio

**On submit**:
- Upsert `profiles` with all collected data
- Call `sync_user_boundary_memberships(profile_id)` to populate `user_boundary_memberships`
- Set `onboarding_completed = true`
- Hard-reload to `/feed`

**Role toggle** (Citizens ↔ Politician):
- From Profile page (`/profile`), click "Become a Politician" (citizen) or "Switch to Citizen" (politician)
- Opens a modal with a subset of onboarding: just Location + Political Details if switching to politician
- Updates `profiles.role` immediately

### 3. Login (`/auth`)

**Form**: Email + password (both required)

**Flow**:
```
User fills form → POST /auth/login
  ↓ (Supabase auth.signInWithPassword)
  ↓
Check profiles.onboarding_completed
  ├─ false → Redirect to `/onboarding`
  └─ true → Redirect to `/feed` (or referrer)
```

**Session management**:
- Supabase session stored in browser (localStorage by default)
- `AuthContext` wraps the whole app, listens to `auth.onAuthStateChange`
- On app load, context re-hydrates session + fetches current profile

### 4. Session Recovery

**On app load** (`AuthContext.useEffect`):
```ts
const { data: session } = await supabase.auth.getSession();
if (session) {
  // User is logged in; fetch their profiles row
  const { data: profile } = await getProfile(supabase);
  if (!profile?.onboarding_completed) {
    // Onboarding incomplete; force the flow
    redirect('/onboarding');
  }
}
```

---

## Session State Management

### `AuthContext` (`src/contexts/AuthContext.tsx`)

Exposes:
```ts
const {
  user,              // auth.users row (id, email, ...)
  profile,           // profiles row (role, onboarding_completed, ...)
  session,           // active session
  isLoading,         // hydration in progress
  isAuthenticated,   // user != null
  signUp,
  signIn,
  signOut,
  reloadProfile      // Refetch profile after changes
} = useAuthContext();
```

**Subscription**:
- Listens to `auth.onAuthStateChange` (real-time session updates)
- On state change, re-fetches profile (handles role/boundary changes immediately)

### Usage in Components

```tsx
import { useAuthContext } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const { profile, isAuthenticated } = useAuthContext();
  
  if (!isAuthenticated) return <Redirect to="/auth" />;
  if (!profile) return <Spinner />;
  
  return <p>Hello, {profile.full_name} ({profile.role})</p>;
}
```

---

## Email Verification (Optional)

**Current config**: Verification emails are sent but not required to proceed.

**If verification is enabled** (future):
- Add a `/auth/verify` screen
- User lands there after signup, prompted to check email
- Link in email calls `/auth/callback?code=...` (Supabase callback handler)
- On verification, `auth.updateUser()` sets `email_confirmed_at`
- RLS can gate features to `email_confirmed_at IS NOT NULL`

**Current callback route** (`src/app/auth/callback/route.ts`):
- Handles Supabase OAuth/magic-link redirects (placeholder for future OAuth)
- Not used yet; email/password doesn't require callback

---

## Multi-Device Sessions

**By design**: One session per device/browser.

- Sign in on Phone A → session stored on Phone A
- Sign in on Phone B → separate session stored on Phone B
- Both sessions valid simultaneously
- No "sign out other devices" feature (future enhancement)

**Logout behavior**:
- `signOut()` calls `supabase.auth.signOut()`
- Revokes current session token
- Clears localStorage
- Other devices' sessions unaffected

---

## Role-Based Access Control

**In middleware / route guards**:

```ts
// Pages can check role at render time
if (profile?.role !== 'admin') {
  return <p>Admins only</p>;
}

// Or use RLS in services
const { data } = await supabase
  .from('admin_only_table')
  .select(...)
  .limit(1);
// Returns [] if user.role != 'admin' (RLS policy blocks it)
```

**Three-tier policy**:
1. **Page-level**: Route `/admin/*` redirects non-admins to `/feed`
2. **Component-level**: Features hidden/disabled per role
3. **DB-level (RLS)**: Supabase policies enforce at the row level

---

## Password Reset (Future)

**Not implemented yet.**

When needed, add:
1. `/auth/forgot` page (email input)
2. `supabase.auth.resetPasswordForEmail(email)`
3. Email template with reset link
4. `/auth/reset?code=...` handler
5. `supabase.auth.updateUser({ password: newPassword })`

---

## Magic Links / Email-Only Auth (Future)

**Not implemented yet.**

When adding, use:
```ts
await supabase.auth.signInWithOtp({ email });
// User gets email with one-time link
// Link bounces to /auth/callback?code=...
// Session created automatically
```

---

## Related Files

| File | Purpose |
|---|---|
| [`src/contexts/AuthContext.tsx`](../src/contexts/AuthContext.tsx) | Session + profile state |
| [`src/lib/services/auth.ts`](../src/lib/services/auth.ts) | Auth service functions |
| [`src/app/auth/page.tsx`](../src/app/auth/page.tsx) | Login/signup form |
| [`src/app/onboarding/page.tsx`](../src/app/onboarding/page.tsx) | Onboarding flow |
| [`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts) | OAuth/magic-link handler |
| [`src/lib/supabase/types.ts`](../src/lib/supabase/types.ts) | Supabase TypeScript types |

---

## Security Notes

- **Passwords**: Stored hashed in Supabase auth (bcrypt). Never sent to frontend.
- **Session tokens**: Stored in localStorage; vulnerable to XSS. Future: HttpOnly cookies.
- **RLS**: Every data query is protected by Supabase policies; role is checked server-side.
- **Email in forms**: Never logged. Passwords only in network requests (HTTPS).

---

## Debugging Auth Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Onboarding loop" | Session exists but profile fetch fails | Check profiles table has a row for user.id |
| "Role not updating immediately" | AuthContext didn't re-fetch profile | Call `reloadProfile()` after role change |
| "Not redirected to /onboarding" | Middleware not running / NextAuth not configured | Check .env has NEXT_PUBLIC_SUPABASE_URL |
| "Password reset link doesn't work" | Magic-link flow not implemented | See "Password Reset" section above |

---

## Future Enhancements

- [ ] OAuth (Google, GitHub) for faster signup
- [ ] Email verification required
- [ ] Two-factor authentication (SMS/TOTP)
- [ ] Sessions dashboard (see active sessions, logout others)
- [ ] Account recovery with security questions
- [ ] Password strength meter
