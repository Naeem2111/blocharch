import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { updateLead, getLead, LEAD_STAGES, type LeadStage } from "@/lib/leads";

function resolvePracticeUrl(id: string): string | null {
  const architects = loadArchitects();
  const decoded = decodeURIComponent(id);
  const practice = architects.find((a) => {
    const m = a.url.match(/\/practice\/([^/]+)\/?$/);
    const slug = m ? m[1] : "";
    return a.url === decoded || a.url === id || slug === decoded || slug === id;
  });
  return practice?.url ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: { stage?: LeadStage; rating?: number; notes?: string } = {};

  if (body.stage && LEAD_STAGES.includes(body.stage)) {
    updates.stage = body.stage as LeadStage;
  }
  if (typeof body.rating === "number") {
    updates.rating = body.rating;
  }
  if (typeof body.notes === "string") {
    updates.notes = body.notes;
  }

  const lead = updateLead(url, updates);
  return Response.json(lead);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }
  const lead = getLead(url);
  return Response.json(lead || { stage: "new", rating: 0 });
}
