import { createClient } from "@/lib/supabase/server";
import { claimCandidacyViaOwnEmail } from "@/lib/services/elections";
import { NextRequest, NextResponse } from "next/server";

// Companion to /auth/callback's PKCE `code` exchange, but for the email
// link itself: the default flow points recovery/signup/etc. emails at
// GoTrue's own hosted `<project>.supabase.co/auth/v1/verify?token=pkce_...`
// endpoint, which then redirects into `/auth/callback?code=...`. That
// `code` exchange needs the PKCE code_verifier that was stored in whichever
// browser originally triggered the email -- but these links routinely get
// opened in a different browser or app than the one that requested them
// (the Mail app's in-app browser, a different device, a corporate
// email-security scanner prefetching the link to scan it), so the exchange
// fails and the user sees a confusing "expired" error, or worse, a silent
// auto-login (the client SDK's detectSessionInUrl picks up the `code` on
// whatever page it lands on) with no actual verification step happening.
//
// verifyOtp({ type, token_hash }) sidesteps that: it's a stateless check
// against the token itself, no code_verifier required, so it works
// regardless of which browser/device opens the link. supabase/functions/
// auth-send-email builds every auth email's link against this route
// instead of GoTrue's default -- see that function for the full picture
// (the "Send Email" hook it implements bypasses the Dashboard's own Email
// Templates editor entirely, so that file is the only place these links
// are actually constructed).
type OtpVerifyType = "recovery" | "signup" | "invite" | "magiclink" | "email_change";

const VALID_TYPES = new Set<OtpVerifyType>(["recovery", "signup", "invite", "magiclink", "email_change"]);

// Where to land the user once verifyOtp succeeds, when the email's `next`
// param didn't survive (GoTrue's Redirect URLs allow-list rejected the
// original redirectTo and fell back to the bare Site URL -- see
// auth-send-email's extractNextPath). Recovery always goes to the
// set-new-password form; the rest land wherever a fresh sign-in normally
// would.
const DEFAULT_NEXT_BY_TYPE: Record<OtpVerifyType, string> = {
  recovery: "/auth/reset-password",
  signup: "/onboarding",
  invite: "/onboarding",
  magiclink: "/onboarding",
  email_change: "/profile",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const type: OtpVerifyType | null =
    typeParam && VALID_TYPES.has(typeParam as OtpVerifyType) ? (typeParam as OtpVerifyType) : null;
  const nextParam = searchParams.get("next");
  const nextPath = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : undefined;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // "invite" links from the candidate-interview claim flow never carry
      // a working `next` (see this file's top comment + the migration
      // creating claimCandidacyViaOwnEmail) -- try claiming by the email
      // that was just proven via verifyOtp before falling back to the
      // generic per-type default. A no-op for a normal, non-candidate
      // invite (no pending row for that email -> RPC errors, ignored here).
      if (type === "invite" && !nextPath) {
        const { data: claimed } = await claimCandidacyViaOwnEmail(supabase);
        if (claimed) {
          // The session right now is the short-lived one verifyOtp just
          // created for an account that has never had a password set --
          // admin.inviteUserByEmail creates the auth.users row passwordless,
          // and nothing in this flow ever prompts for one otherwise. Same
          // gap existed before this fix too (onboarding never asked for a
          // password either), just masked by landing on the wrong page
          // entirely. /auth/reset-password already does exactly this
          // (calls auth.updateUser({password}) against the current session,
          // same mechanism a password-recovery link uses) and already
          // supports a `next` to continue on to afterward -- reusing it
          // outright rather than building a second "set your password" form.
          const applyPath = `/apply/${claimed.id}`;
          return NextResponse.redirect(
            new URL(`/auth/reset-password?next=${encodeURIComponent(applyPath)}`, request.url)
          );
        }
      }
      return NextResponse.redirect(new URL(nextPath || DEFAULT_NEXT_BY_TYPE[type], request.url));
    }
    return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(error.message)}`, request.url));
  }

  return NextResponse.redirect(new URL("/auth?error=no_token", request.url));
}
