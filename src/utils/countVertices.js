// Counts coordinate points in a Polygon/MultiPolygon geometry — the same
// thing PostGIS's ST_NPoints computes, done client-side before anything
// touches the database so the admin upload flow can show a vertex-count
// histogram and cutoff before inserting anything.
export function countVertices(geometry) {
  if (!geometry) return 0;
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    return coordinates.reduce((sum, ring) => sum + ring.length, 0);
  }
  if (type === 'MultiPolygon') {
    return coordinates.reduce(
      (sum, polygon) => sum + polygon.reduce((s, ring) => s + ring.length, 0),
      0
    );
  }
  return 0;
}
