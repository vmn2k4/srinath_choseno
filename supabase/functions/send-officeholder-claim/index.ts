// Sends an officeholder-scoped claim invitation.
//
// The recipient gets ONE email with TWO links — sign up fresh, or sign in
// and merge into an existing account — sharing the same underlying token.
// Letting the recipient self-select avoids guessing account ownership from
// the invited email address alone (they may already have a Choseno account
// under a different email) and avoids an account-existence lookup entirely.
// Both links route through /auth?next=/officeholder-claim/{token}, and
// redeem_officeholder_wall_claim() is single-use: whichever link is
// completed first consumes the token, so the other one — and any future
// reuse of either — stops working immediately. The raw token is never
// stored, only its hash.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function makeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });

    const { officeHolderId, claimId, email, redirectOrigin } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if ((!officeHolderId && !claimId) || !normalizedEmail || !redirectOrigin) {
      return new Response(JSON.stringify({ error: 'officeHolderId or claimId, email, and redirectOrigin are required' }), { status: 400, headers: corsHeaders });
    }

    const token = makeToken();
    const tokenHash = await sha256(token);
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: claim, error: claimError } = claimId
      ? await caller.rpc('resend_officeholder_wall_claim', {
        p_claim_id: claimId,
        p_email: normalizedEmail,
        p_token_hash: tokenHash,
      })
      : await caller.rpc('create_officeholder_wall_claim', {
        p_office_holder_id: officeHolderId,
        p_email: normalizedEmail,
        p_token_hash: tokenHash,
      });
    if (claimError) return new Response(JSON.stringify({ error: claimError.message }), { status: 400, headers: corsHeaders });

    const claimRow = Array.isArray(claim) ? claim[0] : claim;
    const nextPath = `/officeholder-claim/${token}`;
    const signupUrl = `${redirectOrigin}/auth?role=politician&next=${encodeURIComponent(nextPath)}`;
    const mergeUrl = `${redirectOrigin}/auth?role=politician&intent=login&next=${encodeURIComponent(nextPath)}`;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.functions.invoke('send-email', {
      body: {
        to: normalizedEmail,
        subject: 'You have been invited to claim your Choseno officeholder wall',
        text: [
          "You've been invited to claim your official Choseno wall.",
          '',
          `New to Choseno? Sign up and claim your wall: ${signupUrl}`,
          '',
          `Already have a Choseno account? Sign in and merge this wall into your profile: ${mergeUrl}`,
          '',
          'Either link works once — completing one immediately invalidates the other, and this link expires in 7 days.',
        ].join('\n'),
        html: `<p>You've been invited to claim your official Choseno wall.</p>
<p><a href="${signupUrl}">New to Choseno? Sign up and claim your wall</a></p>
<p><a href="${mergeUrl}">Already have a Choseno account? Sign in and merge this wall into your profile</a></p>
<p>Either link works once — completing one immediately invalidates the other, and this link expires in 7 days.</p>`,
      },
    });
    if (error) return new Response(JSON.stringify({ error: error.message, claimId: claimRow?.claim_id }), { status: 502, headers: corsHeaders });

    return new Response(JSON.stringify({ ok: true, claimId: claimRow?.claim_id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
