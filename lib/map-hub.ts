/** Default map view when the hub has no coordinates yet (central London). */
export const LONDON_VIEW_CENTER = { lat: 51.5074, lng: -0.1278 };

export type MapHubAnchor = {
  slug: string;
  name: string;
  /** Best available coordinates — fall back to London until geocoded in DB. */
  lat: number;
  lng: number;
};

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/** Matches the first-client hub practice name (case-insensitive, anywhere in the string). */
const DEFAULT_HUB_NAME = /\bicon\s+architects\b/i;

type HubRow = {
  name: string;
  url: string;
  latitude: number | null;
  longitude: number | null;
};

export function resolveMapHub(rows: HubRow[]): MapHubAnchor | null {
  const envSlug = process.env.MAP_HUB_SLUG?.trim();
  const envName = process.env.MAP_HUB_NAME?.trim();

  if (envSlug) {
    for (const r of rows) {
      if (slugFromUrl(r.url) === envSlug) return toAnchor(r);
    }
  }

  if (envName) {
    const lower = envName.toLowerCase();
    for (const r of rows) {
      if (r.name.trim().toLowerCase() === lower) return toAnchor(r);
    }
  }

  for (const r of rows) {
    if (DEFAULT_HUB_NAME.test(r.name.trim())) return toAnchor(r);
  }

  return null;
}

function toAnchor(r: HubRow): MapHubAnchor {
  const slug = slugFromUrl(r.url);
  if (r.latitude != null && r.longitude != null) {
    return { slug, name: r.name, lat: r.latitude, lng: r.longitude };
  }
  return { slug, name: r.name, ...LONDON_VIEW_CENTER };
}
