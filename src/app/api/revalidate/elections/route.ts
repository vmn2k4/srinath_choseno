import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";

// The election pages are cached for a day (see `revalidate` in each page).
// Call this when the candidate roster changes so they refresh right away.
// Callers: a DB trigger / import script (Bearer REVALIDATE_SECRET) or a
// signed-in admin.

async function isAuthorized(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) return true;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await getProfileRole(supabase, user.id);
  return profile?.role === "admin";
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Pattern form marks every page of that route stale; each regenerates on
  // its next visit, so a bulk import costs nothing until someone looks.
  revalidatePath("/elections");
  revalidatePath("/elections/[boundarySlug]", "page");
  revalidatePath("/elections/e/[electionSlug]", "page");
  revalidatePath("/elections/e/[electionSlug]/party/[partySlug]", "page");
  revalidatePath("/elections/seat/[seatId]", "page");
  revalidatePath("/elections/seat/[seatId]/candidate/[candidateId]", "page");
  return NextResponse.json({ revalidated: true });
}
