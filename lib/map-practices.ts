import { getBestAddressFromFields } from "@/lib/address-display";
import { prisma } from "@/lib/prisma";
import { getMapFocalAnchor, type MapAnchorRow, type MapHubAnchor } from "@/lib/map-hub";

export type MapPracticeStage =
  | "cold"
  | "no_reply"
  | "positive_reply"
  | "follow_up_interested"
  | "negative_reply"
  | "follow_up_not_interested";

export type MapPractice = {
  name: string;
  address: string;
  slug: string;
  stage: MapPracticeStage;
};

/** Max practices on the dashboard map — nearest to the focal hub first (see loadPracticesForMap). */
export const MAP_PRACTICE_DISPLAY_LIMIT = 750;

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

function haversineKm(originLat: number, originLng: number, lat: number, lng: number): number {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat - originLat);
  const dLng = toR(lng - originLng);
  const aLat = toR(originLat);
  const bLat = toR(lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** Rough sort key when DB coords missing — London / home counties first so geocoding budget goes nearby. */
function regionProximityRank(address: string): number {
  const u = address.toLowerCase();
  if (u.includes("london")) return 0;
  if (/\b(sw|w|nw|n|ne|e|se|ec)[1-9]?[0-9]?\b/i.test(u)) return 1;
  if (
    /\b(surrey|kent|essex|hertfordshire|herts|berkshire|berks|buckinghamshire|bucks|oxfordshire|oxon|middlesex|middx)\b/i.test(
      u
    )
  ) {
    return 2;
  }
  return 3;
}

type Enriched = {
  practice: MapPractice;
  lat: number | null;
  lng: number | null;
  distKm: number;
  regionRank: number;
};

function compareEnriched(a: Enriched, b: Enriched): number {
  if (a.lat != null && b.lat != null && Math.abs(a.distKm - b.distKm) > 1e-9) {
    return a.distKm - b.distKm;
  }
  if (a.lat != null && b.lat == null) return -1;
  if (a.lat == null && b.lat != null) return 1;
  if (a.regionRank !== b.regionRank) return a.regionRank - b.regionRank;
  return a.practice.name.localeCompare(b.practice.name);
}

/**
 * Practices nearest to the map focal point (Icon Architects by default), capped at
 * {@link MAP_PRACTICE_DISPLAY_LIMIT}. Rows with DB coordinates sort by haversine distance; others
 * defer to a London / south-east heuristic until geocoded on the client.
 */
export async function loadPracticesForMap(): Promise<{
  practices: MapPractice[];
  initialGeocodes: Record<string, { lat: number; lng: number; displayName?: string }>;
  focalAnchor: MapHubAnchor;
}> {
  const rows = await prisma.architect.findMany({
    select: {
      url: true,
      name: true,
      address: true,
      description: true,
      latitude: true,
      longitude: true,
      lead: { select: { stage: true } },
    },
    orderBy: { name: "asc" },
  });

  const focalAnchor = getMapFocalAnchor(rows as MapAnchorRow[]);

  const enriched: Enriched[] = [];

  for (const r of rows) {
    const addr =
      getBestAddressFromFields(r.address ?? "", r.description ?? "")?.trim() || "";
    if (!addr) continue;

    const stage = (r.lead?.stage ?? "cold") as MapPracticeStage;
    const lat = r.latitude;
    const lng = r.longitude;
    const distKm =
      lat != null && lng != null
        ? haversineKm(focalAnchor.lat, focalAnchor.lng, lat, lng)
        : Number.POSITIVE_INFINITY;

    enriched.push({
      practice: {
        name: r.name,
        address: addr,
        slug: slugFromUrl(r.url),
        stage,
      },
      lat,
      lng,
      distKm,
      regionRank: regionProximityRank(addr),
    });
  }

  enriched.sort(compareEnriched);

  let picked = enriched.slice(0, MAP_PRACTICE_DISPLAY_LIMIT);

  const hubSlug = focalAnchor.slug;
  if (hubSlug) {
    const hasHub = picked.some((x) => x.practice.slug === hubSlug);
    if (!hasHub) {
      const hubRow = enriched.find((x) => x.practice.slug === hubSlug);
      if (hubRow) {
        if (picked.length >= MAP_PRACTICE_DISPLAY_LIMIT) picked = picked.slice(0, -1);
        picked.push(hubRow);
        picked.sort(compareEnriched);
      }
    }
  }

  const practices = picked.map((x) => x.practice);
  const initialGeocodes: Record<string, { lat: number; lng: number; displayName?: string }> = {};

  for (const x of picked) {
    if (x.lat != null && x.lng != null) {
      initialGeocodes[x.practice.address] = { lat: x.lat, lng: x.lng };
    }
  }

  return { practices, initialGeocodes, focalAnchor };
}
