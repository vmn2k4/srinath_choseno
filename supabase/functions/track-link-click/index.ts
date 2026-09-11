import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const linkUrl = url.searchParams.get("link")
  const redirectUrl = url.searchParams.get("redirect")

  if (!token || !linkUrl || !redirectUrl) {
    return new Response(JSON.stringify({ error: "Missing parameters" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get the send record. Same two-system split as track-email-open: try
    // the campaign tool's table first, then candidate_claim_invites.
    const { data: send, error: fetchError } = await supabase
      .from("politician_claim_campaigns")
      .select("id, links_clicked, link_clicks")
      .or(`tracking_token.eq.${token},claim_token.eq.${token}`)
      .limit(1)
      .maybeSingle()

    if (!fetchError && send) {
      const now = new Date()
      const existingLinks = (send.links_clicked || []) as any[]
      const linkRecord = existingLinks.find((l) => l.link === linkUrl)

      let updatedLinks = existingLinks
      if (linkRecord) {
        linkRecord.count = (linkRecord.count || 1) + 1
        linkRecord.last_clicked_at = now.toISOString()
      } else {
        updatedLinks = [
          ...existingLinks,
          {
            link: linkUrl,
            clicked_at: now.toISOString(),
            count: 1,
          },
        ]
      }

      // Log the click event
      const { error: insertError } = await supabase
        .from("tracking_events")
        .insert({
          send_id: send.id,
          event_type: "click",
          event_data: {
            link: linkUrl,
            ip: req.headers.get("x-forwarded-for") || "unknown",
            user_agent: req.headers.get("user-agent"),
            timestamp: now.toISOString(),
          },
        })

      if (insertError) {
        console.error("Error logging click event:", insertError)
      }

      // Update send record
      const { error: updateError } = await supabase
        .from("politician_claim_campaigns")
        .update({
          link_clicks: (send.link_clicks || 0) + 1,
          links_clicked: updatedLinks,
        })
        .eq("id", send.id)

      if (updateError) {
        console.error("Error updating send record:", updateError)
      }

      return redirectTo(redirectUrl, corsHeaders)
    }

    // Not a campaign send -- try a candidacy claim invite (no tracking_events
    // log here, same reasoning as track-email-open: that table's send_id FK
    // only points at politician_claim_campaigns).
    const { data: claimInvite, error: claimFetchError } = await supabase
      .from("candidate_claim_invites")
      .select("id, links_clicked, link_clicks")
      .eq("tracking_token", token)
      .maybeSingle()

    if (claimFetchError || !claimInvite) {
      console.error("Send not found:", fetchError || claimFetchError)
      return redirectTo(redirectUrl, corsHeaders)
    }

    const now = new Date()
    const existingClaimLinks = (claimInvite.links_clicked || []) as any[]
    const claimLinkRecord = existingClaimLinks.find((l) => l.link === linkUrl)
    let updatedClaimLinks = existingClaimLinks
    if (claimLinkRecord) {
      claimLinkRecord.count = (claimLinkRecord.count || 1) + 1
      claimLinkRecord.last_clicked_at = now.toISOString()
    } else {
      updatedClaimLinks = [...existingClaimLinks, { link: linkUrl, clicked_at: now.toISOString(), count: 1 }]
    }

    const { error: updateClaimError } = await supabase
      .from("candidate_claim_invites")
      .update({
        link_clicks: (claimInvite.link_clicks || 0) + 1,
        links_clicked: updatedClaimLinks,
      })
      .eq("id", claimInvite.id)

    if (updateClaimError) {
      console.error("Error updating claim invite record:", updateClaimError)
    }

    return redirectTo(redirectUrl, corsHeaders)
  } catch (error) {
    console.error("Link tracking error:", error)
    // Still redirect even on error
    return redirectTo(redirectUrl, corsHeaders)
  }
})

function redirectTo(url: string, headers: Record<string, string>) {
  try {
    const decodedUrl = decodeURIComponent(url)
    // Basic URL validation
    new URL(decodedUrl)

    return new Response(null, {
      status: 302,
      headers: {
        ...headers,
        Location: decodedUrl,
      },
    })
  } catch (error) {
    console.error("Invalid redirect URL:", error)
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    })
  }
}
