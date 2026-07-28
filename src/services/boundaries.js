import { supabase } from './supabase';
import { fetchAllPages } from '../utils/fetchAllPages';

// countries — superset columns; callers that only read `.name` are
// unaffected by the extra columns.
export async function getCountries() {
  return supabase.from('countries').select('name, code, flag_emoji').order('name');
}

export async function createCountry({ name, code, flagEmoji }) {
  return supabase.from('countries').insert({ name, code: code || null, flag_emoji: flagEmoji || null });
}

// country_boundary_types — flexible listing used by both the admin builder
// (all types for all countries, needs is_container to split container vs
// target dropdowns) and the politician's "browse a different area" filter
// (one country, is_container=true containers only, type_name only).
// admin_only and is_container are separate flags (20260729000017) --
// admin_only means "excluded from citizen boundary membership," is_container
// means "usable as an admin container to scope another type's search";
// USA's 'State' is admin_only=false (a real target/membership, for
// Governor/Senator) but is_container=true (still usable as a container,
// like Canada's Province), which is why callers that want "container types"
// must filter on is_container, not admin_only.
export async function listBoundaryTypes({ country, adminOnly, isContainer, columns = 'country, type_name, rank, admin_only, is_container', orderBy = 'rank' } = {}) {
  let q = supabase.from('country_boundary_types').select(columns).order('country').order(orderBy);
  if (country) q = q.eq('country', country);
  if (adminOnly !== undefined) q = q.eq('admin_only', adminOnly);
  if (isContainer !== undefined) q = q.eq('is_container', isContainer);
  return q;
}

// country_boundary_types — for a set of countries (FeedPage ranks memberships by type).
export async function getBoundaryTypesForCountries(countries) {
  return supabase.from('country_boundary_types').select('country, type_name, rank').in('country', countries);
}

export async function createBoundaryType({ country, typeName, rank }) {
  return supabase.from('country_boundary_types').insert({ country, type_name: typeName, rank });
}

// "Standard set" quick-seed: National / State-Province / Municipal at ranks 1-3.
export async function createStandardBoundaryTypeSet(country) {
  return supabase.from('country_boundary_types').insert([
    { country, type_name: 'National', rank: 1 },
    { country, type_name: 'State-Province', rank: 2 },
    { country, type_name: 'Municipal', rank: 3 },
  ]);
}

export async function deleteBoundaryType(typeId) {
  return supabase.from('country_boundary_types').delete().eq('id', typeId);
}

// map_shapes — by country + boundary_type, excluding retired. Used both for
// the admin's "find matching boundaries" (paginated, id-only) and the
// politician's browse-container dropdown (small list, id+name, ordered by name).
export async function getMapShapesByType({ country, boundaryType, columns = 'id', orderBy = 'id', paginated = false }) {
  const buildQuery = (from, to) => {
    let q = supabase
      .from('map_shapes')
      .select(columns)
      .eq('country', country)
      .eq('boundary_type', boundaryType)
      .is('retired_at', null)
      .order(orderBy);
    if (paginated) q = q.range(from, to);
    return q;
  };
  if (paginated) return fetchAllPages(buildQuery);
  return buildQuery();
}

// rpc find_shapes_in_containers — paginated, cache-backed containment lookup.
export async function findShapesInContainers({ containerShapeIds, targetBoundaryType, country, columns = 'id' }) {
  return fetchAllPages((from, to) =>
    supabase
      .rpc('find_shapes_in_containers', {
        p_container_shape_ids: containerShapeIds,
        p_target_boundary_type: targetBoundaryType,
        p_country: country || null
      })
      .select(columns)
      .range(from, to)
  );
}

// map_shapes — ids only, by upload batch, excluding retired, paginated.
export async function getMapShapeIdsByUploadId(uploadId) {
  return fetchAllPages((from, to) =>
    supabase.from('map_shapes').select('id').eq('upload_id', uploadId).is('retired_at', null).order('id').range(from, to)
  );
}

// map_shapes — exact count (head request, no row payload) by upload batch.
export async function countMapShapesByUploadId(uploadId, { retired = false } = {}) {
  let q = supabase.from('map_shapes').select('id', { count: 'exact', head: true }).eq('upload_id', uploadId);
  q = retired ? q.not('retired_at', 'is', null) : q.is('retired_at', null);
  return q;
}

// map_shapes — display rows for an upload's expanded row, capped + searchable.
export async function getMapShapesForUploadRow(uploadId, { nameSearch = '', limit = 200 } = {}) {
  let q = supabase.from('map_shapes').select('id, name, retired_at').eq('upload_id', uploadId).order('name').limit(limit);
  if (nameSearch.trim()) q = q.ilike('name', `%${nameSearch.trim()}%`);
  return q;
}

// map_shapes — code column only, used to detect already-inserted shapes when resuming an upload.
export async function getMapShapeCodesByUploadId(uploadId) {
  return supabase.from('map_shapes').select('code').eq('upload_id', uploadId);
}

// map_shapes — most recently created, unfiltered (includes retired), capped.
export async function getRecentMapShapes({ limit = 50 } = {}) {
  return supabase.from('map_shapes').select('id, name, country, boundary_type, retired_at').order('created_at', { ascending: false }).limit(limit);
}

export async function deleteMapShape(shapeId) {
  return supabase.from('map_shapes').delete().eq('id', shapeId);
}

// map_shapes — canonical candidate-list query for BoundaryPicker: broad
// columns, optional multi-type + country filters, excludes retired, paginated.
export async function getBoundaryCandidates({ boundaryTypeFilter, countryFilter } = {}) {
  return fetchAllPages((from, to) => {
    let q = supabase
      .from('map_shapes')
      .select('id, name, country, boundary_type, code, properties')
      .is('retired_at', null)
      .order('name')
      .order('id')
      .range(from, to);
    if (boundaryTypeFilter?.length) q = q.in('boundary_type', boundaryTypeFilter);
    if (countryFilter) q = q.eq('country', countryFilter);
    return q;
  });
}

// rpc get_geojson_shapes — bulk or single-id geometry fetch.
export async function getGeojsonShapes(ids, { single = false } = {}) {
  const q = supabase.rpc('get_geojson_shapes', { ids });
  return single ? q.single() : q;
}

// ── boundary_uploads ─────────────────────────────────────────────────────
export async function listBoundaryUploads({ country, columns = 'id, name, country, boundary_type, created_at, expected_count, completed_at' } = {}) {
  let q = supabase.from('boundary_uploads').select(columns).order('created_at', { ascending: false });
  if (country) q = q.eq('country', country);
  return q;
}

export async function renameBoundaryUpload(uploadId, name) {
  return supabase.from('boundary_uploads').update({ name }).eq('id', uploadId);
}

export async function createBoundaryUpload({ name, country, boundaryType, expectedCount }) {
  return supabase.from('boundary_uploads').insert({ name, country, boundary_type: boundaryType, expected_count: expectedCount }).select().single();
}

export async function finalizeBoundaryUpload(uploadId, completedAt) {
  return supabase.from('boundary_uploads').update({ completed_at: completedAt }).eq('id', uploadId);
}

export async function deleteBoundaryUpload(uploadId) {
  return supabase.rpc('delete_boundary_upload', { p_upload_id: uploadId });
}

// ── redistricting rpcs ───────────────────────────────────────────────────
export async function suggestReplacedShapes(uploadId) {
  return fetchAllPages((from, to) => supabase.rpc('suggest_replaced_shapes', { p_upload_id: uploadId }).range(from, to));
}

export async function previewRetirementCoverageGap(shapeIds) {
  return fetchAllPages((from, to) => supabase.rpc('preview_retirement_coverage_gap', { p_shape_ids: shapeIds }).range(from, to));
}

export async function retireShapes(shapeIds) {
  return supabase.rpc('retire_shapes', { p_shape_ids: shapeIds });
}

export async function deleteShapes(shapeIds) {
  return supabase.rpc('delete_shapes', { p_shape_ids: shapeIds });
}

// ── bulk shape insert rpcs (upload pipeline) ────────────────────────────
export async function insertMapShapesBatch(shapes) {
  return supabase.rpc('insert_map_shapes_batch', { p_shapes: shapes });
}

// map_shapes — debounced name search (StepLocation's manual jurisdiction search).
export async function searchMapShapesByName(query, { limit = 15 } = {}) {
  return supabase.from('map_shapes').select('id, name, country, boundary_type').ilike('name', `%${query}%`).limit(limit);
}

// rpc sync_user_boundary_memberships — side-effecting, syncs memberships from a lat/lng.
export async function syncUserBoundaryMemberships(lat, lng) {
  return supabase.rpc('sync_user_boundary_memberships', { p_lat: lat, p_lng: lng });
}

// rpc add_user_boundary_membership — manually add one membership by shape id.
export async function addUserBoundaryMembership(shapeId) {
  return supabase.rpc('add_user_boundary_membership', { p_map_shape_id: shapeId });
}

// rpc find_boundaries_by_point — used by StepLocation's onboarding lookup.
export async function findBoundariesByPoint(lat, lng) {
  return supabase.rpc('find_boundaries_by_point', { lng, lat });
}

export async function insertMapShape({ country, boundaryType, name, code, properties, geojson, uploadId }) {
  return supabase.rpc('insert_map_shape', {
    p_country: country, p_boundary_type: boundaryType,
    p_name: name, p_code: code, p_properties: properties,
    p_geojson: geojson, p_upload_id: uploadId
  });
}
