// Sends an officeholder-scoped claim invitation.
//
// Existing accounts receive a normal Choseno email containing the claim link.
// New accounts use Supabase Auth's invitation email and land on the same
// claim route after accepting it. The raw claim token is never stored.

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

async function accountExists(admin: ReturnType<typeof createClient>, email: string): Promise<boolean> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if ((data.users || []).some((user) => user.email?.toLowerCase() === email)) return true;
    if (!data.users || data.users.length < 1000) return false;
  }
  throw new Error('could not safely determine whether the account exists');
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

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const claimRow = Array.isArray(claim) ? claim[0] : claim;
    const claimUrl = `${redirectOrigin}/officeholder-claim/${token}`;
    const exists = await accountExists(admin, normalizedEmail);

    if (!exists) {
      const { error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, { redirectTo: claimUrl });
      if (error) return new Response(JSON.stringify({ error: error.message, claimId: claimRow?.claim_id }), { status: 400, headers: corsHeaders });
    } else {
      const { error } = await admin.functions.invoke('send-email', {
        body: {
          to: normalizedEmail,
          subject: 'You have been invited to claim your Choseno officeholder wall',
          text: `Sign in to Choseno and claim your officeholder wall: ${claimUrl}`,
          html: `<p>You have been invited to claim your Choseno officeholder wall.</p><p><a href="${claimUrl}">Sign in and claim your wall</a></p><p>This link expires in 7 days.</p>`,
        },
      });
      if (error) return new Response(JSON.stringify({ error: error.message, claimId: claimRow?.claim_id }), { status: 502, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true, claimId: claimRow?.claim_id, accountExists: exists }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: corsHeaders });
  }
});
