/**
 * Utility functions for generating and parsing clean, human-friendly SEO slugs
 */

export function slugifyText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * Extracts a UUID or short hex hash from a raw UUID or a slugified URL string.
 * Examples:
 * - "councillor-vancouver-94349f" -> "94349f"
 * - "councillor-vancouver-94349f27-b356-48c6-bae3-bb0f6c4c54e0" -> "94349f27-b356-48c6-bae3-bb0f6c4c54e0"
 */
export function extractIdFromSlug(slugOrId: string | null | undefined): string {
  if (!slugOrId) return "";
  
  // 1. Full 36-character UUID match
  const fullUuidMatch = slugOrId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (fullUuidMatch) {
    return fullUuidMatch[0];
  }

  // 2. Short hex hash match at end of slug (e.g. -94349f or -f99413)
  const shortHexMatch = slugOrId.match(/-([0-9a-f]{6,8})$/i);
  if (shortHexMatch) {
    return shortHexMatch[1];
  }

  return slugOrId;
}

/**
 * Build clean SEO slug for an election seat: councillor-vancouver-94349f
 */
export function buildSeatSlug(seat: {
  id?: string;
  role_title?: string;
  map_shapes?: { name?: string } | null;
}): string {
  if (!seat?.id) return "";
  const role = seat.role_title ? slugifyText(seat.role_title) : "seat";
  const area = seat.map_shapes?.name ? slugifyText(seat.map_shapes.name) : "";
  const textPart = area ? `${role}-${area}` : role;
  const shortHash = seat.id.replace(/-/g, "").slice(0, 6);
  return `${textPart}-${shortHash}`;
}

/**
 * Build clean SEO slug for a candidate: marcus-whitfield-f99413
 */
export function buildCandidateSlug(candidate: {
  id?: string;
  display_name?: string;
  profiles?: { full_name?: string } | null;
}): string {
  if (!candidate?.id) return "";
  const name =
    candidate.display_name ||
    candidate.profiles?.full_name ||
    "candidate";
  const shortHash = candidate.id.replace(/-/g, "").slice(0, 6);
  return `${slugifyText(name)}-${shortHash}`;
}

/**
 * Build clean SEO slug for a boundary directory page: surrey-42
 * map_shapes.id is a plain bigint (not a UUID), so it's appended as-is
 * rather than hashed -- extractShapeIdFromSlug below relies on that.
 */
export function buildBoundarySlug(shape: { id?: number | string; name?: string }): string {
  if (shape?.id == null) return "";
  const text = shape.name ? slugifyText(shape.name) : "boundary";
  return `${text}-${shape.id}`;
}

/**
 * Extracts a map_shapes numeric id from a raw id or a buildBoundarySlug string.
 * Examples:
 * - "surrey-42" -> "42"
 * - "42" -> "42"
 */
export function extractShapeIdFromSlug(slugOrId: string | null | undefined): string {
  if (!slugOrId) return "";
  const match = slugOrId.match(/-?(\d+)$/);
  return match ? match[1] : slugOrId;
}
