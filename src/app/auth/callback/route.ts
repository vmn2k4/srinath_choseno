import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/auth?error=${error.message}`, request.url));
    }
    // Redirect to the dashboard/feed after successful sign-in
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // No code returned, redirect to auth page
  return NextResponse.redirect(new URL("/auth?error=no_code", request.url));
}
