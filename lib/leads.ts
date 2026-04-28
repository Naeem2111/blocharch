import { prisma } from "@/lib/prisma";

/** 6 outreach stages as per n8n workflow (cold → no_reply/positive/negative/etc) */
export const LEAD_STAGES = [
  "cold",
  "no_reply",
  "positive_reply",
  "follow_up_interested",
  "negative_reply",
  "follow_up_not_interested",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export interface LeadRecord {
  stage: LeadStage;
  rating: number; // 1-5
  notes?: string;
  lastEmailedAt?: string; // ISO date
}

export interface LeadsData {
  [practiceUrl: string]: LeadRecord;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

const OLD_TO_NEW_STAGE: Record<string, LeadStage> = {
  new: "cold",
  contacted: "no_reply",
  qualified: "positive_reply",
  won: "positive_reply",
  lost: "negative_reply",
};

export async function loadLeads(): Promise<LeadsData> {
  const rows = await prisma.lead.findMany();
  return Object.fromEntries(
    rows.map((row) => [
      row.architectUrl,
      {
        stage: row.stage,
        rating: clampRating(row.rating),
        notes: row.notes || undefined,
        lastEmailedAt: row.lastEmailedAt?.toISOString(),
      },
    ])
  );
}

export async function getLead(practiceUrl: string): Promise<LeadRecord | null> {
  const r = await prisma.lead.findUnique({
    where: { architectUrl: practiceUrl },
  });
  if (!r) return null;
  const raw = r.stage;
  const stage = LEAD_STAGES.includes(raw as LeadStage)
    ? (raw as LeadStage)
    : (OLD_TO_NEW_STAGE[raw] ?? "cold");
  return {
    stage,
    rating: clampRating(r.rating),
    notes: r.notes || undefined,
    lastEmailedAt: r.lastEmailedAt?.toISOString(),
  };
}

export async function getOrCreateLead(practiceUrl: string): Promise<LeadRecord> {
  const existing = await getLead(practiceUrl);
  if (existing) return existing;
  await prisma.lead.create({
    data: {
      architectUrl: practiceUrl,
      stage: "cold",
      rating: 0,
    },
  });
  return { stage: "cold", rating: 0 };
}

export async function updateLead(
  practiceUrl: string,
  updates: Partial<Pick<LeadRecord, "stage" | "rating" | "notes" | "lastEmailedAt">>
): Promise<LeadRecord> {
  const current = await getOrCreateLead(practiceUrl);
  const next: LeadRecord = {
    ...current,
    ...updates,
    stage: updates.stage && LEAD_STAGES.includes(updates.stage) ? updates.stage : current.stage,
    rating:
      updates.rating !== undefined ? clampRating(updates.rating) : current.rating,
  };
  await prisma.lead.upsert({
    where: { architectUrl: practiceUrl },
    update: {
      stage: next.stage,
      rating: next.rating,
      notes: next.notes,
      lastEmailedAt: next.lastEmailedAt ? new Date(next.lastEmailedAt) : null,
    },
    create: {
      architectUrl: practiceUrl,
      stage: next.stage,
      rating: next.rating,
      notes: next.notes,
      lastEmailedAt: next.lastEmailedAt ? new Date(next.lastEmailedAt) : null,
    },
  });
  return next;
}

/** Append a timestamped line from n8n (or other automation) and set lastEmailedAt. */
export async function appendLeadAutomationNote(
  practiceUrl: string,
  appendNote: string,
  options?: { stage?: LeadStage; lastEmailedAt?: string }
): Promise<LeadRecord> {
  const ts = options?.lastEmailedAt || new Date().toISOString();
  const line = `[${ts}] ${appendNote.trim()}`;
  const current = await getOrCreateLead(practiceUrl);
  const prev = (current.notes || "").trim();
  const notes = prev ? `${prev}\n${line}` : line;
  return await updateLead(practiceUrl, {
    notes,
    lastEmailedAt: ts,
    ...(options?.stage && LEAD_STAGES.includes(options.stage) ? { stage: options.stage } : {}),
  });
}
