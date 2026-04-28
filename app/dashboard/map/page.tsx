import { loadPracticesForMap } from "@/lib/map-practices";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

export default async function MapPage() {
  const { practices, initialGeocodes } = await loadPracticesForMap();

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Map"
        description="Pins use coordinates stored in the database (geocoded once). Clusters keep the view responsive with thousands of practices."
      />
      <MapClient practices={practices} initialGeocodes={initialGeocodes} />
      <p className="mt-4 text-xs text-slate-500">
        Map tiles © OpenStreetMap contributors, © CARTO. Backfill coordinates with{" "}
        <code className="rounded bg-black/30 px-1 font-mono text-[10px] text-brand-300">npm run geocode:architects</code>{" "}
        (respects Nominatim rate limits).
      </p>
    </div>
  );
}
