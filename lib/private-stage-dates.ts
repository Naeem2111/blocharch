import { parseDateOnly } from "@/lib/ops-hours";

/** Optional from/to (YYYY-MM-DD) per design-stage or custom phase id. */
export type StageDateRange = {
  from: string | null;
  to: string | null;
};

export type StageDateMap = Record<string, StageDateRange>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KEY_RE = /^[a-zA-Z0-9:_-]{1,80}$/;

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = String(value).trim().slice(0, 10);
  if (!DATE_RE.test(date) || !parseDateOnly(date)) return null;
  return date;
}

function parseRange(value: unknown): StageDateRange | null | false {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const from = normalizeDate(value);
    if (!from) return false;
    return { from, to: null };
  }
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  const from = normalizeDate(o.from ?? o.start ?? o.assignedDate ?? null);
  const to = normalizeDate(o.to ?? o.end ?? null);
  // Legacy single-date object accidentally stored as { date: "..." }
  const legacy = !from && !to ? normalizeDate(o.date) : null;
  if (from == null && to == null && legacy == null && (o.from != null || o.to != null || o.date != null)) {
    return false;
  }
  if (!from && !to && !legacy) return null;
  return { from: from ?? legacy, to };
}

export function emptyStageDateRange(): StageDateRange {
  return { from: null, to: null };
}

export function parseStageDateMap(raw: unknown): StageDateMap | null {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: StageDateMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEY_RE.test(key)) return null;
    const range = parseRange(value);
    if (range === false) return null;
    if (range) out[key] = range;
  }
  return out;
}

/** Serialize for Prisma JSON — omit empty ranges; only store set fields. */
export function serializeStageDateMap(map: StageDateMap): Record<string, { from?: string; to?: string }> {
  const out: Record<string, { from?: string; to?: string }> = {};
  for (const [key, range] of Object.entries(map)) {
    if (!range.from && !range.to) continue;
    out[key] = {
      ...(range.from ? { from: range.from } : {}),
      ...(range.to ? { to: range.to } : {}),
    };
  }
  return out;
}

export function stageDateRangeFor(
  map: StageDateMap | null | undefined,
  ...keys: Array<string | null | undefined>
): StageDateRange | null {
  if (!map) return null;
  for (const key of keys) {
    if (key && map[key] && (map[key].from || map[key].to)) return map[key];
  }
  return null;
}

/** @deprecated Prefer stageDateRangeFor — returns the from date only. */
export function stageDateFor(
  map: StageDateMap | null | undefined,
  ...keys: Array<string | null | undefined>
): string | null {
  return stageDateRangeFor(map, ...keys)?.from ?? null;
}

export function stageDateStorageKey(phase: { id: string; builtInKey?: string | null }): string {
  return phase.builtInKey || phase.id;
}

export function setStageDateRange(
  map: StageDateMap,
  key: string,
  patch: { from?: string | null; to?: string | null },
): StageDateMap {
  const current = map[key] ?? emptyStageDateRange();
  const nextRange: StageDateRange = {
    from: patch.from !== undefined ? normalizeDate(patch.from) : current.from,
    to: patch.to !== undefined ? normalizeDate(patch.to) : current.to,
  };
  const next = { ...map };
  if (!nextRange.from && !nextRange.to) delete next[key];
  else next[key] = nextRange;
  return next;
}

/** Set or clear the from date (keeps to). */
export function setStageDate(
  map: StageDateMap,
  key: string,
  date: string | null,
): StageDateMap {
  return setStageDateRange(map, key, { from: date });
}

export function resolveStageDates(
  map: StageDateMap,
  legacy: { briefReceivedAt?: string | null; councilSubmittedAt?: string | null },
): StageDateMap {
  const next = { ...map };
  if (!next.site_measure_up?.from && legacy.briefReceivedAt) {
    next.site_measure_up = {
      from: legacy.briefReceivedAt,
      to: next.site_measure_up?.to ?? null,
    };
  }
  if (!next.council_review?.from && legacy.councilSubmittedAt) {
    next.council_review = {
      from: legacy.councilSubmittedAt,
      to: next.council_review?.to ?? null,
    };
  }
  return next;
}

export function isoDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Human label for an optional from–to range. Empty if neither is set. */
export function formatStageDateRange(range: StageDateRange | null | undefined): string {
  if (!range?.from && !range?.to) return "";
  const from = range.from ? formatIsoDate(range.from) : null;
  const to = range.to ? formatIsoDate(range.to) : null;
  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  return `To ${to}`;
}
