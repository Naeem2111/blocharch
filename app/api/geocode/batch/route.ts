import { NextRequest } from "next/server";
import { getBestAddressFromFields } from "@/lib/address-display";
import { geocodeAddress } from "@/lib/geo/nominatim";
import { getCachedGeocode, normalizeAddress } from "@/lib/geo/store";
import { prisma } from "@/lib/prisma";

/** Vercel / long-running: uncached Nominatim calls are sequential (~1.1s each). */
export const maxDuration = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function buildAddressToArchitectIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const rows = await prisma.architect.findMany({
    where: { OR: [{ latitude: null }, { longitude: null }] },
    select: { id: true, address: true, description: true },
  });
  for (const row of rows) {
    const addr = getBestAddressFromFields(row.address ?? "", row.description ?? "");
    if (!addr) continue;
    map.set(normalizeAddress(addr), row.id);
  }
  return map;
}

async function persistGeocodeToDb(
  address: string,
  point: { lat: number; lng: number },
  idByAddress: Map<string, string>
) {
  const id = idByAddress.get(normalizeAddress(address));
  if (!id) return;
  await prisma.architect.update({
    where: { id },
    data: {
      latitude: point.lat,
      longitude: point.lng,
      geocodedAt: new Date(),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const addresses = Array.isArray(body.addresses) ? (body.addresses as string[]) : [];
  const limit = Math.min(200, Math.max(1, Number(body.limit ?? 50)));
  const persist = body.persist !== false;

  const unique = Array.from(
    new Set(addresses.map((a) => (typeof a === "string" ? a.trim() : "")).filter(Boolean))
  ).slice(0, limit);

  const results: Record<string, { lat: number; lng: number; displayName?: string; cached: boolean }> = {};
  const missing: string[] = [];
  const idByAddress = persist ? await buildAddressToArchitectIdMap() : new Map();

  // Respect Nominatim policy: max ~1 req/sec. Only geocode uncached addresses, sequentially.
  for (const addr of unique) {
    const cached = getCachedGeocode(addr);
    if (cached) {
      results[addr] = { ...cached, cached: true };
      if (persist) await persistGeocodeToDb(addr, cached, idByAddress);
      continue;
    }
    const point = await geocodeAddress(addr);
    if (!point) {
      missing.push(addr);
    } else {
      results[addr] = { ...point, cached: false };
      if (persist) await persistGeocodeToDb(addr, point, idByAddress);
    }
    await sleep(1100);
  }

  return Response.json({ results, missing, count: unique.length });
}

