import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { getOrCreateLead, LEAD_STAGES } from "@/lib/leads";

function slugFromUrl(url: string): string {
  const m = url.match(/\/practice\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stage = searchParams.get("stage") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const perPage = Math.min(50, Math.max(10, parseInt(searchParams.get("perPage") || "25", 10)));
  const withEmailOnly = searchParams.get("withEmail") === "true";

  const architects = await loadArchitects();
  let items = await Promise.all(architects.map(async (a) => {
    const lead = await getOrCreateLead(a.url);
    return {
      ...a,
      slug: slugFromUrl(a.url),
      lead: { stage: lead.stage, rating: lead.rating, notes: lead.notes, lastEmailedAt: lead.lastEmailedAt },
    };
  }));

  if (stage && LEAD_STAGES.includes(stage as any)) {
    items = items.filter((x) => x.lead.stage === stage);
  }
  if (withEmailOnly) {
    items = items.filter((a) => a.email?.trim());
  }

  const total = items.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paginated = items.slice(start, start + perPage);

  return Response.json({
    items: paginated,
    total,
    page,
    totalPages,
  });
}
