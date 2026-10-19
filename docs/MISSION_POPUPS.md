# Mission popups — one skeleton, every page

All logged-out sign-up prompts live in one component:
[MissionRegisterCTA.tsx](../src/components/features/MissionRegisterCTA.tsx).
Add a page by mounting it with a `variant`; add a message by adding a row to its
`COPY` table. Nothing else defines popup copy.

## The skeleton (top to bottom)

1. **Eyebrow** — always the category line: "The social network for local politics" (anonymity is explained right below, not repeated here)
2. **Headline** — a positive question or statement for the screen ("Your political opinions deserve a voice.")
3. **Message** — one or two short sentences: share without your name being shown, no need to argue or reply
4. **Trust chips** — Your name stays private · No social pressure · No need to reply
5. **Founder-badge line** — one small muted line with a flag icon: "Join early and earn a permanent Founder badge." (`MISSION_BADGE_LINE`; deliberately quiet so it does not compete with the buttons)
6. **Continue with Google** (primary, site blue) — calls `signInWithGoogle()` from `services/auth.ts`, the same function as the `/auth` page, so Google's account picker opens immediately and the visitor returns to the same page signed in
7. **Sign up with email** (secondary) — link to the existing `/auth?role=citizen&next=<this page>` sign-up page
8. *(optional)* Share with neighbors (seat pages only), then **Maybe later**

The screen's own call-to-action text (e.g. "Share your opinion") is the label
used for click tracking (`data-signup-trigger`).

Writing rules: positive and simple; plain words (say "without your name being
shown", not "ghost"); claim only what is true — no "no trolls", no "untraceable"
(we know Google/email accounts); never promise a conversation, since people
don't have to reply.

Both buttons are defined once in `MissionAuthButtons` and reused by the video
modal and the mission modal. No new auth flow: Google → `/auth/callback` →
`next`; email → `/auth`. Signup attribution (`profiles.signup_source`) is
recorded by `AuthContext` after sign-in exactly as before.

## When it appears (logged-out only; signed-in users never see any of it)

| Trigger | Behavior |
|---|---|
| Dwell / scroll | Modal after **15 s on page or 50% scroll**, whichever is first. Once per variant per browser, re-eligible after **7 days** (`RESHOW_AFTER_DAYS`). |
| Floating card | Small card bottom-right (bottom-left on mobile) shown on load, dismissible, same 7-day suppression. Email button only. |
| Gated action | `openMissionPopup()` — a logged-out click on Support / like / vote / Sign In to Post / Be the First to Review opens the modal **immediately** (ignores the 7-day suppression; the first-ever popup is still the intro video). Falls back to the old `/auth` redirect if no popup is mounted. Wired on candidate and politician pages. |
| First-ever visit | The modal slot shows the **intro video** instead of the mission copy (see Videos). |

## Screens and messages

| Screen | Headline | Message | Button |
|---|---|---|---|
| Home `/` | Your political opinions deserve a voice. | Share your views without your name being shown. No social pressure. No need to argue or reply. | Share your opinion |
| News list, article (no tagged person) | What's your take on this story? | Share your perspective anonymously. No need to argue or reply. | Share your opinion |
| News article (tagged person) | What's your opinion of {name}? | Share what you think about their actions, ideas, and public record — without your name being shown. | Share your view |
| Find my district | Make your voice count in your community. | Discover your local representatives and share what matters to your neighbourhood. | Have your say |
| Elections | Which candidates have earned your support? | Share your opinion without your name being shown. Every voice deserves a chance to be heard. | Share your opinion |
| Seat page | Who should represent {area}? (no area: Who should be your {role}?) | Share your views on the candidates for {role}. It takes about 30 seconds to have your say. | Share your opinion |
| Candidate page | What do you think of {name}? | Share your thoughts on this candidate's ideas, priorities, and promises without your name being shown. | Have your say |
| Politician wall | Your representatives should hear from you. | Share what you think about {name} and the issues that matter to you. Your name won't be displayed. | Speak up |

Floating card (bottom corner), headline / line:

| Screen | Headline | Line |
|---|---|---|
| Home | Have a say in local politics. | Share your views anonymously. No replies required. |
| News | What's your take on this story? | Share your opinion anonymously. |
| News (tagged person) | What's your opinion of {name}? | Share your opinion anonymously. |
| District | What should local leaders know? | Make your voice heard in your community. |
| Elections | Which candidates have your support? | Share your views anonymously. |
| Seat | Who should represent {area}? (generic: your area) | Have your say in this race. |
| Candidate | What do you think of {name}? (generic: this candidate) | Share your opinion anonymously. |
| Politician wall | Is {name} delivering? (generic: your representative) | Share your views on their work and decisions. |

Candidate page: popup is skipped when the wall is embedded in a seat page.
"It takes about 30 seconds" should be re-timed against the real signup + first
post flow before it is relied on.

## Other logged-out prompts (not the popup)

| Where | Message | Notes |
|---|---|---|
| Candidate wall | "Sign in to post on {name}'s campaign wall." / **Sign In to Post** | Now opens the popup. |
| Politician wall | **Be the First to Review** | Now opens the popup. |
| Seat page banner | "Sign in to nominate yourself, run for this seat, or volunteer as seat administrator." / **Sign In to Participate** | Still goes straight to `/auth` (a different audience: would-be candidates). |
| Home locate widget and Find my district | "N more representatives — sign in to see the rest" | Shows `ANON_REP_PREVIEW_LIMIT` = 3 reps then gates the rest (`REP_LIST_GATING_ENABLED = true`). |
| Auth page | Founder badge line + sign-up form | Reached by the email button. |

## Videos shown to logged-out users

- **Intro video** — `INTRO_VIDEO_URL` (YouTube Short `qlr9s9QkVww`), shown **once**, in the modal slot, the first time any popup fires for a visitor (key `choseno_intro_video_seen_v1`). After they close it, every later popup is the normal mission copy. The mission popup still gets its own first showing on the next page/visit. The video modal has the same Google + email buttons.
- **Candidate intro videos** — on `/candidacy/...` (`CandidacyWall`), plain player, visible to everyone.
- **Pitch / interview reels / Q&A carousels** — `PitchPlayer`, `PlayInterviewReel`, `QuestionAnswerCarousel` on seat and candidate content, visible to everyone; none of them gate on login.

## Analytics

`mission_cta_shown` / `mission_cta_clicked` with `variant` (adds `candidate`,
`politician`) and `trigger` (`modal`, `sidebar`, `intro_video`, new
`gated_action`). Google clicks also fire `sign_up` (method=google), as on the
auth page.

## Known gap

A Google sign-up started from the popup skips the `/auth` page, so
`signup_source.auth_trigger` (the button text) is not recorded for those
signups; landing page, trail and referrer still are.
