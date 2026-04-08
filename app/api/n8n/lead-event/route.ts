import { NextRequest } from "next/server";
import { loadArchitects } from "@/lib/architects";
import { appendLeadAutomationNote, LEAD_STAGES, type LeadStage } from "@/lib/leads";

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function firstEmailFromToField(to: unknown): string {
  if (typeof to !== "string" || !to.trim()) return "";
  const m = to.match(/<([^>]+)>/);
  const raw = (m ? m[1] : to).trim();
  return normEmail(raw);
}

function resolvePracticeUrl(body: {
  lead_id?: string;
  email?: string;
  to?: string;
}): { url: string } | { error: string; status: number } {
  const architects = loadArchitects();

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  if (leadId) {
    const hit = architects.find((a) => a.url === leadId);
    if (hit) return { url: hit.url };
    return { error: "Practice not found for lead_id", status: 404 };
  }

  const fromTo = firstEmailFromToField(body.to);
  const email =
    (typeof body.email === "string" ? normEmail(body.email) : "") || fromTo;
  if (email) {
    const hit = architects.find((a) => normEmail(a.email || "") === email);
    if (hit) return { url: hit.url };
    return { error: "Practice not found for email", status: 404 };
  }

  return { error: "Provide lead_id (practice URL), email, or Gmail-style to", status: 400 };
}

/**
 * n8n callback after sending an email. Updates notes (timestamped), lastEmailedAt, optional stage.
 * POST /api/n8n/lead-event
 * Header: X-Api-Key: N8N_API_KEY (or ?apiKey=)
 *
 * Body JSON:
 * - lead_id?: full architectdirectory practice URL
 * - email?: practice email (fallback if Gmail dropped lead_id)
 * - to?: Gmail-style recipient string (parsed for email if lead_id/email missing)
 * - appendNote: string (required) e.g. "Cold email sent"
 * - stage?: optional pipeline stage (e.g. no_reply after cold send)
 * - lastEmailedAt?: optional ISO string (defaults to now)
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  const appendNote = typeof body.appendNote === "string" ? body.appendNote.trim() : "";
  if (!appendNote) {
    return Response.json({ error: "appendNote is required" }, { status: 400 });
  }

  let stage: LeadStage | undefined;
  if (body.stage && LEAD_STAGES.includes(body.stage)) {
    stage = body.stage as LeadStage;
  }

  const lastEmailedAt =
    typeof body.lastEmailedAt === "string" && body.lastEmailedAt.trim()
      ? body.lastEmailedAt.trim()
      : undefined;

  const resolved = resolvePracticeUrl(body);
  if ("error" in resolved) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }

  const lead = appendLeadAutomationNote(resolved.url, appendNote, { stage, lastEmailedAt });
  return Response.json({ ok: true, lead });
}
