import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const { token, wall_slug, duration_seconds } = await req.json()

    if (!token || !wall_slug) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase configuration")
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    const now = new Date()

    // Get the send record
    const { data: send, error: fetchError } = await supabase
      .from("politician_claim_campaigns")
      .select("id")
      .or(`tracking_token.eq.${token},claim_token.eq.${token}`)
      .limit(1)
      .maybeSingle()

    if (fetchError || !send) {
      console.error("Send not found:", fetchError)
      return new Response(JSON.stringify({ success: false, error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Log the wall view event
    const { error: insertError } = await supabase
      .from("tracking_events")
      .insert({
        send_id: send.id,
        event_type: "wall_view",
        event_data: {
          wall_slug,
          duration_seconds,
          ip: req.headers.get("x-forwarded-for") || "unknown",
          user_agent: req.headers.get("user-agent"),
          timestamp: now.toISOString(),
        },
      })

    if (insertError) {
      console.error("Error logging wall view event:", insertError)
    }

    // Update send record
    const { error: updateError } = await supabase
      .from("politician_claim_campaigns")
      .update({
        wall_visited: true,
        wall_visited_at: now,
        wall_visit_duration_seconds: duration_seconds,
      })
      .eq("id", send.id)

    if (updateError) {
      console.error("Error updating send record:", updateError)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Wall view tracking error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
