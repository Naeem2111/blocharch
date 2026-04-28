import { getBestAddress, loadArchitects } from "@/lib/architects";
import { getOrCreateLead } from "@/lib/leads";
import { PageHeader } from "@/components/PageHeader";
import { MapClient } from "./MapClient";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export default async function MapPage() {
  const architects = await loadArchitects();
  const practices = (
    await Promise.all(
      architects.map(async (a) => ({
      name: a.name,
      address: getBestAddress(a) || "",
      slug: slugFromUrl(a.url),
      stage: (await getOrCreateLead(a.url)).stage,
    }))
    )
  )
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
