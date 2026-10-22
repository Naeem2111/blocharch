type Bucket = {
  r: number;
  g: number;
  b: number;
  n: number;
  sr: number;
  sg: number;
  sb: number;
};

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function cluster(data: Uint8ClampedArray, skipNearWhite: boolean): Bucket[] {
  const map = new Map<string, Bucket>();
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha < 200) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (skipNearWhite && r > 245 && g > 245 && b > 245) continue;
    const qr = Math.min(255, Math.round(r / 24) * 24);
    const qg = Math.min(255, Math.round(g / 24) * 24);
    const qb = Math.min(255, Math.round(b / 24) * 24);
    const key = `${qr},${qg},${qb}`;
    const prev = map.get(key);
    if (prev) {
      prev.n += 1;
      prev.sr += r;
      prev.sg += g;
      prev.sb += b;
    } else {
      map.set(key, { r: qr, g: qg, b: qb, n: 1, sr: r, sg: g, sb: b });
    }
  }

  const buckets = Array.from(map.values()).sort((a, b) => b.n - a.n);
  const picked: Bucket[] = [];
  for (const bucket of buckets) {
    const near = picked.some((item) => {
      const dr = item.r - bucket.r;
      const dg = item.g - bucket.g;
      const db = item.b - bucket.b;
      return dr * dr + dg * dg + db * db < 40 * 40;
    });
    if (near) continue;
    picked.push(bucket);
    if (picked.length >= 8) break;
  }
  return picked;
}

function asHex(buckets: Bucket[]): string[] {
  return buckets.map((bucket) =>
    toHex(
      Math.round(bucket.sr / bucket.n),
      Math.round(bucket.sg / bucket.n),
      Math.round(bucket.sb / bucket.n),
    ),
  );
}

/** Dominant colours from RGBA pixels. Skips a white page background when the palette still has enough colour. */
export function dominantColours(data: Uint8ClampedArray, max = 8): string[] {
  const withoutWhite = asHex(cluster(data, true));
  if (withoutWhite.length >= 3) return withoutWhite.slice(0, max);
  return asHex(cluster(data, false)).slice(0, max);
}
