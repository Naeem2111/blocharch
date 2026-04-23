"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useMemo } from "react";

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
};

const STAGE_COLORS: Record<Stage, string> = {
  cold: "#0ea5e9",
  no_reply: "#f59e0b",
  positive_reply: "#22c55e",
  follow_up_interested: "#10b981",
  negative_reply: "#ef4444",
  follow_up_not_interested: "#f97316",
};

const iconCache = new Map<Stage, L.DivIcon>();

function markerIcon(stage: Stage): L.DivIcon {
  const cached = iconCache.get(stage);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "lead-stage-pin-wrap",
    html: `<span class="lead-stage-pin" style="--pin-color:${STAGE_COLORS[stage]}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  iconCache.set(stage, icon);
  return icon;
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
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon(m.stage)}>
            <Popup>
              <div>
                <div className="font-semibold">{m.name}</div>
                {m.subtitle && <div className="text-sm opacity-80">{m.subtitle}</div>}
                {m.href && (
                  <a className="text-sm text-brand-600 underline" href={m.href}>
                    View
                  </a>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
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
      `}</style>
    </div>
  );
}

