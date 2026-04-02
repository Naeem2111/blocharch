import { setCachedGeocode, type GeoPoint, normalizeAddress, getCachedGeocode } from "@/lib/geo/store";

function getUserAgent(): string {
  // Nominatim requires a descriptive UA; allow override via env.
  return (
    process.env.GEOCODER_USER_AGENT ||
    "blocarch-dashboard (Next.js) - contact: set GEOCODER_USER_AGENT"
  );
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;

  const cached = getCachedGeocode(normalized);
  if (cached) return cached;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", address);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": getUserAgent(),
      "Accept-Language": "en",
    },
    // Helps Next/Vercel avoid caching at the edge unexpectedly
    cache: "no-store",
  });

  if (!res.ok) return null;
  const json = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  const first = json?.[0];
  if (!first?.lat || !first?.lon) return null;

  const point: GeoPoint = {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
  };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;

  setCachedGeocode(address, point);
  return point;
}
