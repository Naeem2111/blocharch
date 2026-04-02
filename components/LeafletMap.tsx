"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useMemo } from "react";

// Fix default marker icons in bundlers
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

type MarkerItem = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  subtitle?: string;
  href?: string;
};

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
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: iconRetinaUrl.src ?? (iconRetinaUrl as any),
      iconUrl: iconUrl.src ?? (iconUrl as any),
      shadowUrl: shadowUrl.src ?? (shadowUrl as any),
    });
  }, []);

  const mapCenter = useMemo(() => [center.lat, center.lng] as [number, number], [center.lat, center.lng]);

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/[0.1] ring-1 ring-white/[0.06] ${heightClassName}`}>
      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
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
    </div>
  );
}

