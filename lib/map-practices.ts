import { getBestAddressFromFields } from "@/lib/address-display";
import { prisma } from "@/lib/prisma";
import { resolveMapHub, type MapHubAnchor } from "@/lib/map-hub";

export type MapPracticeStage =
  | "cold"
  | "no_reply"
  | "positive_reply"
  | "follow_up_interested"
  | "negative_reply"
  | "follow_up_not_interested";

export type MapPractice = {
  name: string;
  address: string;
  slug: string;
  stage: MapPracticeStage;
};

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

/** Single query: practices with optional lead stage and DB-backed map coordinates (no lead auto-create). */
export async function loadPracticesForMap(): Promise<{
  practices: MapPractice[];
  initialGeocodes: Record<string, { lat: number; lng: number; displayName?: string }>;
  /** Blocharch hub practice (Icon Architects, London) — map centers here and expands outward. */
  hubAnchor: MapHubAnchor | null;
}> {
  const rows = await prisma.architect.findMany({
    select: {
      url: true,
      name: true,
      address: true,
      description: true,
      latitude: true,
      longitude: true,
      lead: { select: { stage: true } },
    },
    orderBy: { name: "asc" },
  });

  const practices: MapPractice[] = [];
  const initialGeocodes: Record<string, { lat: number; lng: number; displayName?: string }> = {};

  for (const r of rows) {
    const addr =
      getBestAddressFromFields(r.address ?? "", r.description ?? "")?.trim() || "";
    if (!addr) continue;

    const stage = (r.lead?.stage ?? "cold") as MapPracticeStage;
    practices.push({
      name: r.name,
      address: addr,
      slug: slugFromUrl(r.url),
      stage,
    });

    if (r.latitude != null && r.longitude != null) {
      initialGeocodes[addr] = { lat: r.latitude, lng: r.longitude };
    }
  }

  const hubAnchor = resolveMapHub(rows);

  return { practices, initialGeocodes, hubAnchor };
}
