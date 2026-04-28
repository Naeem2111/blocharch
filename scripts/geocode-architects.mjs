/**
 * One-time / periodic backfill: geocode architect addresses and store lat/lng on each row
 * so the map loads instantly without client-side Nominatim churn.
 *
 * Usage: node scripts/geocode-architects.mjs [--limit=500] [--dry-run]
 * Requires DATABASE_URL (load from .env in project root).
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();

function loadEnvFile() {
  try {
    const envPath = path.join(root, ".env");
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no .env */
  }
}

function getBestAddressFromFields(address, description) {
  const direct = String(address || "").trim();
  if (direct) return direct;
  const desc = String(description || "").trim();
  if (!desc) return null;
  const m = desc.match(
    /\bAddresses?\b\s+([\s\S]*?)(?=\bContact\b|\bEmail\b|\bWebsite\b|\bTwitter\b|\bInstagram\b|\bLinkedIn\b|\bFacebook\b|\bBack to Results\b|$)/i
  );
  if (!m?.[1]) return null;
  const extracted = m[1].replace(/\s+/g, " ").trim();
  if (!extracted) return null;
  return extracted.length > 160 ? extracted.slice(0, 160) : extracted;
}

function normalizeAddress(addr) {
  return String(addr || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function loadGeocache() {
  const cachePath = path.join(root, "data", "geocache.json");
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const j = JSON.parse(raw);
    return typeof j === "object" && j ? j : {};
  } catch {
    return {};
  }
}

function getUserAgent() {
  return (
    process.env.GEOCODER_USER_AGENT ||
    "blocarch-dashboard (geocode-architects.mjs) - set GEOCODER_USER_AGENT"
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(address) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", address);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": getUserAgent(),
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const first = Array.isArray(json) ? json[0] : null;
  if (!first?.lat || !first?.lon) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, displayName: first.display_name };
}

function parseArgs() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1], 10) || 0) : null;
  const dryRun = process.argv.includes("--dry-run");
  return { limit, dryRun };
}

loadEnvFile();
const { limit, dryRun } = parseArgs();
const prisma = new PrismaClient();
const geocache = loadGeocache();

async function main() {
  const rows = await prisma.architect.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: {
      id: true,
      url: true,
      address: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  let done = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (limit != null && updated >= limit) break;

    const addr = getBestAddressFromFields(row.address, row.description);
    if (!addr?.trim()) {
      skipped += 1;
      continue;
    }

    const key = normalizeAddress(addr);
    let point = null;
    const cached = key ? geocache[key] : null;
    if (cached?.lat != null && cached?.lng != null) {
      point = { lat: Number(cached.lat), lng: Number(cached.lng), displayName: cached.displayName };
    } else {
      console.log(`[nominatim] ${row.url.slice(0, 60)}…`);
      point = await geocodeAddress(addr);
      await sleep(1100);
    }

    if (!point) {
      skipped += 1;
      continue;
    }

    done += 1;
    if (dryRun) {
      console.log(`[dry-run] would set ${addr.slice(0, 50)} → ${point.lat}, ${point.lng}`);
      updated += 1;
      continue;
    }

    await prisma.architect.update({
      where: { id: row.id },
      data: {
        latitude: point.lat,
        longitude: point.lng,
        geocodedAt: new Date(),
      },
    });
    updated += 1;
    if (updated % 25 === 0) {
      console.log(`… ${updated} rows updated`);
    }
  }

  console.log(`Done. Geocoded: ${done}, rows written: ${updated}, skipped (no address / failed): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
