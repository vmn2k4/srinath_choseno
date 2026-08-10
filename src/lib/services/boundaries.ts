import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { fetchAllPages } from "@/lib/utils/fetchAllPages";
import { fetchWithCache, invalidateCache } from "@/lib/utils/apiCache";

type Client = SupabaseClient<Database>;

// countries — superset columns; callers that only read `.name` are
// unaffected by the extra columns.
export async function getCountries(supabase: Client) {
  return fetchWithCache("countries:list", () =>
    supabase.from("countries").select("name, code, flag_emoji").order("name")
  );
}

export async function createCountry(
  supabase: Client,
  { name, code, flagEmoji }: { name: string; code?: string | null; flagEmoji?: string | null }
) {
  invalidateCache("countries:");
  return supabase.from("countries").insert({ name, code: code || null, flag_emoji: flagEmoji || null });
}

// country_boundary_types — flexible listing used by both the admin builder
// (all types for all countries, needs is_container to split container vs
// target dropdowns) and the politician's "browse a different area" filter
// (one country, is_container=true containers only, type_name only).
export async function listBoundaryTypes(
  supabase: Client,
  {
    country,
    adminOnly,
    isContainer,
    electionEligible,
    columns = "id, country, type_name, rank, admin_only, is_container, election_eligible, term_length_months, term_limits, voting_method, description",
    orderBy = "rank",
  }: {
    country?: string;
    adminOnly?: boolean;
    isContainer?: boolean;
    electionEligible?: boolean;
    columns?: string;
    orderBy?: string;
  } = {}
) {
  const cacheKey = `boundary_types:${country || "all"}:${adminOnly}:${isContainer}:${electionEligible}:${columns}:${orderBy}`;
  return fetchWithCache(cacheKey, () => {
    let q = (supabase as any).from("country_boundary_types").select(columns).order("country").order(orderBy);
    if (country) q = q.eq("country", country);
    if (adminOnly !== undefined) q = q.eq("admin_only", adminOnly);
    if (isContainer !== undefined) q = q.eq("is_container", isContainer);
    if (electionEligible !== undefined) q = q.eq("election_eligible", electionEligible);
    return q;
  });
}

// country_boundary_types — for a set of countries (FeedPage ranks memberships by type).
export async function getBoundaryTypesForCountries(supabase: Client, countries: string[]) {
  const sortedKey = [...(countries || [])].sort().join(",");
  return fetchWithCache(`boundary_types_for:${sortedKey}`, () =>
    (supabase as any).from("country_boundary_types").select("country, type_name, rank").in("country", countries)
  );
}

export async function createBoundaryType(
  supabase: Client,
  {
    country,
    typeName,
    rank,
    electionEligible,
    termLengthMonths,
    termLimits,
    votingMethod,
    description,
  }: {
    country: string;
    typeName: string;
    rank: number;
    electionEligible?: boolean;
    termLengthMonths?: number | null;
    termLimits?: number | null;
    votingMethod?: string | null;
    description?: string | null;
  }
) {
  invalidateCache("boundary_types");
  return (supabase as any).from("country_boundary_types").insert({
    country,
    type_name: typeName,
    rank,
    ...(electionEligible !== undefined && { election_eligible: electionEligible }),
    term_length_months: termLengthMonths ?? null,
    term_limits: termLimits ?? null,
    voting_method: votingMethod ?? null,
    description: description ?? null,
  });
}

export async function updateBoundaryType(
  supabase: Client,
  typeId: number | string,
  {
    electionEligible,
    termLengthMonths,
    termLimits,
    votingMethod,
    description,
  }: {
    electionEligible?: boolean;
    termLengthMonths?: number | null;
    termLimits?: number | null;
    votingMethod?: string | null;
    description?: string | null;
  }
) {
  invalidateCache("boundary_types");
  const fields: Record<string, unknown> = {};
  if (electionEligible !== undefined) fields.election_eligible = electionEligible;
  if (termLengthMonths !== undefined) fields.term_length_months = termLengthMonths;
  if (termLimits !== undefined) fields.term_limits = termLimits;
  if (votingMethod !== undefined) fields.voting_method = votingMethod;
  if (description !== undefined) fields.description = description;
  return (supabase as any).from("country_boundary_types").update(fields).eq("id", String(typeId));
}

// entity_types — per-shape classification, distinct from country_boundary_types
// (which types a whole boundary_type, e.g. "Municipal"). A boundary_type can
// contain a mix of entity types from a single shapefile upload (e.g. BC's
// "Municipal" type mixes real municipalities with Indian reserves and
// regional district electoral areas) -- entity_types is the small fixed set
// of categories used to filter within that mix. See
// src/lib/utils/censusSubdivisionEntityTypes.ts for how a shape's raw source
// code maps to one of these category names.
export async function listEntityTypes(supabase: Client, { country }: { country?: string } = {}) {
  const cacheKey = `entity_types:${country || "all"}`;
  return fetchWithCache(cacheKey, () => {
    let q = (supabase as any)
      .from("entity_types")
      .select("id, country, name, election_eligible, description")
      .order("country")
      .order("name");
    if (country) q = q.eq("country", country);
    return q;
  });
}

export async function createEntityType(
  supabase: Client,
  { country, name, electionEligible = true, description }: { country: string; name: string; electionEligible?: boolean; description?: string | null }
) {
  invalidateCache("entity_types");
  return (supabase as any).from("entity_types").insert({ country, name, election_eligible: electionEligible, description: description ?? null });
}

export async function updateEntityType(
  supabase: Client,
  typeId: string,
  { electionEligible, description }: { electionEligible?: boolean; description?: string | null }
) {
  invalidateCache("entity_types");
  const fields: Record<string, unknown> = {};
  if (electionEligible !== undefined) fields.election_eligible = electionEligible;
  if (description !== undefined) fields.description = description;
  return (supabase as any).from("entity_types").update(fields).eq("id", typeId);
}

export async function deleteEntityType(supabase: Client, typeId: string) {
  invalidateCache("entity_types");
  return (supabase as any).from("entity_types").delete().eq("id", typeId);
}

// "Standard set" quick-seed: National / State-Province / Municipal at ranks 1-3.
export async function createStandardBoundaryTypeSet(supabase: Client, country: string) {
  invalidateCache("boundary_types");
  return supabase.from("country_boundary_types").insert([
    { country, type_name: "National", rank: 1 },
    { country, type_name: "State-Province", rank: 2 },
    { country, type_name: "Municipal", rank: 3 },
  ]);
}

export async function deleteBoundaryType(supabase: Client, typeId: number | string) {
  invalidateCache("boundary_types");
  return supabase.from("country_boundary_types").delete().eq("id", String(typeId));
}

// map_shapes — by country + boundary_type, excluding retired. Used both for
// the admin's "find matching boundaries" (paginated, id-only) and the
// politician's browse-container dropdown (small list, id+name, ordered by name).
export async function getMapShapesByType(
  supabase: Client,
  {
    country,
    boundaryType,
    columns = "id",
    orderBy = "id",
    paginated = false,
  }: { country: string; boundaryType: string; columns?: string; orderBy?: string; paginated?: boolean }
) {
  const buildQuery = (from?: number, to?: number) => {
    let q = supabase
      .from("map_shapes")
      .select(columns)
      .eq("country", country)
      .eq("boundary_type", boundaryType)
      .is("retired_at", null)
      .order(orderBy);
    if (paginated && from !== undefined && to !== undefined) q = q.range(from, to);
    return q;
  };
  if (paginated) return fetchAllPages((from, to) => buildQuery(from, to));
  return buildQuery();
}

// rpc find_shapes_in_containers — paginated, cache-backed containment lookup.
export async function findShapesInContainers(
  supabase: Client,
  {
    containerShapeIds,
    targetBoundaryType,
    country,
    columns = "id",
  }: { containerShapeIds: number[]; targetBoundaryType: string; country?: string; columns?: string }
) {
  return fetchAllPages((from, to) =>
    supabase
      .rpc("find_shapes_in_containers", {
        p_container_shape_ids: containerShapeIds,
        p_target_boundary_type: targetBoundaryType,
        p_country: country || undefined,
      })
      .select(columns)
      .range(from, to)
  );
}

// map_shapes — ids only, by upload batch, excluding retired, paginated.
export async function getMapShapeIdsByUploadId(supabase: Client, uploadId: number | string) {
  return fetchAllPages((from, to) =>
    supabase
      .from("map_shapes")
      .select("id")
      .eq("upload_id", String(uploadId))
      .is("retired_at", null)
      .order("id")
      .range(from, to)
  );
}

// map_shapes — exact count (head request, no row payload) by upload batch.
export async function countMapShapesByUploadId(
  supabase: Client,
  uploadId: number | string,
  { retired = false }: { retired?: boolean } = {}
) {
  let q = supabase.from("map_shapes").select("id", { count: "exact", head: true }).eq("upload_id", String(uploadId));
  q = retired ? q.not("retired_at", "is", null) : q.is("retired_at", null);
  return q;
}

// map_shapes — display rows for an upload's expanded row, capped + searchable.
export async function getMapShapesForUploadRow(
  supabase: Client,
  uploadId: number | string,
  { nameSearch = "", limit = 200 }: { nameSearch?: string; limit?: number } = {}
) {
  let q = supabase.from("map_shapes").select("id, name, retired_at").eq("upload_id", String(uploadId)).order("name").limit(limit);
  if (nameSearch.trim()) q = q.ilike("name", `%${nameSearch.trim()}%`);
  return q;
}

// map_shapes — code column only, used to detect already-inserted shapes when resuming an upload.
export async function getMapShapeCodesByUploadId(supabase: Client, uploadId: number | string) {
  return supabase.from("map_shapes").select("code").eq("upload_id", String(uploadId));
}

// map_shapes — most recently created, unfiltered (includes retired), capped.
export async function getRecentMapShapes(supabase: Client, { limit = 50 }: { limit?: number } = {}) {
  return supabase
    .from("map_shapes")
    .select("id, name, country, boundary_type, retired_at")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function deleteMapShape(supabase: Client, shapeId: number) {
  return supabase.from("map_shapes").delete().eq("id", shapeId);
}

// map_shapes — single shape by id, for the public boundary directory page.
export async function getMapShapeById(supabase: Client, shapeId: number | string) {
  return supabase
    .from("map_shapes")
    .select("id, name, country, boundary_type, code, properties, retired_at")
    .eq("id", Number(shapeId))
    .is("retired_at", null)
    .single();
}

// shape_containers — the container shape(s) (e.g. a province) this shape
// sits inside, for building a breadcrumb on the boundary directory page.
export async function getShapeContainers(supabase: Client, shapeId: number | string) {
  return supabase
    .from("shape_containers")
    .select("container_shape_id, map_shapes:container_shape_id(id, name, boundary_type)")
    .eq("map_shape_id", Number(shapeId));
}

// shape_containers — batched variant of getShapeContainers, for resolving
// every container (e.g. a user's Province) that ANY of their boundary
// memberships sits inside in one round trip. Used by PoliticianSidebar to
// find the Premier's Province shape for a user whose only memberships are
// riding-level (Province is an admin_only container, never a membership
// itself — see 20260727000001_admin_only_boundary_types.sql).
export async function getContainersForShapeIds(supabase: Client, shapeIds: (number | string)[]) {
  if (!shapeIds.length) return { data: [], error: null };
  return supabase
    .from("shape_containers")
    .select("container_shape_id, map_shapes:container_shape_id(id, name, boundary_type)")
    .in("map_shape_id", shapeIds.map(Number));
}

// map_shapes — the single National-level shape (id anchor for the Prime
// Minister / President office_holders row) for a country, if one exists. See
// 20260809000000_national_and_province_head_roles.sql.
export async function getNationalShapeForCountry(supabase: Client, country: string) {
  return supabase
    .from("map_shapes")
    .select("id, name")
    .eq("country", country)
    .eq("boundary_type", "National")
    .is("retired_at", null)
    .maybeSingle();
}

// map_shapes — canonical candidate-list query for BoundaryPicker: broad
// columns, optional multi-type + country filters, excludes retired, paginated.
export async function getBoundaryCandidates(
  supabase: Client,
  { boundaryTypeFilter, countryFilter }: { boundaryTypeFilter?: string[]; countryFilter?: string } = {}
) {
  return fetchAllPages((from, to) => {
    let q = supabase
      .from("map_shapes")
      .select("id, name, country, boundary_type, code, properties")
      .is("retired_at", null)
      .order("name")
      .order("id")
      .range(from, to);
    if (boundaryTypeFilter?.length) q = q.in("boundary_type", boundaryTypeFilter);
    if (countryFilter) q = q.eq("country", countryFilter);
    return q;
  });
}

// rpc get_geojson_shapes — bulk or single-id geometry fetch.
export async function getGeojsonShapes(
  supabase: Client,
  ids: number[],
  { single = false }: { single?: boolean } = {}
) {
  const q = supabase.rpc("get_geojson_shapes", { ids });
  return single ? q.single() : q;
}

// ── boundary_uploads ─────────────────────────────────────────────────────
export async function listBoundaryUploads(
  supabase: Client,
  {
    country,
    columns = "id, name, country, boundary_type, created_at, expected_count, completed_at",
  }: { country?: string; columns?: string } = {}
) {
  let q = supabase.from("boundary_uploads").select(columns).order("created_at", { ascending: false });
  if (country) q = q.eq("country", country);
  return q;
}

export async function renameBoundaryUpload(supabase: Client, uploadId: number | string, name: string) {
  return supabase.from("boundary_uploads").update({ name }).eq("id", String(uploadId));
}

export async function createBoundaryUpload(
  supabase: Client,
  {
    name,
    country,
    boundaryType,
    expectedCount,
  }: { name: string; country: string; boundaryType: string; expectedCount: number }
) {
  return supabase
    .from("boundary_uploads")
    .insert({ name, country, boundary_type: boundaryType, expected_count: expectedCount })
    .select()
    .single();
}

export async function finalizeBoundaryUpload(supabase: Client, uploadId: number | string, completedAt: string) {
  return supabase.from("boundary_uploads").update({ completed_at: completedAt }).eq("id", String(uploadId));
}

export async function deleteBoundaryUpload(supabase: Client, uploadId: number | string) {
  return supabase.rpc("delete_boundary_upload", { p_upload_id: String(uploadId) });
}

// ── redistricting rpcs ───────────────────────────────────────────────────
export async function suggestReplacedShapes(supabase: Client, uploadId: number | string) {
  return fetchAllPages((from, to) =>
    supabase.rpc("suggest_replaced_shapes", { p_upload_id: String(uploadId) }).range(from, to)
  );
}

export async function previewRetirementCoverageGap(supabase: Client, shapeIds: number[]) {
  return fetchAllPages((from, to) =>
    supabase.rpc("preview_retirement_coverage_gap", { p_shape_ids: shapeIds }).range(from, to)
  );
}

export async function retireShapes(supabase: Client, shapeIds: number[]) {
  return supabase.rpc("retire_shapes", { p_shape_ids: shapeIds });
}

export async function deleteShapes(supabase: Client, shapeIds: number[]) {
  return supabase.rpc("delete_shapes", { p_shape_ids: shapeIds });
}

// ── bulk shape insert rpcs (upload pipeline) ────────────────────────────
export async function insertMapShapesBatch(supabase: Client, shapes: Json) {
  return supabase.rpc("insert_map_shapes_batch", { p_shapes: shapes });
}

// map_shapes — debounced name search (StepLocation's manual jurisdiction
// search; also the office-holders admin picker, narrowed by country +
// boundaryType there since a US House-sized type has 435+ rows).
export async function searchMapShapesByName(
  supabase: Client,
  query: string,
  { limit = 15, country, boundaryType }: { limit?: number; country?: string; boundaryType?: string } = {}
) {
  let q = supabase
    .from("map_shapes")
    .select("id, name, country, boundary_type")
    .is("retired_at", null)
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(limit);
  if (country) q = q.eq("country", country);
  if (boundaryType) q = q.eq("boundary_type", boundaryType);
  return q;
}

// rpc sync_user_boundary_memberships — side-effecting, syncs memberships from a lat/lng.
export async function syncUserBoundaryMemberships(supabase: Client, lat: number, lng: number) {
  return supabase.rpc("sync_user_boundary_memberships", { p_lat: lat, p_lng: lng });
}

// rpc add_user_boundary_membership — manually add one membership by shape id.
export async function addUserBoundaryMembership(supabase: Client, shapeId: number) {
  return supabase.rpc("add_user_boundary_membership", { p_map_shape_id: shapeId });
}

// rpc find_boundaries_by_point — used by StepLocation's onboarding lookup.
export async function findBoundariesByPoint(supabase: Client, lat: number, lng: number) {
  return supabase.rpc("find_boundaries_by_point", { lng, lat });
}

export async function insertMapShape(
  supabase: Client,
  {
    country,
    boundaryType,
    name,
    code,
    properties,
    geojson,
    uploadId,
  }: {
    country: string;
    boundaryType: string;
    name: string;
    code?: string | null;
    properties?: Json;
    geojson: Json;
    uploadId?: string | null;
  }
) {
  // The generated RPC overload types mark p_code/p_properties as required,
  // non-nullable `string`/`Json` -- that's a codegen artifact of Postgres
  // function params not carrying a "this accepts SQL NULL" flag, not a real
  // runtime constraint (the column itself is nullable). Cast at the call
  // site rather than force `code`/`properties` non-null in this function's
  // own signature, which would be the actual lie.
  return supabase.rpc("insert_map_shape", {
    p_country: country,
    p_boundary_type: boundaryType,
    p_name: name,
    p_code: code,
    p_properties: properties,
    p_geojson: geojson,
    p_upload_id: uploadId,
  } as {
    p_country: string;
    p_boundary_type: string;
    p_name: string;
    p_code: string;
    p_properties: Json;
    p_geojson: Json;
    p_upload_id?: string;
  });
}
