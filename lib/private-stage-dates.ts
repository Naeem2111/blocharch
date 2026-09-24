import { parseDateOnly } from "@/lib/ops-hours";

/** YYYY-MM-DD per design-stage or custom phase id. Omit a key when that stage has no date yet. */
export type StageDateMap = Record<string, string>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[a-zA-Z0-9:_-]{1,80}$/;

export function parseStageDateMap(raw: unknown): StageDateMap | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: StageDateMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY_RE.test(key)) return null;
    if (value == null || value === "") continue;
    const date = String(value).trim().slice(0, 10);
    if (!DATE_RE.test(date) || !parseDateOnly(date)) return null;
    out[key] = date;
  }
  return out;
}

export function stageDateFor(
  map: StageDateMap | null | undefined,
  ...keys: Array<string | null | undefined>
): string | null {
  if (!map) return null;
  for (const key of keys) {
    if (key && map[key]) return map[key];
  }
  return null;
}

export function stageDateStorageKey(phase: { id: string; builtInKey?: string | null }): string {
  return phase.builtInKey || phase.id;
}

export function setStageDate(
  map: StageDateMap,
  key: string,
  date: string | null,
): StageDateMap {
  const next = { ...map };
  const trimmed = date?.trim().slice(0, 10) ?? "";
  if (trimmed && DATE_RE.test(trimmed)) next[key] = trimmed;
  else delete next[key];
  return next;
}

export function resolveStageDates(
  map: StageDateMap,
  legacy: { briefReceivedAt?: string | null; councilSubmittedAt?: string | null },
): StageDateMap {
  const next = { ...map };
  if (!next.site_measure_up && legacy.briefReceivedAt) {
    next.site_measure_up = legacy.briefReceivedAt;
  }
  if (!next.council_review && legacy.councilSubmittedAt) {
    next.council_review = legacy.councilSubmittedAt;
  }
  return next;
}

export function isoDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}
