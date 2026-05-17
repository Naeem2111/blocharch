import { loadPracticesForMap } from "@/lib/map-practices";
import { hubUsesIconStudio } from "@/lib/map-hub";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

export default async function MapPage() {
  const { practices, initialGeocodes, focalAnchor } = await loadPracticesForMap();

  const mapBlurb = hubUsesIconStudio(focalAnchor)
    ? `Nearest practices to Icon Architects (5 Plato Place, St Dionis Road, London SW6 4TU) — up to ${practices.length} on the map, prioritised by proximity. Zoom out for broader geography.`
    : `Practices nearest to ${focalAnchor.name} — up to ${practices.length} on the map. Zoom out for broader geography.`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Map" description={mapBlurb} />
      <MapClient practices={practices} initialGeocodes={initialGeocodes} focalAnchor={focalAnchor} />
      <p className="mt-4 text-xs text-slate-500">
        Map tiles © OpenStreetMap contributors, © CARTO. Backfill coordinates with{" "}
        <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-brand-300">npm run geocode:architects</code>{" "}
        (respects Nominatim rate limits).
      </p>
    </div>
  );
}
