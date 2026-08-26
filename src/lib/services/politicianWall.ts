import type { SupabaseClient, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isDevEnvironment } from "@/lib/utils/environment";

type Client = SupabaseClient<Database>;

// profiles — wall owner lookup by ghost_id, with nested politician_profiles.
async function enrichProfileWithContactFallback(supabase: Client, profileData: any) {
  if (!profileData || !profileData.full_name) return profileData;
  const pp = profileData.politician_profiles as any;
  if (!pp) return profileData;

  const escapedName = profileData.full_name.replace(/"/g, '""');
  const { data: ohMatches } = await supabase
    .from("office_holders")
    .select(
      "linked_profile_id, contact_email, contact_phone, source_url, photo_url, holding_since, is_current, term_ended_at, election_role_types(role_title), map_shapes(name, boundary_type)"
    )
    .or(`linked_profile_id.eq.${profileData.id},full_name.ilike."${escapedName}"`);

  // is_office_holder must mean "holds the seat right now" -- a row existing
  // is not enough once rows can be retired in place (is_current = false) to
  // preserve term history instead of being deleted. A former holder still
  // has a match here (so their wall keeps using their own last-known contact
  // info as a fallback below), just not the current-officeholder badge.
  const currentMatches = (ohMatches || []).filter((m) => m.is_current);
  const formerMatches = (ohMatches || []).filter((m) => !m.is_current);

  if (currentMatches.length > 0) {
    pp.is_office_holder = true;
  } else if (formerMatches.length > 0) {
    pp.is_former_office_holder = true;
    pp.term_ended_at = formerMatches
      .map((m) => m.term_ended_at)
      .filter(Boolean)
      .sort()
      .at(-1);
  }

  // Every CURRENT office this profile is explicitly linked_profile_id-linked
  // to -- deliberately narrower than the full_name-coincidence matches used
  // for the contact/photo fallback below, since a same-named stranger's seat
  // must never show up as "this person's position". One real person can
  // legitimately hold more than one office at once (a Premier/Governor who
  // is also the sitting MLA/Assembly member for their home riding, for
  // example) -- see office_holder_wall_claims merges, which is how two
  // previously-separate profiles for the same office holder get combined
  // into one linked_profile_id in the first place.
  pp.positions = currentMatches
    .filter((m: any) => m.linked_profile_id === profileData.id && m.election_role_types?.role_title)
    .map((m: any) => ({
      roleTitle: m.election_role_types.role_title as string,
      jurisdictionName: (m.map_shapes?.name as string | undefined) || null,
      boundaryType: (m.map_shapes?.boundary_type as string | undefined) || null,
    }))
    .reduce((acc: any[], p: any) => {
      if (!acc.some((x) => x.roleTitle === p.roleTitle && x.jurisdictionName === p.jurisdictionName)) acc.push(p);
      return acc;
    }, []);

  if (ohMatches && ohMatches.length > 0) {
    // Prefer a current row's contact/photo details over a former one's when
    // both exist (e.g. name collision across two different seats).
    const preferred = currentMatches.length > 0 ? currentMatches : ohMatches;
    const emailMatch = preferred.find((m) => m.contact_email)?.contact_email;
    const phoneMatch = preferred.find((m) => m.contact_phone)?.contact_phone;
    const sourceMatch = preferred.find((m) => m.source_url)?.source_url;
    const photoMatch = preferred.find((m) => m.photo_url)?.photo_url;

    if (!pp.contact_email && emailMatch) pp.contact_email = emailMatch;
    if (!pp.contact_phone && phoneMatch) pp.contact_phone = phoneMatch;
    if (!pp.source_url && sourceMatch) pp.source_url = sourceMatch;
    if (!pp.photo_url && photoMatch) pp.photo_url = photoMatch;
  }

  if (!pp.contact_email || !pp.contact_phone || !pp.source_url || !pp.photo_url) {
    const { data: siblingProfiles } = await supabase
      .from("profiles")
      .select("politician_profiles(contact_email, contact_phone, source_url, photo_url, avatar_url)")
      .ilike("full_name", profileData.full_name);

    if (siblingProfiles && siblingProfiles.length > 0) {
      const sibs = siblingProfiles.map((s: any) => s.politician_profiles).filter(Boolean);
      const emailMatch = sibs.find((s: any) => s.contact_email)?.contact_email;
      const phoneMatch = sibs.find((s: any) => s.contact_phone)?.contact_phone;
      const sourceMatch = sibs.find((s: any) => s.source_url)?.source_url;
      const photoMatch = sibs.find((s: any) => s.photo_url || s.avatar_url)?.photo_url || sibs.find((s: any) => s.avatar_url)?.avatar_url;

      if (!pp.contact_email && emailMatch) pp.contact_email = emailMatch;
      if (!pp.contact_phone && phoneMatch) pp.contact_phone = phoneMatch;
      if (!pp.source_url && sourceMatch) pp.source_url = sourceMatch;
      if (!pp.photo_url && photoMatch) pp.photo_url = photoMatch;
    }
  }

  return profileData;
}

export async function getWallOwnerProfile(supabase: Client, ghostId: string) {
  let query = supabase
    .from("profiles")
    .select(
      `
       id,
       current_ghost_id,
       full_name,
       role,
       constituency,
       country,
       politician_profiles (
         wall_slug,
         political_target_role,
         target_boundary_name,
         political_party_id,
         bio,
         avatar_url,
         contact_email,
         contact_phone,
         photo_url,
         source_url,
         holding_since,
         political_parties ( name )
       )
    `
    );

  if (isUuidString(ghostId)) {
    query = query.or(`current_ghost_id.eq.${ghostId},id.eq.${ghostId}`);
  } else {
    query = query.eq("current_ghost_id", ghostId);
  }

  if (!isDevEnvironment()) query = query.eq("is_test", false);
  const res = await query.maybeSingle();
  if (res.data) {
    res.data = await enrichProfileWithContactFallback(supabase, res.data);
  }
  return res;
}

function isUuidString(val: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export async function getWallOwnerProfileBySlug(supabase: Client, wallSlug: string) {
  const selectFields = `
       id,
       current_ghost_id,
       full_name,
       role,
       constituency,
       country,
       politician_profiles!inner (
         wall_slug,
         political_target_role,
         target_boundary_name,
         political_party_id,
         bio,
         avatar_url,
         contact_email,
         contact_phone,
         photo_url,
         source_url,
         holding_since,
         political_parties ( name )
       )
    `;

  // A merged imported wall keeps its old slug as a public redirect. Resolve
  // this before the normal slug/name fallbacks so an old link cannot land on
  // an archived synthetic profile or an ambiguous name match.
  const { data: redirect } = await supabase
    .from("office_holder_wall_redirects")
    .select("target_profile_id")
    .eq("old_wall_slug", wallSlug)
    .eq("active", true)
    .maybeSingle();
  if (redirect?.target_profile_id) {
    let redirectedQuery = supabase
      .from("profiles")
      .select(selectFields)
      .eq("id", redirect.target_profile_id);
    if (!isDevEnvironment()) redirectedQuery = redirectedQuery.eq("is_test", false);
    const redirected = await redirectedQuery.maybeSingle();
    if (redirected.data) {
      redirected.data = await enrichProfileWithContactFallback(supabase, redirected.data);
      return redirected;
    }
  }

  // 1. Try matching exact wall_slug
  let query = supabase.from("profiles").select(selectFields).eq("politician_profiles.wall_slug", wallSlug);
  if (!isDevEnvironment()) query = query.eq("is_test", false);
  let res = await query.maybeSingle();

  // 2. Fallback: Try matching full_name by converting slug hyphens to spaces (e.g. "john-doe" -> "John Doe")
  if (!res.data && wallSlug) {
    const nameFromSlug = wallSlug.replace(/-/g, " ");
    let nameQuery = supabase
      .from("profiles")
      .select(selectFields)
      .ilike("full_name", nameFromSlug)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!isDevEnvironment()) nameQuery = nameQuery.eq("is_test", false);
    const { data: nameMatches } = await nameQuery;
    if (nameMatches && nameMatches.length > 0) {
      // Pick executive / highest role profile if multiple match (e.g. Premier > MPP, PM > MP, Governor > Representative)
      const primaryMatch = nameMatches.find((p) => {
        const targetRole = (p.politician_profiles as any)?.political_target_role || "";
        return /(prime minister|president|premier|governor|mayor|senator)/i.test(targetRole);
      }) || nameMatches[0];

      (res as any).data = primaryMatch;
      (res as any).error = null;
    }
  }

  // 3. Fallback: Try matching by profile id or current_ghost_id if wallSlug is a UUID
  if (!res.data && isUuidString(wallSlug)) {
    let uuidQuery = supabase.from("profiles").select(selectFields).or(`id.eq.${wallSlug},current_ghost_id.eq.${wallSlug}`);
    if (!isDevEnvironment()) uuidQuery = uuidQuery.eq("is_test", false);
    res = await uuidQuery.maybeSingle();
  }

  if (res.data) {
    res.data = await enrichProfileWithContactFallback(supabase, res.data);
  }
  return res;
}

// ── politician_supporters ────────────────────────────────────────────────
export async function getSupportStatus(supabase: Client, politicianId: string, supporterId: string) {
  return supabase
    .from("politician_supporters")
    .select("supporter_id")
    .eq("politician_id", politicianId)
    .eq("supporter_id", supporterId)
    .maybeSingle();
}

// Batched form of getSupportStatus for "which of these politicians does the
// viewer already support" (a seat's whole candidate roster at once) — one
// round trip instead of N individual getSupportStatus calls in a
// Promise.all. Returns just the politician_ids the viewer supports; the
// caller turns that into a Set.
export async function getMySupportedPoliticianIds(supabase: Client, politicianIds: string[], supporterId: string) {
  if (politicianIds.length === 0) return { data: [] as string[], error: null };
  const { data, error } = await supabase
    .from("politician_supporters")
    .select("politician_id")
    .eq("supporter_id", supporterId)
    .in("politician_id", politicianIds);
  return { data: (data || []).map((r) => r.politician_id), error };
}

export async function getSupporterCount(supabase: Client, politicianId: string) {
  let query = supabase
    .from("politician_supporters")
    .select("*", { count: "exact", head: true })
    .eq("politician_id", politicianId);
  if (!isDevEnvironment()) query = query.eq("is_test", false);
  return query;
}

export async function withdrawSupport(supabase: Client, politicianId: string, supporterId: string) {
  return supabase
    .from("politician_supporters")
    .delete()
    .eq("politician_id", politicianId)
    .eq("supporter_id", supporterId);
}

export async function addSupport(supabase: Client, politicianId: string, supporterId: string) {
  return supabase
    .from("politician_supporters")
    .insert({ politician_id: politicianId, supporter_id: supporterId, is_test: isDevEnvironment() });
}

// Realtime subscription wrapper — keeps the raw supabase.channel()/
// removeChannel() calls out of page components, matching the Services-layer
// rule that all supabase.* calls live here. Returns the channel so the
// caller can pass it straight to unsubscribeFromSupportChanges on cleanup.
export function subscribeToSupportChanges(
  supabase: Client,
  politicianId: string,
  onChange: (payload: RealtimePostgresChangesPayload<Database["public"]["Tables"]["politician_supporters"]["Row"]>) => void
) {
  const channel = supabase
    .channel(`support-${politicianId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "politician_supporters",
        filter: `politician_id=eq.${politicianId}`,
      },
      onChange
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromSupportChanges(
  supabase: Client,
  channel: ReturnType<typeof subscribeToSupportChanges> | null
) {
  if (channel) supabase.removeChannel(channel);
}

export async function getSupportersList(
  supabase: Client,
  politicianId: string,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? 50;
  // profiles joined via !inner so a test-flagged supporter's row drops out
  // of the result entirely in production, instead of surviving with a
  // null-embedded profile (the default to-one embed behavior when an
  // .eq() filter on the embed doesn't match).
  let query = supabase
    .from("politician_supporters")
    .select(
      `
      created_at,
      profiles!politician_supporters_supporter_id_fkey!inner (
        full_name,
        current_ghost_id
      )
    `
    )
    .eq("politician_id", politicianId)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("profiles.is_test", false);
  return query;
}

// ── wall posts ───────────────────────────────────────────────────────────
// Default page size — this was the single highest-traffic query in the app
// with zero limit (per the migration comment on idx_posts_wall_ghost_id): a
// long-serving politician's ENTIRE post+comment history, every wall visit.
// Capped here so every existing caller is protected immediately; {offset}
// is threaded through for a future "load more" without another signature
// change.
const WALL_PAGE_SIZE = 50;

export async function getWallPosts(
  supabase: Client,
  ghostId: string,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? WALL_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select(`*, comments (*), news_articles (slug, event_date, published_at)`)
    .or(`ghost_id.eq.${ghostId},wall_ghost_id.eq.${ghostId}`)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

// Posts where this politician was @mentioned by someone else (not their own
// authored/wall posts, that's getWallPosts above) — independently fetched
// and merged by the caller, same pattern as the 3-way feed fetch in feed.ts.
// !inner on post_mentions so the .eq() filter on the embed actually narrows
// the joined posts instead of returning every post with a null embed.
export async function getMentionedWallPosts(
  supabase: Client,
  politicianId: string,
  opts: { limit?: number; offset?: number } = {}
) {
  const limit = opts.limit ?? WALL_PAGE_SIZE;
  let query = supabase
    .from("posts")
    .select(`*, comments (*), news_articles (slug, event_date, published_at), post_mentions!inner(politician_id)`)
    .eq("post_mentions.politician_id", politicianId)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (!isDevEnvironment()) query = query.eq("is_test", false).eq("comments.is_test", false);
  return query;
}

// Goes through the create_wall_post RPC (resolves ghost_id from auth.uid()
// server-side, and sets is_country/is_international/post_boundaries so the
// post also shows up in the main feed) — exempt from the politician
// daily-post-limit create_post() enforces, since Wall posting is meant to
// stay unlimited.
export async function createWallPost(
  supabase: Client,
  {
    content,
    imageUrl,
    videoUrl,
    linkMetadata,
    wallGhostId,
    mentionedPoliticianIds,
  }: {
    content: string;
    imageUrl?: string | null;
    videoUrl?: string | null;
    linkMetadata?: Database["public"]["Tables"]["posts"]["Row"]["link_metadata"];
    wallGhostId?: string | null;
    mentionedPoliticianIds?: string[] | null;
  }
) {
  return supabase.rpc("create_wall_post", {
    p_content: content,
    p_image_url: imageUrl ?? undefined,
    p_video_url: videoUrl ?? undefined,
    p_link_metadata: linkMetadata ?? undefined,
    p_wall_ghost_id: wallGhostId ?? undefined,
    p_mentioned_politician_ids: mentionedPoliticianIds && mentionedPoliticianIds.length > 0 ? mentionedPoliticianIds : undefined,
    p_is_test: isDevEnvironment(),
  });
}

export async function getWallPostBySlugOrId(supabase: Client, ghostId: string, slug: string) {
  let exactQuery = supabase
    .from("posts")
    .select(`*, comments (*), news_articles (slug, event_date, published_at)`)
    .eq("id", slug);
  if (!isDevEnvironment()) exactQuery = exactQuery.eq("is_test", false).eq("comments.is_test", false);
  const { data: exactPost } = await exactQuery.maybeSingle();

  if (exactPost) {
    return { data: exactPost };
  }

  const { data: posts } = await getWallPosts(supabase, ghostId);
  if (!posts || posts.length === 0) {
    return { data: null };
  }

  const slugifiedMatch = posts.find((p) => {
    const postSlug = (p.content || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
      .slice(0, 60);
    return postSlug === slug || p.id === slug;
  });

  // Never serve another post for an unknown URL. That creates duplicate pages
  // and can make search engines index misleading content under many slugs.
  return { data: slugifiedMatch || null };
}

export async function getActiveCandidacies(supabase: Client, profileId: string) {
  return supabase
    .from("election_candidates")
    .select(
      `id, seat_id, status,
       election_seats(
         id, role_title,
         map_shapes(name, boundary_type),
         elections(id, name, status, election_date)
       )`
    )
    .eq("politician_id", profileId)
    .order("created_at", { ascending: false });
}

export async function getSEOProfileSummary(supabase: Client, ghostId: string) {
  const { data: owner } = await getWallOwnerProfile(supabase, ghostId);
  if (!owner) return { owner: null, activeCandidacy: null, partyName: null, rating: null };

  const partyName =
    (owner.politician_profiles as any)?.political_parties?.name ||
    (owner.politician_profiles as any)?.political_party_id ||
    null;

  let activeCandidacy: any = null;
  if (owner.id) {
    const { data: candidacies } = await getActiveCandidacies(supabase, owner.id);
    if (candidacies && candidacies.length > 0) {
      activeCandidacy = candidacies[0];
    }
  }

  // Get ratings summary if available
  let rating: { avg: number; count: number } | null = null;
  if (owner.id) {
    const { data: ratingsData } = await supabase
      .from("politician_ratings")
      .select("rating")
      .eq("politician_id", owner.id);
    if (ratingsData && ratingsData.length > 0) {
      const sum = ratingsData.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0);
      rating = {
        avg: Math.round((sum / ratingsData.length) * 10) / 10,
        count: ratingsData.length,
      };
    }
  }

  // Fallback: If contact details or photo are missing on this specific profile,
  // attempt resolution from matching office_holders for the same politician name
  if (owner && owner.full_name) {
    const pp = owner.politician_profiles as any;
    if (pp && (!pp.contact_email || !pp.contact_phone || !pp.source_url || !pp.photo_url)) {
      const { data: ohMatches } = await supabase
        .from("office_holders")
        .select("contact_email, contact_phone, source_url, photo_url")
        .ilike("full_name", owner.full_name);

      if (ohMatches && ohMatches.length > 0) {
        const emailMatch = ohMatches.find((m) => m.contact_email)?.contact_email;
        const phoneMatch = ohMatches.find((m) => m.contact_phone)?.contact_phone;
        const sourceMatch = ohMatches.find((m) => m.source_url)?.source_url;
        const photoMatch = ohMatches.find((m) => m.photo_url)?.photo_url;

        if (!pp.contact_email && emailMatch) pp.contact_email = emailMatch;
        if (!pp.contact_phone && phoneMatch) pp.contact_phone = phoneMatch;
        if (!pp.source_url && sourceMatch) pp.source_url = sourceMatch;
        if (!pp.photo_url && photoMatch) pp.photo_url = photoMatch;
      }
    }
  }

  return { owner, activeCandidacy, partyName, rating };
}

export async function getSEOProfileSummaryBySlug(supabase: Client, wallSlug: string) {
  const { data: owner } = await getWallOwnerProfileBySlug(supabase, wallSlug);
  if (!owner?.current_ghost_id) return { owner: null, activeCandidacy: null, partyName: null, rating: null };
  return getSEOProfileSummary(supabase, owner.current_ghost_id);
}
