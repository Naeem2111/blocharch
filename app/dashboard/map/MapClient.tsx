"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAP_PRACTICE_DISPLAY_LIMIT, type MapPracticeStage } from "@/lib/map-practices";

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

const MAP_FOCAL_SYNTHETIC_ID = "__blocharch_map_focal__";

const STAGE_META: Record<MapPracticeStage, { label: string; color: string }> = {
  cold: { label: "Cold", color: "#0ea5e9" },
  no_reply: { label: "No reply", color: "#f59e0b" },
  positive_reply: { label: "Positive reply", color: "#22c55e" },
  follow_up_interested: { label: "Follow-up interested", color: "#10b981" },
  negative_reply: { label: "Negative reply", color: "#ef4444" },
  follow_up_not_interested: { label: "Follow-up not interested", color: "#f97316" },
};

/** Per-request batch size for Nominatim (uncached addresses only). Order follows proximity-sorted practices. */
const GEOCODE_CHUNK = 8;

type GeocodeEntry = { lat: number; lng: number; displayName?: string };

export function MapClient({
  practices,
  initialGeocodes,
  focalAnchor,
}: {
  practices: Practice[];
  initialGeocodes: Record<string, GeocodeEntry>;
  focalAnchor: MapHubAnchor;
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

  const markersBase = useMemo(() => {
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
    const hubSlug = focalAnchor.slug;
    for (const p of practices) {
      const r = results[p.address];
      const isHub = Boolean(hubSlug && p.slug === hubSlug);

      if (!r && !(isHub && focalAnchor)) continue;

      const lat = isHub && focalAnchor ? focalAnchor.lat : r!.lat;
      const lng = isHub && focalAnchor ? focalAnchor.lng : r!.lng;

      out.push({
        id: p.slug,
        name: p.name,
        lat,
        lng,
        stage: p.stage,
        subtitle:
          isHub && focalAnchor
            ? undefined
            : r?.displayName || p.address,
        href: `/dashboard/practices/${encodeURIComponent(p.slug)}`,
        hub: isHub,
        hubDetail:
          isHub && focalAnchor && hubUsesIconStudio(focalAnchor)
            ? "5 Plato Place, 72–74 St Dionis Road, London SW6 4TU · Blocharch hub"
            : undefined,
      });
    }
    return out;
  }, [practices, results, focalAnchor]);

  const markers = useMemo(() => {
    const list = [...markersBase];
    const needsSyntheticPin =
      hubUsesIconStudio(focalAnchor) && !markersBase.some((m) => m.hub);
    if (needsSyntheticPin) {
      list.unshift({
        id: MAP_FOCAL_SYNTHETIC_ID,
        name: focalAnchor.name,
        lat: focalAnchor.lat,
        lng: focalAnchor.lng,
        stage: "cold",
        hub: true,
        hubDetail: "5 Plato Place, 72–74 St Dionis Road, London SW6 4TU · Blocharch hub",
        href: "https://www.icon-architects.com/",
      });
    }
    return list;
  }, [markersBase, focalAnchor]);

  const initialZoom = hubUsesIconStudio(focalAnchor) ? 13 : 11;

  const center = useMemo(
    () => ({ lat: focalAnchor.lat, lng: focalAnchor.lng }),
    [focalAnchor.lat, focalAnchor.lng]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<MapPracticeStage, number> = {
      cold: 0,
      no_reply: 0,
      positive_reply: 0,
      follow_up_interested: 0,
      negative_reply: 0,
      follow_up_not_interested: 0,
    };
    for (const m of markers) {
      if (m.id === MAP_FOCAL_SYNTHETIC_ID) continue;
      counts[m.stage] += 1;
    }
    return counts;
  }, [markers]);

  const practicesWithDbCoords = practices.filter((p) => initialGeocodes[p.address]).length;
  const pendingGeocode = practices.filter((p) => p.address && !results[p.address]).length;
  const geocodeProgress = chunksTotal > 0 ? ` — batch ${chunksDone}/${chunksTotal}` : "";

  let statusExtra = "";
  if (practicesWithDbCoords > 0 && pendingGeocode === 0) {
    statusExtra = ` All ${markers.filter((m) => m.id !== MAP_FOCAL_SYNTHETIC_ID).length} practice pins loaded from the database.`;
  } else if (practicesWithDbCoords > 0 && pendingGeocode > 0) {
    statusExtra = ` ${practicesWithDbCoords} from database; geocoding ${pendingGeocode} more (nearest-first queue)${loading ? `…${geocodeProgress}` : ""}.`;
  } else if (pendingGeocode > 0 && loading) {
    statusExtra = ` Geocoding…${geocodeProgress}`;
  } else if (pendingGeocode > 0) {
    statusExtra = ` ${pendingGeocode} without stored coordinates — run npm run geocode:architects to backfill.`;
  }

  const pinCount = markers.filter((m) => m.id !== MAP_FOCAL_SYNTHETIC_ID).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500 text-sm">
          Showing {pinCount} mapped practice{pinCount === 1 ? "" : "s"} — up to{" "}
          {MAP_PRACTICE_DISPLAY_LIMIT} loaded, ordered nearest-first to{" "}
          {hubUsesIconStudio(focalAnchor) ? "Icon Architects (Plato Place)" : focalAnchor.name}
          {practices.length < MAP_PRACTICE_DISPLAY_LIMIT
            ? ` (${practices.length} in directory with usable addresses).`
            : "."}
          {statusExtra}
        </p>
        <p className="text-slate-500 text-sm">
          {hubUsesIconStudio(focalAnchor)
            ? "Zoomed on Plato Place (SW6); zoom out for regional / UK context."
            : `Framed on ${focalAnchor.name} — zoom out for wider coverage.`}
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
        {hubUsesIconStudio(focalAnchor) ? (
          <p className="text-xs text-slate-500 mb-3">
            Large amber glow — Blocharch focal point: {focalAnchor.name} at 5 Plato Place, St Dionis Road, London SW6 4TU (
            <a
              href="https://www.icon-architects.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              icon-architects.com
            </a>
            ). Listed practices are prioritised by proximity to this studio.
          </p>
        ) : (
          <p className="text-xs text-slate-500 mb-3">
            Hub pin — {focalAnchor.name}. Listed practices are prioritised by proximity to this focal point.
          </p>
        )}
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
