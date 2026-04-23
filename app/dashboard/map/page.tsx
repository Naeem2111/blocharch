import { getBestAddress, loadArchitects } from "@/lib/architects";
import { getOrCreateLead } from "@/lib/leads";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export default function MapPage() {
  const architects = loadArchitects();
  const practices = architects
    .map((a) => ({
      name: a.name,
      address: getBestAddress(a) || "",
      slug: slugFromUrl(a.url),
      stage: getOrCreateLead(a.url).stage,
    }))
    .filter((p) => p.address.trim())
    .slice(0, 500);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Map"
        description="Plot practices by address (geocoded via Nominatim and cached locally)."
      />
      <MapClient practices={practices} />
      <p className="mt-4 text-xs text-slate-500">
        Map tiles © OpenStreetMap contributors, © CARTO. Pins load in batches so geocoding stays within hosting limits.
      </p>
    </div>
  );
}
