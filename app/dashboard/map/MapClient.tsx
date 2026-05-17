"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapPracticeStage } from "@/lib/map-practices";

import { hubUsesIconStudio, type MapHubAnchor } from "@/lib/map-hub";

const LeafletMap = dynamic(async () => (await import("@/components/LeafletMap")).LeafletMap, {
  ssr: false,
  loading: () => (
    <div className="card-tool flex h-[520px] items-center justify-center rounded-2xl ring-1 ring-white/[0.06]">
      <p className="text-slate-400 text-sm">Loading map…</p>
    </div>
  ),
});

type Practice = { name: string; address: string; slug: string; stage: MapPracticeStage };

const STAGE_META: Record<MapPracticeStage, { label: string; color: string }> = {
  cold: { label: "Cold", color: "#0ea5e9" },
  no_reply: { label: "No reply", color: "#f59e0b" },
  positive_reply: { label: "Positive reply", color: "#22c55e" },
  follow_up_interested: { label: "Follow-up interested", color: "#10b981" },
  negative_reply: { label: "Negative reply", color: "#ef4444" },
  follow_up_not_interested: { label: "Follow-up not interested", color: "#f97316" },
};

/** Per-request batch size for Nominatim (uncached addresses only). */
const GEOCODE_CHUNK = 8;

type GeocodeEntry = { lat: number; lng: number; displayName?: string };

export function MapClient({
  practices,
  initialGeocodes,
  hubAnchor,
}: {
  practices: Practice[];
  initialGeocodes: Record<string, GeocodeEntry>;
  hubAnchor: MapHubAnchor | null;
}) {
  const [results, setResults] = useState<Record<string, GeocodeEntry>>(() => ({ ...initialGeocodes }));
  const [loading, setLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);

  const initialKey = useMemo(() => Object.keys(initialGeocodes).sort().join("|"), [initialGeocodes]);
  const initialGeoRef = useRef(initialGeocodes);
  initialGeoRef.current = initialGeocodes;

  const practiceKey = useMemo(
    () => practices.map((p) => `${p.slug}\t${p.address}`).join("\n"),
    [practices]
  );

  useEffect(() => {
    setResults({ ...initialGeocodes });
  }, [initialGeocodes, initialKey]);

  useEffect(() => {
    let cancelled = false;
    const prefilled = new Set(Object.keys(initialGeoRef.current));
    const missing = practices
      .map((p) => p.address)
      .filter((addr) => addr && !prefilled.has(addr));

    const uniqueMissing = Array.from(new Set(missing));
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueMissing.length; i += GEOCODE_CHUNK) {
      chunks.push(uniqueMissing.slice(i, i + GEOCODE_CHUNK));
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
            setResults((prev) => {
              const next = { ...prev };
              for (const [addr, row] of Object.entries(json.results)) {
                next[addr] = {
                  lat: (row as GeocodeEntry).lat,
                  lng: (row as GeocodeEntry).lng,
                  displayName: (row as GeocodeEntry).displayName,
                };
              }
              return next;
            });
          }
          setChunksDone(i + 1);
        }
      } catch (e) {
        if (!cancelled) setGeocodeError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (uniqueMissing.length) run();
    else {
      setChunksTotal(0);
      setChunksDone(0);
    }

    return () => {
      cancelled = true;
    };
  }, [practiceKey, initialKey]);

  const markers = useMemo(() => {
    const out: Array<{
      id: string;
      name: string;
      lat: number;
      lng: number;
      stage: MapPracticeStage;
      subtitle?: string;
      href?: string;
      hub?: boolean;
      hubDetail?: string;
    }> = [];
    const hubSlug = hubAnchor?.slug;
    for (const p of practices) {
      const r = results[p.address];
      const isHub = Boolean(hubSlug && p.slug === hubSlug);

      if (!r && !(isHub && hubAnchor)) continue;

      const lat = isHub && hubAnchor ? hubAnchor.lat : r!.lat;
      const lng = isHub && hubAnchor ? hubAnchor.lng : r!.lng;

      out.push({
        id: p.slug,
        name: p.name,
        lat,
        lng,
        stage: p.stage,
        subtitle:
          isHub && hubAnchor
            ? undefined
            : r?.displayName || p.address,
        href: `/dashboard/practices/${encodeURIComponent(p.slug)}`,
        hub: isHub,
        hubDetail:
          isHub && hubAnchor && hubUsesIconStudio(hubAnchor)
            ? "5 Plato Place, 72–74 St Dionis Road, London SW6 4TU · Blocharch hub"
            : undefined,
      });
    }
    return out;
  }, [practices, results, hubAnchor]);

  const initialZoom = hubAnchor ? 11 : 6;
  const center = useMemo(() => {
    if (hubAnchor) return { lat: hubAnchor.lat, lng: hubAnchor.lng };
    if (markers.length === 0) return { lat: 54.5, lng: -3.0 };
    const avgLat = markers.reduce((s, m) => s + m.lat, 0) / markers.length;
    const avgLng = markers.reduce((s, m) => s + m.lng, 0) / markers.length;
    return { lat: avgLat, lng: avgLng };
  }, [hubAnchor, markers]);

  const stageCounts = useMemo(() => {
    const counts: Record<MapPracticeStage, number> = {
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

  const practicesWithDbCoords = practices.filter((p) => initialGeocodes[p.address]).length;
  const pendingGeocode = practices.filter((p) => p.address && !results[p.address]).length;
  const geocodeProgress = chunksTotal > 0 ? ` — batch ${chunksDone}/${chunksTotal}` : "";

  let statusExtra = "";
  if (practicesWithDbCoords > 0 && pendingGeocode === 0) {
    statusExtra = ` All ${markers.length} coordinates loaded from the database.`;
  } else if (practicesWithDbCoords > 0 && pendingGeocode > 0) {
    statusExtra = ` ${practicesWithDbCoords} from database; geocoding ${pendingGeocode} remainder${loading ? `…${geocodeProgress}` : ""}.`;
  } else if (pendingGeocode > 0 && loading) {
    statusExtra = ` Geocoding…${geocodeProgress}`;
  } else if (pendingGeocode > 0) {
    statusExtra = ` ${pendingGeocode} without stored coordinates — run npm run geocode:architects to backfill.`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500 text-sm">
          Showing {markers.length} of {practices.length} practice{practices.length === 1 ? "" : "s"} with address.
          {statusExtra}
        </p>
        <p className="text-slate-500 text-sm">
          {hubAnchor
            ? hubUsesIconStudio(hubAnchor)
              ? `${hubAnchor.name} at Plato Place (SW6) is the centre — zoom out for the full UK pipeline.`
              : `Framed from ${hubAnchor.name} — zoom out for the full UK pipeline.`
            : "Clusters zoom apart; open a practice for its detail map."}
        </p>
      </div>
      {geocodeError && (
        <p className="text-amber-400/90 text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {geocodeError}
        </p>
      )}
      <LeafletMap markers={markers} center={center} zoom={initialZoom} />
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Automation stage colors</p>
        {hubAnchor && hubUsesIconStudio(hubAnchor) ? (
          <p className="text-xs text-slate-500 mb-3">
            Large amber glow — Blocharch hub: {hubAnchor.name} at 5 Plato Place, St Dionis Road, London SW6 4TU (
            <a
              href="https://www.icon-architects.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              icon-architects.com
            </a>
            ). Other firms radiate outward on the map (clusters spread when you zoom).
          </p>
        ) : hubAnchor ? (
          <p className="text-xs text-slate-500 mb-3">
            Blocharch hub pin — {hubAnchor.name}. Zoom out to see practices across the UK.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {(Object.keys(STAGE_META) as MapPracticeStage[]).map((stage) => (
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
