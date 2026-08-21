// Edge Function: send-claim-invite
//
// Flow A of the candidacy claim flow (see
// 20260802000001_candidacy_claims.sql): an election administrator invites
// the real candidate behind a stub (add_unregistered_candidate) to claim
// it by email. This needs to run server-side for two reasons -- it has to
// call create_claim_invite() as the *caller* (so its permission check runs
// against the real election admin's auth.uid(), not a service role), and
// it has to call Supabase Auth's admin.inviteUserByEmail(), which requires
// the service role key and can't be called from the browser. So it does
// both, back to back, using two differently-scoped clients.
//
// Request: POST { candidateId: string, email: string, redirectOrigin: string }
// Response: { ok: true } | { error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
    }

    const { candidateId, email, redirectOrigin } = await req.json();
    if (!candidateId || !email || !redirectOrigin) {
      return new Response(JSON.stringify({ error: 'candidateId, email, and redirectOrigin are required' }), { status: 400, headers: corsHeaders });
    }

    // Scoped to the caller's own JWT, so create_claim_invite's
    // "approved election admin for this seat OR site admin" check runs
    // against the real caller, not this function's own service identity.
    const supabaseAsCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: token, error: rpcError } = await supabaseAsCaller.rpc('create_claim_invite', {
      p_candidate_id: candidateId,
      p_email: email,
    });
    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), { status: 400, headers: corsHeaders });
    }

    // Service role only from here -- admin.inviteUserByEmail can't be
    // called with a regular user JWT.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // redirectTo below is close to decorative: this project's auth emails go
    // through the auth-send-email "Send Email" hook (bypasses GoTrue's own
    // mailer entirely -- see that function's header), which always points
    // the actual link at our own /auth/confirm?token_hash=...&type=invite,
    // never at redirectTo directly. redirectTo only matters as the source
    // auth-send-email's extractNextPath reads a `next` param from -- and
    // GoTrue validates redirectTo against the project's Redirect URLs
    // allow-list *before* the hook even runs, silently substituting the
    // bare Site URL (dropping any path/query, `next` included) when it
    // doesn't match. A dynamic path like /claim/{token} predictably doesn't
    // match a static allow-list entry, so don't rely on it surviving --
    // confirmed via a real invite link showing up with no &next= at all.
    // claim_candidacy_via_own_email (called from /auth/confirm for every
    // "invite" link with no surviving next) is the actual fix: it looks up
    // the pending invite by the email verifyOtp just proved the caller
    // controls, no token round-trip required. This redirectTo is left
    // pointed at /claim/{token} purely as a courtesy for the rare case the
    // allow-list *does* happen to include it -- never point it at
    // /auth/callback, which expects a PKCE `code` param that won't exist
    // here (verifyOtp consumes token_hash, not a code) and would dead-end
    // on /auth?error=no_code instead.
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectOrigin}/claim/${token}`,
    });
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
});
