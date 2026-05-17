import { loadPracticesForMap } from "@/lib/map-practices";
import { hubUsesIconStudio } from "@/lib/map-hub";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

export default async function MapPage() {
  const { practices, initialGeocodes, hubAnchor } = await loadPracticesForMap();

  const mapBlurb = hubAnchor
    ? hubUsesIconStudio(hubAnchor)
      ? `UK practices — centred on Icon Architects at 5 Plato Place, St Dionis Road, London SW6 4TU. Zoom out for the national pipeline.`
      : `UK practices — framed from ${hubAnchor.name}. Zoom out for the wider pipeline.`
    : "Pins use coordinates stored in the database (geocoded once). Clusters keep the view responsive with thousands of practices.";

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Map" description={mapBlurb} />
      <MapClient practices={practices} initialGeocodes={initialGeocodes} hubAnchor={hubAnchor} />
      <p className="mt-4 text-xs text-slate-500">
        Map tiles © OpenStreetMap contributors, © CARTO. Backfill coordinates with{" "}
        <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-brand-300">npm run geocode:architects</code>{" "}
        (respects Nominatim rate limits).
      </p>
    </div>
  );
}
