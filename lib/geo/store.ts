import fs from "fs";
import path from "path";

export type GeoPoint = {
  lat: number;
  lng: number;
  displayName?: string;
};

type GeoCacheEntry = GeoPoint & {
  updatedAt: string; // ISO
};

type GeoCache = Record<string, GeoCacheEntry>;

const DATA_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(DATA_DIR, "geocache.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function normalizeAddress(address: string): string {
  return (address || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function loadGeoCache(): GeoCache {
  ensureDataDir();
  if (!fs.existsSync(CACHE_FILE)) return {};
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as GeoCache;
  } catch {
    return {};
  }
}

export function saveGeoCache(cache: GeoCache) {
  ensureDataDir();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

export function getCachedGeocode(address: string): GeoPoint | null {
  const key = normalizeAddress(address);
  if (!key) return null;
  const cache = loadGeoCache();
  const hit = cache[key];
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng, displayName: hit.displayName };
}

export function setCachedGeocode(address: string, point: GeoPoint) {
  const key = normalizeAddress(address);
  if (!key) return;
  const cache = loadGeoCache();
  cache[key] = {
    lat: point.lat,
    lng: point.lng,
    displayName: point.displayName,
    updatedAt: new Date().toISOString(),
  };
  saveGeoCache(cache);
}
