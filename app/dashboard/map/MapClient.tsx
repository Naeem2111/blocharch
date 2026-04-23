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

export function MapClient({ practices }: { practices: Practice[] }) {
  const [results, setResults] = useState<Record<string, { lat: number; lng: number; displayName?: string }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const addresses = practices.map((p) => p.address).slice(0, 75); // avoid bulk; cached will make it faster over time
        const res = await fetch("/api/geocode/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addresses, limit: addresses.length }),
        });
        const json = await res.json();
        if (!cancelled && json?.results) {
          setResults(json.results);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (practices.length) run();
    return () => {
      cancelled = true;
    };
  }, [practices]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Showing {markers.length} pinned practice{markers.length === 1 ? "" : "s"}{" "}
          {loading ? "(geocoding…)" : ""}
        </p>
        <p className="text-slate-500 text-sm">
          Tip: open a practice to see its map.
        </p>
      </div>
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

