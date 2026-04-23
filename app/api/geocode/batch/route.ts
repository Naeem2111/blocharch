import { NextRequest } from "next/server";
import { geocodeAddress } from "@/lib/geo/nominatim";
import { getCachedGeocode } from "@/lib/geo/store";

/** Vercel / long-running: uncached Nominatim calls are sequential (~1.1s each). */
export const maxDuration = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const addresses = Array.isArray(body.addresses) ? (body.addresses as string[]) : [];
  const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)));

  const unique = Array.from(
    new Set(addresses.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean))
  ).slice(0, limit);

  const results: Record<string, { lat: number; lng: number; displayName?: string; cached: boolean }> = {};
  const missing: string[] = [];

  // Respect Nominatim policy: max ~1 req/sec. Only geocode uncached addresses, sequentially.
  for (const addr of unique) {
    const cached = getCachedGeocode(addr);
    if (cached) {
      results[addr] = { ...cached, cached: true };
      continue;
    }
    const point = await geocodeAddress(addr);
    if (!point) {
      missing.push(addr);
    } else {
      results[addr] = { ...point, cached: false };
    }
    await sleep(1100);
  }

  return Response.json({ results, missing, count: unique.length });
}

