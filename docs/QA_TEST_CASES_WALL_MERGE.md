# QA Test Plan: Wall Merge & Claim System

**Status**: Ready for QA Execution  
**Created**: 2026-08-12  
**Scope**: Officeholder walls, politician walls (candidates), new users, existing users, admin-initiated, self-requested

## Test Strategy

### Coverage Matrix

| Wall Type | New User | Existing User |
|-----------|----------|---------------|
| **Officeholder (Admin-Initiated)** | TC-OW-AU-01 to 07 | TC-OW-EU-08 to 14 |
| **Officeholder (Self-Requested)** | TC-OW-SU-01 to 07 | TC-OW-SE-08 to 14 |
| **Politician/Candidate (Admin)** | TC-PW-AU-01 to 05 | TC-PW-EU-06 to 10 |
| **Politician/Candidate (Self)** | TC-PW-SU-01 to 05 | TC-PW-SE-06 to 10 |

**Total Test Cases**: 60+

### Test Execution Approach

1. **Phase 1**: New user officeholder claims (admin-initiated + self-requested)
2. **Phase 2**: Existing user officeholder claims (admin-initiated + self-requested)
3. **Phase 3**: Politician/candidate claims (all variations)
4. **Phase 4**: Edge cases and error handling
5. **Phase 5**: Reversal and cleanup scenarios

---

## SECTION 1: OFFICEHOLDER WALL CLAIMS — NEW USERS

### TC-OW-AU-01: Admin Invite → New User Signup → Auto-Merge

**Type**: Officeholder Wall | Admin-Initiated | New User | Happy Path

**Preconditions**:
- Unclaimed officeholder wall exists (e.g., Laxman Savadi, MLA, Athani)
- Test email: chosenovoter1@mailsac.com (new Choseno account)
- Admin account logged in (vmn2k4@gmail.com)

**Steps**:
1. Admin navigates to `/admin/office-holders`
2. Admin enters wall URL: `https://www.choseno.com/wall/laxman-savadi-mla`
3. Admin enters email: `chosenovoter1@mailsac.com`
4. Admin clicks "Send Invite"
5. Check mailsac inbox: `https://mailsac.com/inbox/chosenovoter1@mailsac.com`
6. Click "New to Choseno — sign up" link in email
7. Sign up with:
   - Email: chosenovoter1@mailsac.com
   - Password: TestVoter_Pass!2024
   - Name: Test Voter One
8. Complete signup form and submit
9. Claim link triggers automatically (`/officeholder-claim/{token}`)
10. Wait for redirect to home page
11. Check `/profile` page

**Expected Results**:
- ✅ Email received within 30 seconds
- ✅ Email contains dual-link chooser (sign up + login options)
- ✅ Signup completes successfully
- ✅ Claim auto-merges (RPC returns `status: "approved"`)
- ✅ Success page shows: **"Wall claimed — Your identity is verified and the wall is now yours"**
- ✅ Profile page shows:
  - Role: `politician`
  - Wall slug: `user-mla` (or similar auto-generated)
  - Political target role: `MLA`
  - Target boundary: `Athani`
  - Contact info from officeholder (email, phone if available)
- ✅ Old wall URL redirects: `/wall/laxman-savadi-mla` → `/wall/user-mla`
- ✅ New wall displays claimant's account
- ✅ Posts/ratings from original wall carried over

**Pass Criteria**: All 8 results ✅

**Test Data**:
- Officeholder: Laxman Savadi (f873ea5d-51a0-4231-b0ab-6d94149451d4)
- Test email: chosenovoter1@mailsac.com
- Expected claim ID: (check database after merge)

---

### TC-OW-AU-02: Admin Invite → Existing User (Different Email) → Merge

**Type**: Officeholder Wall | Admin-Initiated | New User (with existing Choseno account) | Happy Path

**Preconditions**:
- Unclaimed officeholder wall exists (e.g., Raju Kage, MLA, Belagavi)
- Test account exists: testaccount@example.com (citizen role)
- Admin invites to a DIFFERENT email than account: testaccount+officer@example.com
- Admin account logged in

**Steps**:
1. Admin sends invite to: testaccount+officer@example.com
2. User checks email, sees dual-link chooser
3. User clicks "I already have an account — merge into it"
4. User redirected to `/auth?role=politician&intent=login&next=/officeholder-claim/{token}`
5. User logs in as: testaccount@example.com / existing-password
6. Claim auto-merges
7. Check `/profile` — should show politician role + officeholder data

**Expected Results**:
- ✅ Dual-link routes to Login tab correctly
- ✅ Existing account can log in despite different invite email
- ✅ Claim still auto-merges (no manual merge needed)
- ✅ Profile promoted from citizen → politician
- ✅ Officeholder data prefilled (only NULL fields filled, existing data kept)
- ✅ Wall shows existing account data + officeholder badge

**Pass Criteria**: All 6 results ✅

**Note**: This tests the "email is not identity proof" design principle — email just proves you control that inbox, not that it's your main account.

---

### TC-OW-AU-03: Admin Invite → New User Google Sign-In → Auto-Merge

**Type**: Officeholder Wall | Admin-Initiated | New User | OAuth Path

**Preconditions**:
- Unclaimed officeholder wall exists
- Admin sends invite to: testgoogle@gmail.com (new Choseno account, has Google)
- No Choseno account yet under that email

**Steps**:
1. Admin sends invite to testgoogle@gmail.com
2. User receives email, clicks "New to Choseno — sign up"
3. User redirected to `/auth?role=politician&next=/officeholder-claim/{token}`
4. User clicks "Continue with Google"
5. Google OAuth flow completes
6. Redirected to `/officeholder-claim/{token}` with new session
7. Claim auto-merges

**Expected Results**:
- ✅ Google sign-in preserves `next` parameter
- ✅ Claim still auto-merges after OAuth signup
- ✅ Profile prefilled from officeholder
- ✅ Success message shows "Wall claimed"

**Pass Criteria**: All 4 results ✅

---

### TC-OW-AU-04: Admin Invite → New User Uses Same Email as Invite

**Type**: Officeholder Wall | Admin-Initiated | New User | Email Consistency

**Preconditions**:
- Unclaimed officeholder wall exists
- Admin invites: newtestuser@example.com
- No Choseno account under that email yet

**Steps**:
1. Admin sends invite to: newtestuser@example.com
2. User receives email, clicks "New to Choseno — sign up"
3. On signup form, uses SAME email: newtestuser@example.com
4. Completes signup with password
5. Claim auto-merges
6. Login later with same email/password

**Expected Results**:
- ✅ Signup accepts the invited email
- ✅ Claim auto-merges
- ✅ Can log back in with email/password used at signup
- ✅ Profile shows politician role + officeholder data

**Pass Criteria**: All 4 results ✅

---

### TC-OW-AU-05: Admin Invite Link Expires (7 Days)

**Type**: Officeholder Wall | Admin-Initiated | New User | Expiry

**Preconditions**:
- Admin created invite 6.5 days ago
- Invite still valid (not yet expired)
- Manually set `expires_at` in database to 6 hours from now

**Steps**:
1. User receives invite email (from 6.5 days ago)
2. User clicks link
3. Wait 6+ hours (or manually set time forward in test environment)
4. User attempts to redeem (tries to load `/officeholder-claim/{token}` again)
5. Claim redemption RPC called with old token

**Expected Results**:
- ✅ Before expiry: claim redeems successfully, auto-merges
- ✅ After expiry: error message: "claim invitation is invalid, used, cancelled, or expired"
- ✅ Profile is NOT created/modified after expiry
- ✅ Admin can resend a new invite

**Pass Criteria**: All 4 results ✅

---

### TC-OW-AU-06: Admin Invite → Token Already Used (Race Condition)

**Type**: Officeholder Wall | Admin-Initiated | New User | Race Condition

**Preconditions**:
- Admin sent one invite with token T1 to: user1@example.com and user2@example.com (simulation)
- Actually: same token T1, but two different claim IDs (shouldn't happen, but edge case)

**Steps**:
1. User 1 receives invite with token T1
2. User 1 signs up and redeems token T1 successfully
3. User 2 (simultaneously or shortly after) tries to use same token T1
4. User 2 attempts to redeem with same token hash

**Expected Results**:
- ✅ User 1: claim auto-merges successfully, status = approved
- ✅ User 2: redemption rejected with error: "claim invitation is invalid, used, cancelled, or expired"
- ✅ User 2's profile is NOT modified
- ✅ Officeholder wall still owned by User 1
- ✅ Admin can send a new invite for User 2 if needed

**Pass Criteria**: All 5 results ✅

---

### TC-OW-AU-07: Admin Invite → User Cancels Before Redeeming → Resend Works

**Type**: Officeholder Wall | Admin-Initiated | New User | Resend

**Preconditions**:
- Admin sent invite to: newuser@example.com
- First invite token: T1
- Claim in status `invited`

**Steps**:
1. User receives invite with token T1, clicks link
2. User sees dual-link chooser, closes browser (doesn't complete signup)
3. Admin realizes need to resend, clicks "Resend" in Invitation History
4. New invite email sent with token: T2
5. User signs up using new link with T2
6. Claim auto-merges

**Expected Results**:
- ✅ First invite remains valid (T1 not consumed yet)
- ✅ Second invite created with T2
- ✅ User can redeem with T2 successfully
- ✅ T1 can still be used (or marked expired, depending on design)
- ✅ Claim auto-merges with T2
- ✅ Only ONE claim per officeholder active (constraint enforced)

**Pass Criteria**: All 6 results ✅

---

## SECTION 2: OFFICEHOLDER WALL CLAIMS — EXISTING USERS

### TC-OW-EU-08: Existing User Logs In → Claim Auto-Merges

**Type**: Officeholder Wall | Admin-Initiated | Existing User | Happy Path

**Preconditions**:
- Existing Choseno account: existinguser@example.com (citizen role, created previously)
- Unclaimed officeholder wall: Nikhil Katti, MLA
- Admin sends invite to: existinguser@example.com

**Steps**:
1. Admin sends invite to: existinguser@example.com
2. Existing user receives invite email
3. User clicks "I already have an account — merge into it"
4. User redirected to `/auth?role=politician&intent=login&next=/officeholder-claim/{token}`
5. Login form tab is pre-selected ("Welcome Back")
6. User logs in: existinguser@example.com / password123
7. Claim auto-merges
8. Redirect to `/officeholder-claim/{token}` with new session
9. Check `/profile`

**Expected Results**:
- ✅ Login tab pre-selected in auth form
- ✅ User logs in successfully
- ✅ Profile role promoted: citizen → politician
- ✅ Claim auto-merges (status = approved)
- ✅ Wall slug generated: `user-mla-XXXXX` (with unique suffix if collision)
- ✅ Old profile data preserved (e.g., bio, any existing wall_slug for candidate claims)
- ✅ Officeholder data gap-filled (only fills NULL fields)
- ✅ Success page shows: "Wall claimed"
- ✅ Officeholder wall now owned by existing user

**Pass Criteria**: All 8 results ✅

---

### TC-OW-EU-09: Existing Politician (Candidate) → Claims Officeholder Wall

**Type**: Officeholder Wall | Admin-Initiated | Existing User (already politician) | Role Promotion

**Preconditions**:
- Existing account: poluser@example.com
- Already has politician role (from candidate claim or self-registered)
- Already has a wall_slug: `existing-politician`
- Unclaimed officeholder wall: Duryodhan Aihole, Councillor

**Steps**:
1. Admin sends invite to: poluser@example.com (existing politician)
2. User logs in via invite link
3. Claim auto-merges
4. Check profile

**Expected Results**:
- ✅ Role remains politician (no change)
- ✅ Old wall_slug preserved: `existing-politician` (not overwritten)
- ✅ Officeholder data gap-filled (but doesn't overwrite existing wall_slug)
- ✅ Success page shows: "Wall claimed"
- ✅ Check `/wall/existing-politician` — should still show their original politician profile
- ✅ Check `/wall/duryodhan-aihole-councillor` — redirects to their new wall
- ✅ Database: profile has multiple wall references (but linked_profile_id points to new one for officeholder)

**Pass Criteria**: All 7 results ✅

**Note**: This tests COALESCE protection — existing politician data not overwritten by officeholder data.

---

### TC-OW-EU-10: Existing User Logs In, Then Chooses to Sign Up (Both Links Available)

**Type**: Officeholder Wall | Admin-Initiated | Existing User | UX Path

**Preconditions**:
- Existing Choseno account: existinguser2@example.com
- Claim invite sent to: existinguser2@example.com
- Unclaimed officeholder wall

**Steps**:
1. User receives invite, no login yet
2. User clicks `/officeholder-claim/{token}` directly (or from email)
3. User NOT logged in, sees dual-link chooser
4. User chooses: "New to Choseno — sign up" (even though they have account)
5. Redirect to `/auth?role=politician&next=/officeholder-claim/{token}`
6. User sees Sign Up tab by default
7. User enters email: existinguser2@example.com
8. Get error: "Email already exists"
9. User goes back, clicks "Welcome Back" or "I already have an account" link
10. Signs in with password

**Expected Results**:
- ✅ Dual-link chooser shown for logged-out users
- ✅ Sign Up link routes to sign-up form
- ✅ System detects email conflict: "Email already exists"
- ✅ User can navigate to login form
- ✅ User logs in successfully
- ✅ Claim auto-merges after login

**Pass Criteria**: All 6 results ✅

---

### TC-OW-EU-11: Existing User with Different Email → Claim Auto-Merges

**Type**: Officeholder Wall | Admin-Initiated | Existing User | Email Mismatch

**Preconditions**:
- Existing account: user@gmail.com (citizen)
- Invite sent to: user+officeholder@gmail.com (same person, different alias)
- Unclaimed officeholder wall

**Steps**:
1. Admin sends invite to: user+officeholder@gmail.com
2. User receives invite but doesn't recognize +officeholder part
3. User clicks "I already have an account — merge into it"
4. User logs in with: user@gmail.com
5. Claim auto-merges

**Expected Results**:
- ✅ Claim redeems successfully despite email mismatch
- ✅ Token proves email control (not identity)
- ✅ User can authenticate with different email
- ✅ Claim auto-merges with logged-in session
- ✅ Profile updated with officeholder data

**Pass Criteria**: All 5 results ✅

**Design Note**: Email in invite is for delivery only, not identity proof. Actual identity is auth session.

---

### TC-OW-EU-12: Existing User Tries to Claim Own Officeholder Wall (Admin Account)

**Type**: Officeholder Wall | Admin-Initiated | Existing User | Permission Denied

**Preconditions**:
- Admin account: vmn2k4@gmail.com (role = admin)
- Admin tries to claim an officeholder wall
- Claim invite sent to: vmn2k4@gmail.com

**Steps**:
1. Admin sends invite to their own admin account
2. Admin logs in via claim link
3. RPC `redeem_officeholder_wall_claim()` called
4. Check response

**Expected Results**:
- ✅ Error: "admin accounts cannot claim an officeholder wall"
- ✅ Profile is NOT promoted to politician
- ✅ Claim is NOT merged
- ✅ Officeholder wall remains unclaimed

**Pass Criteria**: All 4 results ✅

---

### TC-OW-EU-13: Existing User Loses Access → Admin Sends New Invite

**Type**: Officeholder Wall | Admin-Initiated | Existing User | Password Reset

**Preconditions**:
- User previously claimed officeholder wall
- User forgot password
- Admin needs to invalidate old claim and resend

**Steps**:
1. User tries to log in, forgotten password
2. User attempts password reset (if available) or contact admin
3. Admin decides to send new invite to re-verify
4. Admin calls `cancel_officeholder_wall_claim()` for old claim
5. Admin creates new invite with `create_officeholder_wall_claim()`
6. Admin sends new invite to user
7. User receives new email, redeems new invite

**Expected Results**:
- ✅ Old claim status: `cancelled` or `expired`
- ✅ New invite created
- ✅ User can redeem new invite and re-establish claim
- ✅ New claim auto-merges
- ✅ Officeholder wall still owned by user

**Pass Criteria**: All 5 results ✅

---

### TC-OW-EU-14: Claim Auto-Merge Fails (Fallback to Pending Review)

**Type**: Officeholder Wall | Admin-Initiated | Existing User | Edge Case

**Preconditions**:
- Existing user account
- Officeholder wall linked to user A
- Admin creates invite for user B
- Between invite creation and token redemption, officeholder is reassigned to user C

**Steps**:
1. Admin sends invite to user B for officeholder wall (currently owned by A)
2. Before user B redeems, admin manually changes officeholder link: A → C
3. User B receives invite, logs in
4. User B redeems token
5. RPC `redeem_officeholder_wall_claim()` executes
6. Auto-merge attempts but fails (officeholder link changed)
7. Exception caught, claim left at `pending_review`
8. Check response status

**Expected Results**:
- ✅ Redemption succeeds (no error to user)
- ✅ Returned status: `pending_review` (not `approved`)
- ✅ Success page shows: "Claim submitted... administrator will review"
- ✅ User profile still promoted to politician
- ✅ Profile still prefilled from officeholder
- ✅ Admin can later manually merge or reject in `/admin/office-holders`
- ✅ User login/signup NOT broken by merge failure

**Pass Criteria**: All 7 results ✅

**Design Note**: Graceful fallback ensures user experience never breaks due to merge failure.

---

## SECTION 3: OFFICEHOLDER WALL CLAIMS — SELF-REQUESTED

### TC-OW-SU-01: New User Self-Requests Officeholder Wall (No Admin Invite)

**Type**: Officeholder Wall | Self-Requested | New User | Pending Review Path

**Preconditions**:
- Unclaimed officeholder wall: Shashikala Jolle, MLA
- User not logged in yet
- No admin invite sent

**Steps**:
1. User navigates to `/wall/shashikala-jolle-mla` (public wall)
2. User not logged in, clicks "Claim This Wall" button
3. System checks eligibility via `get_wall_claim_eligibility()`
4. User redirected to `/auth?role=politician&next=<wall-url>` (sign up)
5. User creates new account: selfuser@example.com / password
6. After signup, user on wall page
7. User clicks "Claim This Wall" button again
8. Modal appears: "Request to Claim This Wall"
9. User fills form:
   - Contact email: selfuser@example.com
   - Phone: 555-1234
   - Note: "I am the actual Shashikala Jolle"
10. User submits form
11. RPC `request_officeholder_wall_claim()` called
12. Check claim status in database
13. Admin reviews claim in `/admin/office-holders`

**Expected Results**:
- ✅ Claim button only shows on unclaimed walls
- ✅ Redirects logged-out user to signup
- ✅ After signup, claim button still available
- ✅ Form modal appears with contact + note fields
- ✅ Claim created with status: `pending_review` (NOT auto-merged)
- ✅ Metadata includes `self_requested: true`
- ✅ Profile promoted: citizen → politician
- ✅ Profile prefilled from officeholder (same as redemption)
- ✅ Admin sees claim in "Pending Self-Requested Claims" panel
- ✅ Admin can review contact info + note before merging
- ✅ Admin clicks "Merge wall" to approve (manual merge required)

**Pass Criteria**: All 11 results ✅

---

### TC-OW-SU-02: Existing User Self-Requests Officeholder Wall

**Type**: Officeholder Wall | Self-Requested | Existing User | Pending Review Path

**Preconditions**:
- Existing account: existingcitizen@example.com (citizen role)
- Unclaimed officeholder: Balachandra Jarkiholi, Councillor

**Steps**:
1. User logged in as existingcitizen@example.com
2. User navigates to `/wall/balachandra-jarkiholi-councillor`
3. User clicks "Claim This Wall"
4. Modal appears with form
5. User fills contact info + note
6. User submits
7. Check profile and claim status

**Expected Results**:
- ✅ Claim button visible on unclaimed wall
- ✅ Modal appears immediately (already logged in)
- ✅ Claim created with status: `pending_review`
- ✅ Profile role promoted: citizen → politician
- ✅ Metadata includes `self_requested: true`
- ✅ Contact info from form saved to claim
- ✅ Admin can review via `list_pending_self_requested_officeholder_claims()`
- ✅ Manual merge required (no auto-merge for self-requests)

**Pass Criteria**: All 8 results ✅

---

### TC-OW-SU-03: Self-Request Rejected by Admin

**Type**: Officeholder Wall | Self-Requested | Any User | Admin Rejection

**Preconditions**:
- Self-requested claim in status: `pending_review`
- Claim ID: (from TC-OW-SU-01 or TC-OW-SU-02)
- Admin decides claim is fraudulent/unverifiable

**Steps**:
1. Admin navigates to `/admin/office-holders`
2. Admin finds claim in "Review" status
3. Admin clicks "Reject" (or similar button)
4. Modal appears: "Reject Claim"
5. Admin enters reason: "Unable to verify identity"
6. Admin submits rejection
7. Check claim status and claimant's profile

**Expected Results**:
- ✅ Claim status: `rejected`
- ✅ Claim metadata includes: `rejected_at`, `rejected_by`, `rejection_reason`
- ✅ Profile fields nulled: bio, political_target_role, target_boundary_name, contact_email, etc.
- ✅ Wall_slug set to NULL (or kept if it was their own)
- ✅ Claimant's profile NOT deleted (role remains politician)
- ✅ Officeholder wall remains unclaimed (for next attempt)
- ✅ Claimant can later retry with `request_officeholder_wall_claim()`

**Pass Criteria**: All 7 results ✅

---

### TC-OW-SU-04: Admin Merges Self-Requested Claim

**Type**: Officeholder Wall | Self-Requested | Any User | Admin Merge

**Preconditions**:
- Self-requested claim in status: `pending_review`
- Admin reviewed contact info and verified identity
- Claim ID ready to merge

**Steps**:
1. Admin navigates to claim in `/admin/office-holders`
2. Admin can see claim details: contact email, note, claimed_at timestamp
3. Admin clicks "Merge wall" button
4. Modal appears showing merge preview:
   - Posts to move: N
   - Comments: N
   - Ratings: N
   - Supporters: N
5. Admin clicks "Confirm Merge"
6. Merge RPC executes
7. Check claim status and wall ownership

**Expected Results**:
- ✅ Merge preview shows accurate counts
- ✅ Merge completes successfully
- ✅ Claim status: `approved`
- ✅ approved_at, approved_by set
- ✅ Officeholder wall now owned by claimant
- ✅ Posts/comments/ratings moved to claimant's ghost
- ✅ Old wall URL redirects to new wall
- ✅ All items tracked in `office_holder_wall_claim_items`

**Pass Criteria**: All 8 results ✅

---

### TC-OW-SU-05: Duplicate Self-Request → Second Rejected

**Type**: Officeholder Wall | Self-Requested | Same User | Constraint Check

**Preconditions**:
- User already has pending self-request on officeholder A
- Claim is still in status: `pending_review`

**Steps**:
1. User navigates to same officeholder wall
2. User clicks "Claim This Wall" again
3. Modal appears or error shown
4. If allowed, user submits second claim
5. RPC `request_officeholder_wall_claim()` called again

**Expected Results**:
- ✅ Either: Claim button hidden (ineligible check via `get_wall_claim_eligibility()`)
- ✅ Or: Second request blocked with error: "this wall already has a pending or approved claim"
- ✅ Unique constraint enforced: `office_holder_wall_claims_one_open_claim_idx`
- ✅ User gets clear error message
- ✅ Only ONE pending claim per officeholder

**Pass Criteria**: All 5 results ✅

---

## SECTION 4: POLITICIAN/CANDIDATE WALL CLAIMS

### TC-PW-AU-01: Admin Invites User to Unregistered Candidate Wall (Existing System)

**Type**: Politician/Candidate Wall | Admin-Initiated | New User | Election Candidacy

**Preconditions**:
- Unclaimed `election_candidates` stub (created by election admin)
- Candidate name: Jane Smith, District 5
- Status: `claimed_at IS NULL`
- No Choseno account yet

**Steps**:
1. Admin navigates to candidate wall: `/wall/jane-smith-candidate`
2. Admin checks eligibility via `get_wall_claim_eligibility()`
3. Response: `unclaimed_candidate` with candidate_id
4. Admin creates invite (via existing election flow)
5. User receives email, signs up
6. User redeems token
7. RPC `finalize_candidate_claim()` called
8. Check profile and claim status

**Expected Results**:
- ✅ Eligibility check routes to candidacy system (not officeholder)
- ✅ Claim created in `candidacy_claim_requests` (existing table)
- ✅ User profile promoted to politician
- ✅ Candidate record updated: `claimed_at` set
- ✅ Behavior differs from officeholder (different review model)

**Pass Criteria**: All 5 results ✅

**Note**: Candidate claims are a separate system; this test confirms routing works.

---

### TC-PW-AU-02: Generic Politician Wall (No Candidacy Stub)

**Type**: Politician Wall | Admin-Initiated | New User | Generic Wall

**Preconditions**:
- Politician profile with no `election_candidates` stub
- No officeholder link
- Wall is claimable only via self-service
- No admin invite option

**Steps**:
1. Admin navigates to generic politician wall
2. System checks eligibility: no candidate stub, no officeholder
3. Result: `not_claimable`
4. Claim button should NOT show on public wall

**Expected Results**:
- ✅ Eligibility check returns `not_claimable`
- ✅ No claim button shown to users
- ✅ Wall cannot be claimed (already has owner)
- ✅ Admin cannot send invite for this wall via standard flow

**Pass Criteria**: All 4 results ✅

---

### TC-PW-SU-01: User Self-Requests Candidate Wall

**Type**: Politician/Candidate Wall | Self-Requested | Existing User | Candidacy Path

**Preconditions**:
- Unclaimed candidate wall
- User already has Choseno account
- No admin invite

**Steps**:
1. User navigates to unclaimed candidate wall
2. User clicks "Claim This Wall"
3. System routes to `get_wall_claim_eligibility()` → `unclaimed_candidate`
4. Form appears for candidate claim (existing UI)
5. User fills form (phone, campaign info, etc.)
6. User submits
7. Check `candidacy_claim_requests` table

**Expected Results**:
- ✅ Eligibility check routes to correct candidate system
- ✅ Existing candidate claim form used (no changes)
- ✅ Claim routed to `request_candidacy_claim()` (existing RPC)
- ✅ Seat admin reviews (not site admin)
- ✅ Claim lands in `pending_review` status

**Pass Criteria**: All 5 results ✅

---

### TC-PW-EU-06: Already-Owned Politician Wall → No Claim Button

**Type**: Politician Wall | Any Initiation | Any User | Already Owned

**Preconditions**:
- Politician wall fully owned by a real, authenticated user
- Wall has `linked_profile_id` pointing to real profile
- No unclaimed stub, no officeholder record

**Steps**:
1. User (not owner) navigates to already-owned politician wall
2. System checks eligibility via `get_wall_claim_eligibility()`
3. Check if "Claim" button appears

**Expected Results**:
- ✅ Eligibility check returns `not_claimable`
- ✅ No "Claim This Wall" button shown
- ✅ User cannot initiate a claim
- ✅ Wall appears fully owned

**Pass Criteria**: All 4 results ✅

---

## SECTION 5: MERGE & CONTENT REASSIGNMENT

### TC-MG-01: Wall Merge Carries Over Posts

**Type**: Merge | Content Reassignment | Posts

**Preconditions**:
- Officeholder wall with 5+ posts
- Posts have various timestamps, ghosts, etc.
- Claim ready to merge

**Steps**:
1. Check source wall posts via `get_wall_posts()` (internal query)
2. Admin merges claim via `merge_officeholder_wall_claim()`
3. Check target wall posts
4. Compare counts and content

**Expected Results**:
- ✅ All posts moved from source ghost → target ghost
- ✅ Post counts match: source 5 posts → target 5 posts
- ✅ Source wall posts now show under target profile
- ✅ Post content unchanged
- ✅ Timestamps preserved
- ✅ Each post tracked in `office_holder_wall_claim_items`

**Pass Criteria**: All 6 results ✅

**Test Data**: Check real posts on wall before/after via:
```sql
SELECT COUNT(*) FROM posts WHERE wall_ghost_id = '<source_ghost_id>';
SELECT COUNT(*) FROM posts WHERE wall_ghost_id = '<target_ghost_id>';
```

---

### TC-MG-02: Wall Merge Carries Over Comments

**Type**: Merge | Content Reassignment | Comments

**Preconditions**:
- Officeholder wall with posts + comments
- Comments on multiple posts
- Claim ready to merge

**Steps**:
1. Count comments on source ghost
2. Admin merges claim
3. Count comments on target ghost
4. Verify comment content

**Expected Results**:
- ✅ All comments moved to target ghost
- ✅ Comment counts match
- ✅ Comments remain tied to their posts
- ✅ Comment content unchanged
- ✅ Each comment tracked in audit table

**Pass Criteria**: All 5 results ✅

---

### TC-MG-03: Wall Merge Carries Over Ratings

**Type**: Merge | Content Reassignment | Ratings

**Preconditions**:
- Source politician profile with ratings (e.g., 3x 5-star, 2x 4-star)
- Total rating score: average 4.6
- Claim ready to merge

**Steps**:
1. Check ratings on source profile
2. Admin merges claim
3. Check ratings on target profile
4. Verify average score

**Expected Results**:
- ✅ All ratings moved from source → target
- ✅ Rating counts match
- ✅ Scores preserved
- ✅ Average rating recalculated correctly
- ✅ Rater profiles linked to new target

**Pass Criteria**: All 5 results ✅

---

### TC-MG-04: Wall Merge Carries Over Supporters

**Type**: Merge | Content Reassignment | Supporters

**Preconditions**:
- Source profile with 10 supporters
- Claim ready to merge

**Steps**:
1. Count supporters on source profile
2. Admin merges claim
3. Count supporters on target profile
4. Check supporter IDs

**Expected Results**:
- ✅ All supporters moved
- ✅ Supporter counts match: source 10 → target 10
- ✅ Duplicate prevention: if target already has some supporters, don't double-add
- ✅ Supporter records show new politician_id

**Pass Criteria**: All 4 results ✅

---

### TC-MG-05: Wall Merge with Partial Content (Posts Exist, No Ratings)

**Type**: Merge | Content Reassignment | Partial

**Preconditions**:
- Source wall has posts but no ratings/supporters
- Claim ready to merge

**Steps**:
1. Admin merges claim
2. Check merged content

**Expected Results**:
- ✅ Posts moved successfully
- ✅ No error for missing ratings/supporters
- ✅ Merge completes without issues
- ✅ Only existing content moved

**Pass Criteria**: All 4 results ✅

---

## SECTION 6: REVERSAL & UNDO

### TC-RV-01: Admin Reverses Approved Claim

**Type**: Reversal | Post-Merge Undo | Full Reversal

**Preconditions**:
- Claim status: `approved` (already merged)
- Claim has moved posts, comments, supporters, ratings
- Items tracked in `office_holder_wall_claim_items`

**Steps**:
1. Admin navigates to claim in `/admin/office-holders`
2. Admin clicks "Reverse" or "Undo Merge" button
3. Modal appears: "Reverse Claim?"
4. Shows summary of content to be restored
5. Admin enters reason: "Merged in error"
6. Admin confirms
7. RPC `reverse_officeholder_wall_claim()` executes
8. Check claim status and wall ownership

**Expected Results**:
- ✅ Claim status: `reversed`
- ✅ reversed_at, reversed_by set
- ✅ Reversal reason stored
- ✅ Posts restored to source ghost
- ✅ Comments restored to source ghost
- ✅ Supporters restored to source profile
- ✅ Ratings restored to source profile
- ✅ Officeholder wall ownership reverted
- ✅ Target profile keeps their own data (just removes moved items)
- ✅ All reversals tracked in `office_holder_wall_claim_items.reversed_at`

**Pass Criteria**: All 10 results ✅

---

### TC-RV-02: Reversal Fails if Claim Not Approved

**Type**: Reversal | Edge Case | Invalid Status

**Preconditions**:
- Claim status: `pending_review` (not yet approved)

**Steps**:
1. Admin tries to reverse claim
2. RPC `reverse_officeholder_wall_claim()` called

**Expected Results**:
- ✅ Error: "only an approved claim can be reversed"
- ✅ Claim status unchanged
- ✅ No content moved

**Pass Criteria**: All 3 results ✅

---

### TC-RV-03: Reversal Preserves Target User's Own Content

**Type**: Reversal | Safety | Data Preservation

**Preconditions**:
- Claim merged, posts + ratings moved to target profile
- Target user then creates their OWN posts/ratings
- Now claim is reversed
- Need to ensure target's OWN content not affected

**Steps**:
1. Claim merged: wall_ghost_id moved from source → target
2. Target user creates new post on wall
3. Admin reverses claim
4. Check posts on all walls

**Expected Results**:
- ✅ Source ghost posts restored to source wall
- ✅ Target's new post remains on target wall (not moved back)
- ✅ Target's own wall content NOT affected by reversal
- ✅ Only moved items are reversed

**Pass Criteria**: All 4 results ✅

---

## SECTION 7: ERROR HANDLING & EDGE CASES

### TC-EH-01: Token Not SHA-256 Hashed Correctly

**Type**: Error Handling | Security | Invalid Token

**Preconditions**:
- Admin created invite with token T1
- Token hash stored as H1 = SHA-256(T1)
- Attacker tries to redeem with incorrect hash H2 ≠ H1

**Steps**:
1. Attacker calls RPC with token_hash = H2
2. RPC searches for invite matching H2
3. No match found

**Expected Results**:
- ✅ Error: "claim invitation is invalid, used, cancelled, or expired"
- ✅ Claim not redeemed
- ✅ No error leak revealing hash format

**Pass Criteria**: All 4 results ✅

---

### TC-EH-02: Officeholder Link Changed After Invite (Auto-Merge Fallback)

**Type**: Error Handling | Edge Case | State Change

**Preconditions**:
- Admin created invite for officeholder A
- After invite, officeholder A reassigned to different profile
- User tries to redeem

**Steps**:
1. User redeems token
2. RPC attempts auto-merge
3. Check: `officeholder.linked_profile_id <> claim.source_profile_id`
4. Merge fails
5. Check response status

**Expected Results**:
- ✅ Exception caught: "officeholder source link changed since claim creation"
- ✅ Status set to `pending_review` (not `approved`)
- ✅ User's login/signup NOT broken
- ✅ Admin can manually merge later
- ✅ Success message shows: "Claim submitted... administrator will review"

**Pass Criteria**: All 5 results ✅

---

### TC-EH-03: Profile Deleted Between Invite and Redemption

**Type**: Error Handling | Edge Case | Cascade Delete

**Preconditions**:
- Admin created invite for officeholder
- Source profile deleted (cascade delete)
- User tries to redeem

**Steps**:
1. User redeems token
2. RPC attempts to fetch source_profile_id
3. Profile doesn't exist (deleted)

**Expected Results**:
- ✅ Error during merge (FK constraint)
- ✅ Claim set to `pending_review` (fallback)
- ✅ User still signed up (profile created)
- ✅ Admin needs to manually review/resolve
- ✅ Clear error in database/logs

**Pass Criteria**: All 5 results ✅

---

### TC-EH-04: Database Constraint Violations (Duplicate Claim)

**Type**: Error Handling | Constraint | Uniqueness

**Preconditions**:
- Officeholder A already has claim in status `pending_review`
- Admin tries to create another invite for same officeholder

**Steps**:
1. Admin calls `create_officeholder_wall_claim()` with officeholder_id=A
2. RPC checks unique constraint

**Expected Results**:
- ✅ Error: "duplicate key value violates unique constraint office_holder_wall_claims_one_open_claim_idx"
- ✅ No duplicate claim created
- ✅ Admin gets clear error message
- ✅ Admin can cancel old claim first, then create new

**Pass Criteria**: All 4 results ✅

---

### TC-EH-05: Merge Preview Shows Accurate Counts

**Type**: Error Handling | Data Accuracy | Preview

**Preconditions**:
- Claim ready to merge with mixed content
- Posts: 3, Comments: 2, Supporters: 5, Ratings: 4

**Steps**:
1. Admin calls `preview_officeholder_wall_claim()`
2. Check returned data

**Expected Results**:
- ✅ Preview shows accurate counts
- ✅ Posts: 3
- ✅ Comments: 2
- ✅ Supporters: 5
- ✅ Ratings: 4
- ✅ No double-counting

**Pass Criteria**: All 6 results ✅

---

## SECTION 8: PERMISSION & AUTHORIZATION

### TC-AU-01: Non-Admin Cannot Create Invite

**Type**: Authorization | Permission | Create Invite

**Preconditions**:
- Citizen account (non-admin)

**Steps**:
1. Citizen calls `create_officeholder_wall_claim()` RPC
2. Check response

**Expected Results**:
- ✅ Error: "admin authorization required"
- ✅ No invite created
- ✅ Claim not modified

**Pass Criteria**: All 3 results ✅

---

### TC-AU-02: Non-Admin Cannot Merge Claim

**Type**: Authorization | Permission | Merge

**Preconditions**:
- Citizen account
- Claim in status `pending_review`

**Steps**:
1. Citizen calls `merge_officeholder_wall_claim()` RPC
2. Check response

**Expected Results**:
- ✅ Error: "admin authorization required"
- ✅ Claim status unchanged
- ✅ No merge executed

**Pass Criteria**: All 3 results ✅

---

### TC-AU-03: Non-Claimed-User Cannot Redeem Claim

**Type**: Authorization | Permission | Redeem

**Preconditions**:
- Claim invite created for user A
- User B (different person) gets the token somehow

**Steps**:
1. User B tries to redeem token
2. User B not logged in; system redirects to signup/login
3. User B signs up as different email
4. User B redeems token from user A's email

**Expected Results**:
- ✅ Either: RPC checks token.email matches invite.email (strict)
- ✅ Or: RPC allows any logged-in user to redeem (trust auth)
- ✅ Behavior depends on design (currently trusts auth session)

**Pass Criteria**: Design-dependent (clarify in design doc)

---

## SECTION 9: PERFORMANCE & LOAD

### TC-PF-01: Bulk Merge (Many Claim Items)

**Type**: Performance | Scalability | Bulk Content

**Preconditions**:
- Officeholder wall with 100+ posts, 50+ ratings, 20+ supporters
- Claim ready to merge

**Steps**:
1. Note start time
2. Admin calls `merge_officeholder_wall_claim()`
3. Note end time
4. Check all items moved

**Expected Results**:
- ✅ Merge completes within 5 seconds
- ✅ All 170+ items moved correctly
- ✅ No partial moves or crashes
- ✅ Database transaction atomic

**Pass Criteria**: All 4 results ✅

---

### TC-PF-02: Concurrent Claim Redemptions

**Type**: Performance | Concurrency | Race Condition

**Preconditions**:
- Two invites for different officeholders
- Two users redeem simultaneously

**Steps**:
1. User 1 and User 2 both call `redeem_officeholder_wall_claim()` concurrently
2. Both with different tokens
3. Both complete

**Expected Results**:
- ✅ Both claims processed independently
- ✅ No deadlocks or conflicts
- ✅ Both auto-merge successfully
- ✅ Wall ownership correct for each

**Pass Criteria**: All 4 results ✅

---

## TEST EXECUTION SUMMARY

### Test Case Counts by Category

| Category | Count | Status |
|----------|-------|--------|
| Officeholder — Admin-Initiated | 14 | Design ✓ |
| Officeholder — Self-Requested | 5 | Design ✓ |
| Politician/Candidate | 6 | Design ✓ |
| Merge & Reassignment | 5 | Design ✓ |
| Reversal | 3 | Design ✓ |
| Error Handling | 5 | Design ✓ |
| Authorization | 3 | Design ✓ |
| Performance | 2 | Design ✓ |
| **TOTAL** | **43** | **Ready for Execution** |

### Recommended Execution Order

**Phase 1 (Happy Path)**: TC-OW-AU-01, TC-OW-EU-08, TC-OW-SU-01, TC-PW-AU-01
- Verify core flows work end-to-end
- Expected duration: 2-4 hours
- Blocker: If any fails, stop and fix

**Phase 2 (Variants)**: TC-OW-AU-02 through TC-OW-SU-05
- Test all new user + existing user combinations
- Expected duration: 4-6 hours

**Phase 3 (Content Reassignment)**: TC-MG-01 through TC-MG-05
- Verify posts, comments, ratings, supporters moved correctly
- Expected duration: 2-3 hours

**Phase 4 (Reversal)**: TC-RV-01 through TC-RV-03
- Verify undo/reversal works
- Expected duration: 1-2 hours

**Phase 5 (Edge Cases)**: TC-EH-01 through TC-PF-02
- Test error handling, auth, performance
- Expected duration: 3-4 hours

**Total Expected Duration**: 12-19 hours

### Pass/Fail Criteria

**Overall PASS**: 95%+ of test cases pass (41/43)

**FAIL Criteria** (blockers):
- Any happy-path test fails (Phase 1)
- Merge doesn't move all content correctly
- Reversal doesn't restore all content
- Authorization bypass (non-admin can merge)

---

## Test Data Reference

### Mailsac Test Accounts

```
chosenovoter1@mailsac.com / TestVoter_Pass!2024
chosenovoter2@mailsac.com / TestVoter_Pass!2024
chosenovoter3@mailsac.com / TestVoter3Pass!2024 (already claimed David Eby's wall)
```

### Unclaimed Officeholders (as of 2026-08-12)

```
Laxman Savadi (f873ea5d-51a0-4231-b0ab-6d94149451d4) — MLA, Athani
Raju Kage (eb82f15f-5759-4296-8547-aa49fce575a4) — MLA
Mahendra Kallappa Tammannavar (ac338d25-bcaf-4c52-8dde-eb279837c00d)
Duryodhan Aihole (02e10a7f-f681-4dfa-94ea-5efc0191ce91)
Nikhil Katti (2c31dfda-83c0-4492-82f2-5724e6337ad3)
Shashikala Jolle (fb972fbd-709d-4742-9d3b-6c2109dc9dfb)
Balachandra Jarkiholi (eed7d35a-1d12-4bf5-846f-f30dcd6fec65)
Ramesh Jarkiholi (ccad3869-df29-4524-b2f0-13896ccc4925)
Satish Jarkiholi (d978054f-678c-41f4-881b-6867d4d25644)
Asif Sait (7ae7b698-baee-4c5c-8d34-ef6f7d6de2fc)
```

### Admin Credentials

```
Email: vmn2k4@gmail.com
Password: Happy@123
Role: admin
```

---

## Test Infrastructure Requirements

- ✅ Dev database: qlzyfdwrkcxyqapewxwg.supabase.co
- ✅ Mailsac inbox access: https://mailsac.com/inbox/
- ✅ Admin UI: http://localhost:3000/admin/office-holders
- ✅ Public walls: http://localhost:3000/wall/{slug}
- ✅ Database access: psql to db.qlzyfdwrkcxyqapewxwg.supabase.co:5432
- ✅ API access: curl to REST API with anon + service role keys

---

## Checklist Before Starting

- [ ] All 3 mailsac accounts verified (can receive emails)
- [ ] Admin account tested (can log in)
- [ ] Dev database connection working (psql test)
- [ ] Dev server running (http://localhost:3000)
- [ ] Test data loaded (unclaimed officeholders exist)
- [ ] Test accounts ready (mailsac accounts confirmed)
- [ ] Documentation reviewed (understand claim flows)
- [ ] Curl commands tested (API access working)
- [ ] Admin UI loaded (can navigate `/admin/office-holders`)

---

**Document Prepared By**: QA Team  
**Date**: 2026-08-12  
**Status**: Ready for QA Execution  
**Approval**: Pending
