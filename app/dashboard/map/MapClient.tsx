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

type Practice = { name: string; address: string; slug: string };

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
    </div>
  );
}

