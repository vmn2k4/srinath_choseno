// Free-tier address geocoding via OpenStreetMap Nominatim. Shared by every
// location-picking UI (the full map picker on /find-my-district, the
// compact "find your district" widget on the homepage) so there's a single
// place owning the request shape and User-Agent header.

export interface GeocodeSuggestion {
  display_name: string;
  lat: number;
  lng: number;
}

// Choseno only has electoral-boundary coverage for these three countries
// (see /find-my-district's metadata) — restricting Nominatim to them keeps
// results relevant instead of surfacing unrelated addresses from anywhere
// in the world that happen to match the query text.
const SUPPORTED_COUNTRY_CODES = "us,ca,in";

export async function geocodeAddressFree(query: string): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 3) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query.trim()
      )}&limit=5&countrycodes=${SUPPORTED_COUNTRY_CODES}`,
      {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "Choseno-Civic-App/1.0",
        },
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data as any[]).map((item) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (err) {
    console.error("Free Geocoding error:", err);
    return [];
  }
}
