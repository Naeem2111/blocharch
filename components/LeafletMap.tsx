"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";

type Stage =
  | "cold"
  | "no_reply"
  | "positive_reply"
  | "follow_up_interested"
  | "negative_reply"
  | "follow_up_not_interested";

type MarkerItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  stage: Stage;
  subtitle?: string;
  href?: string;
  /** First client / Blocharch hub (Icon Architects, London). */
  hub?: boolean;
};

const STAGE_COLORS: Record<Stage, string> = {
  cold: "#0ea5e9",
  no_reply: "#f59e0b",
  positive_reply: "#22c55e",
  follow_up_interested: "#10b981",
  negative_reply: "#ef4444",
  follow_up_not_interested: "#f97316",
};

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(stage: Stage, hub: boolean): L.DivIcon {
  const key = `${stage}:${hub ? "1" : "0"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const hubClass = hub ? " lead-stage-pin--hub" : "";
  const size = hub ? 20 : 16;
  const anchor = hub ? 10 : 8;
  const icon = L.divIcon({
    className: "lead-stage-pin-wrap",
    html: `<span class="lead-stage-pin${hubClass}" style="--pin-color:${STAGE_COLORS[stage]}"></span>`,
    iconSize: [size, size],
    iconAnchor: [anchor, anchor],
  });
  iconCache.set(key, icon);
  return icon;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markerSignature(markers: MarkerItem[]): string {
  return markers.map((m) => `${m.id}\t${m.lat}\t${m.lng}\t${m.stage}\t${m.hub ? "1" : "0"}`).join("\n");
}

function MapClusterLayer({ markers }: { markers: MarkerItem[] }) {
  const map = useMap();
  const sig = useMemo(() => markerSignature(markers), [markers]);

  useEffect(() => {
    if (!markers.length) return;

    const mcg = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 120,
      maxClusterRadius: 52,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: markerIcon(m.stage, Boolean(m.hub)) });
      const lines = [
        `<div class="font-semibold">${escapeHtml(m.name)}</div>`,
        m.hub ? `<div class="text-xs font-medium text-amber-700">Blocharch hub · first client</div>` : "",
        m.subtitle ? `<div class="text-sm opacity-80">${escapeHtml(m.subtitle)}</div>` : "",
        m.href
          ? `<a class="text-sm text-sky-600 underline" href="${escapeHtml(m.href)}">View</a>`
          : "",
      ].filter(Boolean);
      marker.bindPopup(lines.join(""));
      mcg.addLayer(marker);
    }

    map.addLayer(mcg);
    return () => {
      map.removeLayer(mcg);
      mcg.clearLayers();
    };
  }, [map, sig]);

  return null;
}

export function LeafletMap({
  markers,
  center,
  zoom = 6,
  heightClassName = "h-[520px]",
}: {
  markers: MarkerItem[];
  center: { lat: number; lng: number };
  zoom?: number;
  heightClassName?: string;
}) {
  const mapCenter = useMemo(() => [center.lat, center.lng] as [number, number], [center.lat, center.lng]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/[0.1] ring-1 ring-white/[0.06] ${heightClassName}`}>
      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        />
        {markers.length > 0 ? <MapClusterLayer markers={markers} /> : null}
      </MapContainer>
      <style jsx>{`
        :global(.lead-stage-pin-wrap) {
          background: transparent;
          border: none;
        }
        :global(.lead-stage-pin) {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: var(--pin-color);
          border: 2px solid #ffffff;
          box-shadow: 0 0 0 1px rgba(2, 6, 23, 0.35);
        }
        :global(.lead-stage-pin--hub) {
          width: 20px;
          height: 20px;
          border-width: 3px;
          box-shadow:
            0 0 0 2px rgba(245, 158, 11, 0.95),
            0 0 0 1px rgba(2, 6, 23, 0.35);
        }
      `}</style>
    </div>
  );
}
