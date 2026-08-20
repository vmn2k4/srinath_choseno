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
  trackingToken?: string;
}

// politician_claim_campaigns isn't in the generated Database type yet
// (supabase/migrations/20260811_politician_claim_campaigns.sql — apply via
// psql, then `supabase gen types` to fill this in properly). Shape it by
// hand in the meantime rather than blocking the feature on a regen.
export interface TrackingEventRow {
  id: number;
  send_id: string;
  event_type: "open" | "click" | "wall_view" | "wall_exit";
  event_data: {
    ip?: string;
    user_agent?: string;
    timestamp?: string;
    open_number?: number;
    link?: string;
    wall_slug?: string;
    duration_seconds?: number;
  };
  occurred_at: string;
  created_at: string;
}

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
  tracking_token?: string | null;
  opened_count?: number;
  last_opened_at?: string | null;
  first_open_time_seconds?: number | null;
  link_clicks?: number;
  links_clicked?: Array<{ link: string; clicked_at: string; count: number }>;
  wall_visited?: boolean;
  wall_visited_at?: string | null;
  wall_visit_duration_seconds?: number | null;
  estimated_read_time_seconds?: number | null;
  engagement_score?: number;
  events?: TrackingEventRow[];
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
  const trackingToken = input.trackingToken || token;
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
      tracking_token: trackingToken,
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

export async function resendCampaignInvite(
  supabase: Client,
  sendRow: CampaignSendRow,
  input: {
    redirectOrigin: string;
    htmlTemplate: string;
    subject: string;
  }
) {
  const token = sendRow.claim_token || crypto.randomUUID();
  const trackingToken = sendRow.tracking_token || token;
  const claimLink = sendRow.claim_link || buildCampaignClaimLink(input.redirectOrigin, token);
  const html = input.htmlTemplate.replace(/\{\{\s*claim_link\s*\}\}/gi, claimLink);

  const { error: sendError } = await sendEmail(supabase, {
    to: sendRow.politician_email,
    subject: input.subject,
    html,
  });

  const { data, error: dbError } = await supabase
    .from("politician_claim_campaigns" as never)
    .update({
      status: sendError ? "failed" : "sent",
      error_message: sendError ? sendError.message : null,
      sent_at: sendError ? null : new Date().toISOString(),
    } as never)
    .eq("id" as never, sendRow.id as never)
    .select()
    .single();

  if (sendError) {
    return { data: (data as unknown as CampaignSendRow) ?? null, error: sendError };
  }
  if (dbError) {
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
  const rows = (data as unknown as CampaignSendRow[] | null) || [];

  if (rows.length > 0) {
    const sendIds = rows.map((r) => r.id);
    const { data: eventsData } = await supabase
      .from("tracking_events" as never)
      .select("*")
      .in("send_id" as never, sendIds as never)
      .order("occurred_at", { ascending: true });

    if (eventsData && Array.isArray(eventsData)) {
      const eventsBySendId = new Map<string, TrackingEventRow[]>();
      for (const ev of eventsData as unknown as TrackingEventRow[]) {
        const list = eventsBySendId.get(ev.send_id) || [];
        list.push(ev);
        eventsBySendId.set(ev.send_id, list);
      }
      for (const row of rows) {
        row.events = eventsBySendId.get(row.id) || [];
      }
    }
  }

  return { data: rows, error };
}

export async function deleteCampaignSend(supabase: Client, sendId: string) {
  // First delete any tracking events associated with this send
  await supabase
    .from("tracking_events" as never)
    .delete()
    .eq("send_id" as never, sendId as never);

  const { error } = await supabase
    .from("politician_claim_campaigns" as never)
    .delete()
    .eq("id" as never, sendId as never);

  return { error };
}

export async function deleteCampaignGroup(supabase: Client, campaignName: string) {
  // Get all send IDs for this campaign name first
  const { data: sends } = await supabase
    .from("politician_claim_campaigns" as never)
    .select("id" as never)
    .eq("campaign_name" as never, campaignName as never);

  if (sends && Array.isArray(sends) && sends.length > 0) {
    const sendIds = (sends as any[]).map((s) => s.id);
    await supabase
      .from("tracking_events" as never)
      .delete()
      .in("send_id" as never, sendIds as never);
  }

  const { error } = await supabase
    .from("politician_claim_campaigns" as never)
    .delete()
    .eq("campaign_name" as never, campaignName as never);

  return { error };
}

export async function getCampaignStats(supabase: Client) {
  const { data, error } = await supabase
    .from("politician_campaign_stats" as never)
    .select("*");
  return { data: (data as unknown as CampaignStatsRow[] | null) || [], error };
}

