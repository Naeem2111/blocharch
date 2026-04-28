import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { updateLead, getLead, LEAD_STAGES, type LeadStage } from "@/lib/leads";

async function resolvePracticeUrl(id: string): Promise<string | null> {
  const architects = await loadArchitects();
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
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const updates: { stage?: LeadStage; rating?: number; notes?: string; lastEmailedAt?: string } = {};

  if (body.stage && LEAD_STAGES.includes(body.stage)) {
    updates.stage = body.stage as LeadStage;
  }
  if (typeof body.rating === "number") {
    updates.rating = body.rating;
  }
  if (typeof body.notes === "string") {
    updates.notes = body.notes;
  }
  if (typeof body.lastEmailedAt === "string" && body.lastEmailedAt.trim()) {
    updates.lastEmailedAt = body.lastEmailedAt.trim();
  }

  const lead = await updateLead(url, updates);
  return Response.json(lead);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = await resolvePracticeUrl(id);
  if (!url) {
    return Response.json({ error: "Practice not found" }, { status: 404 });
  }
  const lead = await getLead(url);
  return Response.json(lead || { stage: "new", rating: 0 });
}
