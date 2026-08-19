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

  if (!token) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
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

    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from("politician_claim_campaigns")
      .select("id, sent_at, opened_at, opened_count, first_open_time_seconds")
      .or(`tracking_token.eq.${token},claim_token.eq.${token}`)
      .limit(1)
      .maybeSingle()

    if (fetchError || !send) {
      console.error("Send not found:", fetchError)
      // Still return pixel even if not found (don't alert sender of missing records)
      return sendPixel(corsHeaders)
    }

    const now = new Date()
    const sentTime = send.sent_at ? new Date(send.sent_at) : now
    const openedCount = (send.opened_count || 0) + 1

    // Calculate time to first open (only if this is the first open)
    let firstOpenTime = send.first_open_time_seconds
    if (!send.opened_at && send.sent_at) {
      firstOpenTime = Math.floor((now.getTime() - sentTime.getTime()) / 1000)
    }

    // Log the open event
    const { error: insertError } = await supabase
      .from("tracking_events")
      .insert({
        send_id: send.id,
        event_type: "open",
        event_data: {
          ip: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent"),
          timestamp: now.toISOString(),
          open_number: openedCount,
        },
      })

    if (insertError) {
      console.error("Error logging open event:", insertError)
    }

    // Update send record
    const { error: updateError } = await supabase
      .from("politician_claim_campaigns")
      .update({
        opened_at: send.opened_at || now,
        last_opened_at: now,
        opened_count: openedCount,
        first_open_time_seconds: firstOpenTime,
      })
      .eq("id", send.id)

    if (updateError) {
      console.error("Error updating send record:", updateError)
    }

    return sendPixel(corsHeaders)
  } catch (error) {
    console.error("Open tracking error:", error)
    // Always return pixel even on error
    return sendPixel(corsHeaders)
  }
})

// Return 1x1 transparent GIF pixel
function sendPixel(headers: Record<string, string>) {
  const pixel = new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x0a,
    0x00, 0x01, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b,
  ])

  return new Response(pixel, {
    headers: {
      ...headers,
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  })
}
