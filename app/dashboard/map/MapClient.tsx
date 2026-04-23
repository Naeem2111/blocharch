"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const LeafletMap = dynamic(async () => (await import("@/components/LeafletMap")).LeafletMap, {
  ssr: false,
  loading: () => (
    <div className="card-tool flex h-[520px] items-center justify-center rounded-2xl ring-1 ring-white/[0.06]">
      <p className="text-slate-400 text-sm">Loading map…</p>
    </div>
  ),
});

type Stage =
  | "cold"
  | "no_reply"
  | "positive_reply"
  | "follow_up_interested"
  | "negative_reply"
  | "follow_up_not_interested";

type Practice = { name: string; address: string; slug: string; stage: Stage };

const STAGE_META: Record<Stage, { label: string; color: string }> = {
  cold: { label: "Cold", color: "#0ea5e9" },
  no_reply: { label: "No reply", color: "#f59e0b" },
  positive_reply: { label: "Positive reply", color: "#22c55e" },
  follow_up_interested: { label: "Follow-up interested", color: "#10b981" },
  negative_reply: { label: "Negative reply", color: "#ef4444" },
  follow_up_not_interested: { label: "Follow-up not interested", color: "#f97316" },
};

/** Per-request size so server stays under typical ~10–60s limits (Nominatim ~1 req/s for misses). */
const GEOCODE_CHUNK = 6;
/** How many practices to try geocoding (progressive); avoids endless waits on first paint. */
const GEOCODE_CAP = 180;

export function MapClient({ practices }: { practices: Practice[] }) {
  const [results, setResults] = useState<Record<string, { lat: number; lng: number; displayName?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);

  const practiceKey = useMemo(
    () => practices.map((p) => `${p.slug}\t${p.address}`).join("\n"),
    [practices]
  );

  useEffect(() => {
    let cancelled = false;
    const list = practices.slice(0, GEOCODE_CAP);
    const addresses = list.map((p) => p.address).filter(Boolean);
    const chunks: string[][] = [];
    for (let i = 0; i < addresses.length; i += GEOCODE_CHUNK) {
      chunks.push(addresses.slice(i, i + GEOCODE_CHUNK));
    }

    async function run() {
      if (!chunks.length) return;
      setGeocodeError(null);
      setLoading(true);
      setChunksTotal(chunks.length);
      setChunksDone(0);
      try {
        for (let i = 0; i < chunks.length; i++) {
          if (cancelled) break;
          const slice = chunks[i];
          const res = await fetch("/api/geocode/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ addresses: slice, limit: slice.length }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            setGeocodeError(json?.error || `Geocode failed (${res.status})`);
            break;
          }
          if (json?.results && !cancelled) {
            setResults((prev) => ({ ...prev, ...json.results }));
          }
          setChunksDone(i + 1);
        }
      } catch (e) {
        if (!cancelled) setGeocodeError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setResults({});
    if (addresses.length) run();
    else {
      setChunksTotal(0);
      setChunksDone(0);
    }

    return () => {
      cancelled = true;
    };
  }, [practiceKey]);

  const markers = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      stage: Stage;
      subtitle?: string;
      href?: string;
    }> = [];
    for (const p of practices) {
      const r = results[p.address];
      if (!r) continue;
      out.push({
        id: p.slug,
        name: p.name,
        lat: r.lat,
        lng: r.lng,
        stage: p.stage,
        subtitle: r.displayName || p.address,
        href: `/dashboard/practices/${encodeURIComponent(p.slug)}`,
      });
    }
    return out;
  }, [practices, results]);

  const center = useMemo(() => {
    if (markers.length === 0) return { lat: 54.5, lng: -3.0 }; // UK-ish default
    const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
    return { lat: avgLat, lng: avgLng };
  }, [markers]);

  const stageCounts = useMemo(() => {
    const counts: Record<Stage, number> = {
      cold: 0,
      no_reply: 0,
      positive_reply: 0,
      follow_up_interested: 0,
      negative_reply: 0,
      follow_up_not_interested: 0,
    };
    for (const m of markers) counts[m.stage] += 1;
    return counts;
  }, [markers]);

  const geocodeProgress =
    chunksTotal > 0 ? ` — batch ${chunksDone}/${chunksTotal}` : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500 text-sm">
          Showing {markers.length} of {practices.length} practice{practices.length === 1 ? "" : "s"} with address
          {loading ? ` (geocoding…${geocodeProgress})` : ""}
          {!loading && practices.length > GEOCODE_CAP ? ` — first ${GEOCODE_CAP} queued for geocode` : ""}
        </p>
        <p className="text-slate-500 text-sm">Tip: open a practice to see its map.</p>
      </div>
      {geocodeError && (
        <p className="text-amber-400/90 text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {geocodeError}
        </p>
      )}
      <LeafletMap markers={markers} center={center} zoom={6} />
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Automation stage colors</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(STAGE_META) as Stage[]).map((stage) => (
            <div key={stage} className="flex items-center gap-2 text-xs text-slate-300">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STAGE_META[stage].color }}
              />
              <span>{STAGE_META[stage].label}</span>
              <span className="text-slate-500">({stageCounts[stage]})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
