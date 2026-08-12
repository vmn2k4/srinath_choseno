import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendEmail } from "./email";

type Client = SupabaseClient<Database>;

export interface CampaignSendInput {
  name: string;
  email: string;
  role?: string;
  city?: string;
  subject: string;
  // Must still contain the literal "{{claim_link}}" placeholder — the token
  // (and therefore the link) is generated in here, not by the caller, so
  // that the link actually emailed and the claim_link logged to the
  // database can never drift apart.
  htmlTemplate: string;
  campaignName: string;
  redirectOrigin: string;
}

// politician_claim_campaigns isn't in the generated Database type yet
// (supabase/migrations/20260811_politician_claim_campaigns.sql — apply via
// psql, then `supabase gen types` to fill this in properly). Shape it by
// hand in the meantime rather than blocking the feature on a regen.
export interface CampaignSendRow {
  id: string;
  politician_name: string;
  politician_email: string;
  role_title: string | null;
  city: string | null;
  claim_token: string;
  claim_link: string;
  campaign_name: string;
  status: "pending" | "sent" | "failed" | "opened" | "claimed";
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  claimed_at: string | null;
  created_at: string;
}

export interface CampaignStatsRow {
  campaign_name: string;
  total: number;
  sent_count: number;
  failed_count: number;
  opened_count: number;
  claimed_count: number;
  claim_rate_percent: number | null;
  campaign_start: string | null;
  last_sent_at: string | null;
}

// Builds the outreach link recipients click. Unlike the officeholder-claim
// flow (a bearer token that redeems a specific pre-existing office_holders
// row), this just routes to the normal politician signup with a tracking
// param — recipients here may not exist in office_holders at all yet.
export function buildCampaignClaimLink(redirectOrigin: string, token: string): string {
  return `${redirectOrigin}/auth?role=politician&campaign=${token}`;
}

// Sends one campaign email via the existing send-email function and logs the
// attempt (sent or failed) to politician_claim_campaigns. Never throws —
// failures come back as a row with status "failed" so a bulk-send loop can
// keep going through the rest of the list.
export async function sendCampaignInvite(supabase: Client, input: CampaignSendInput) {
  const token = crypto.randomUUID();
  const claimLink = buildCampaignClaimLink(input.redirectOrigin, token);
  const html = input.htmlTemplate.replace(/\{\{\s*claim_link\s*\}\}/gi, claimLink);

  const { error: sendError } = await sendEmail(supabase, {
    to: input.email,
    subject: input.subject,
    html,
  });

  const { data: userData } = await supabase.auth.getUser();

  const { data, error: dbError } = await supabase
    .from("politician_claim_campaigns" as never)
    .insert({
      politician_name: input.name,
      politician_email: input.email,
      role_title: input.role || null,
      city: input.city || null,
      claim_token: token,
      claim_link: claimLink,
      campaign_name: input.campaignName,
      status: sendError ? "failed" : "sent",
      error_message: sendError ? sendError.message : null,
      sent_at: sendError ? null : new Date().toISOString(),
      created_by: userData?.user?.id ?? null,
    } as never)
    .select()
    .single();

  if (sendError) {
    return { data: (data as unknown as CampaignSendRow) ?? null, error: sendError };
  }
  if (dbError) {
    // Email went out but the log write failed — surface the DB error since
    // that's the one the caller can still act on (the send already happened).
    return { data: null, error: dbError };
  }
  return { data: data as unknown as CampaignSendRow, error: null };
}

export async function listCampaignSends(
  supabase: Client,
  opts?: { campaignName?: string; limit?: number }
) {
  let query = supabase
    .from("politician_claim_campaigns" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.campaignName) {
    query = query.eq("campaign_name" as never, opts.campaignName as never);
  }
  const { data, error } = await query;
  return { data: (data as unknown as CampaignSendRow[] | null) || [], error };
}

export async function getCampaignStats(supabase: Client) {
  const { data, error } = await supabase
    .from("politician_campaign_stats" as never)
    .select("*");
  return { data: (data as unknown as CampaignStatsRow[] | null) || [], error };
}
