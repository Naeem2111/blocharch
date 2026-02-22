import path from "path";
import fs from "fs";

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

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadLeads(): LeadsData {
  ensureDataDir();
  if (!fs.existsSync(LEADS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(LEADS_FILE, "utf-8");
    return JSON.parse(raw) as LeadsData;
  } catch {
    return {};
  }
}

function saveLeads(data: LeadsData): void {
  ensureDataDir();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const OLD_TO_NEW_STAGE: Record<string, LeadStage> = {
  new: "cold",
  contacted: "no_reply",
  qualified: "positive_reply",
  won: "positive_reply",
  lost: "negative_reply",
};

export function getLead(practiceUrl: string): LeadRecord | null {
  const leads = loadLeads();
  const r = leads[practiceUrl];
  if (!r) return null;
  const raw = r.stage as string;
  const stage = LEAD_STAGES.includes(raw as LeadStage)
    ? (raw as LeadStage)
    : (OLD_TO_NEW_STAGE[raw] ?? "cold");
  return {
    stage,
    rating: typeof r.rating === "number" ? Math.max(0, Math.min(5, r.rating)) : 0,
    notes: r.notes || undefined,
    lastEmailedAt: r.lastEmailedAt,
  };
}

export function getOrCreateLead(practiceUrl: string): LeadRecord {
  const existing = getLead(practiceUrl);
  if (existing) return existing;
  return { stage: "cold", rating: 0 };
}

export function updateLead(
  practiceUrl: string,
  updates: Partial<Pick<LeadRecord, "stage" | "rating" | "notes" | "lastEmailedAt">>
): LeadRecord {
  const leads = loadLeads();
  const current = getOrCreateLead(practiceUrl);
  const next: LeadRecord = {
    ...current,
    ...updates,
    stage: updates.stage && LEAD_STAGES.includes(updates.stage) ? updates.stage : current.stage,
    rating:
      updates.rating !== undefined
        ? Math.max(0, Math.min(5, Math.round(updates.rating)))
        : current.rating,
  };
  leads[practiceUrl] = next;
  saveLeads(leads);
  return next;
}
