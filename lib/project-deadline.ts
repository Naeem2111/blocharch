import { dateOnlyUtc, parseDateOnly } from "@/lib/ops-hours";

/** Blocharch wall-clock timezone for project due times. */
export const PROJECT_DUE_TIMEZONE_OFFSET_HOURS = 2;

export const DEFAULT_PROJECT_DUE_TIME = "5:30";
export const DEFAULT_PROJECT_DUE_AMPM = "PM" as const;

const pad = (n: number) => String(n).padStart(2, "0");

function parseWallClockTime(
  time: string,
  ampm: "AM" | "PM"
): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
  if (ampm === "AM") {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return { hours, minutes };
}

/** Convert calendar date + wall time in GMT+2 to a UTC instant. */
export function projectDueAtFromWallClock(
  date: string,
  time: string,
  ampm: "AM" | "PM"
): Date | null {
  const dateOnly = parseDateOnly(date);
  if (!dateOnly) return null;
  const parsed = parseWallClockTime(time, ampm);
  if (!parsed) return null;
  const wallMs = (parsed.hours * 60 + parsed.minutes) * 60 * 1000;
  const offsetMs = PROJECT_DUE_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(dateOnly.getTime() + wallMs - offsetMs);
}

export function splitProjectDueAtWallClock(iso: string | null | undefined): {
  date: string;
  time: string;
  ampm: "AM" | "PM";
} {
  if (!iso) return { date: "", time: "", ampm: DEFAULT_PROJECT_DUE_AMPM };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "", ampm: DEFAULT_PROJECT_DUE_AMPM };
  const offsetMs = PROJECT_DUE_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  const wall = new Date(d.getTime() + offsetMs);
  const date = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  let h = wall.getUTCHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  const time = `${h}:${pad(wall.getUTCMinutes())}`;
  return { date, time, ampm };
}

/** Fallback ISO when only a YYYY-MM-DD due date is known. */
export function dueAtFallbackForDateOnly(dueDate: string): string {
  const d = projectDueAtFromWallClock(dueDate, DEFAULT_PROJECT_DUE_TIME, DEFAULT_PROJECT_DUE_AMPM);
  return d?.toISOString() ?? `${dueDate}T15:30:00.000Z`;
}

export type DeadlineBeat = {
  minutes: number | null;
  days: number | null;
};

/** Minutes before due datetime (positive = early). */
export function computeDeadlineBeat(dueAt: Date, completedAt: Date): DeadlineBeat {
  const diffMs = dueAt.getTime() - completedAt.getTime();
  if (diffMs <= 0) return { minutes: null, days: null };
  const minutes = Math.floor(diffMs / 60000);
  const days = Math.floor(minutes / 1440);
  return { minutes, days };
}

export function projectBeatDeadline(project: {
  deadlineBeatenMinutes?: number | null;
  deadlineBeatenDays?: number | null;
}): boolean {
  return (project.deadlineBeatenMinutes ?? 0) > 0 || (project.deadlineBeatenDays ?? 0) > 0;
}

export function formatDeadlineBeat(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0 && hours === 0 && mins === 0) {
    return `${days} day${days === 1 ? "" : "s"} early`;
  }
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} ${hours}h early`;
  }
  if (hours > 0 && mins === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"} early`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m early`;
  }
  return `${mins} min${mins === 1 ? "" : "s"} early`;
}

export function formatProjectDueAt(dueAt: Date | string | null | undefined): string | null {
  if (!dueAt) return null;
  const d = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  if (Number.isNaN(d.getTime())) return null;
  const { date, time, ampm } = splitProjectDueAtWallClock(d.toISOString());
  if (!date) return null;
  if (!time) return date;
  return `${date} ${time} ${ampm}`;
}

export function serializeProjectDueAt(dueAt: Date | null): {
  dueDate: string | null;
  dueAt: string | null;
} {
  if (!dueAt) return { dueDate: null, dueAt: null };
  return {
    dueDate: dueAt.toISOString().slice(0, 10),
    dueAt: dueAt.toISOString(),
  };
}

export function parseProjectDueInput(body: {
  dueAt?: unknown;
  dueDate?: unknown;
  dueTime?: unknown;
  dueAmPm?: unknown;
}): Date | null {
  if (body.dueAt === null || body.dueDate === null) return null;

  if (body.dueAt != null && String(body.dueAt).trim()) {
    const d = new Date(String(body.dueAt));
    if (!Number.isNaN(d.getTime())) return d;
  }

  const date = String(body.dueDate ?? "").trim();
  if (!date) return null;

  const timeRaw = body.dueTime != null ? String(body.dueTime).trim() : "";
  const ampmRaw = body.dueAmPm === "AM" ? "AM" : "PM";
  const time = timeRaw || DEFAULT_PROJECT_DUE_TIME;
  const ampm = (timeRaw ? ampmRaw : DEFAULT_PROJECT_DUE_AMPM) as "AM" | "PM";
  const parsed = projectDueAtFromWallClock(date, time, ampm);
  if (parsed) return parsed;

  const fallback = parseDateOnly(date);
  if (!fallback) return null;
  return applyDefaultDueTime(fallback);
}

/** Date-only deadlines → 5:30 PM GMT+2 on that day. */
export function applyDefaultDueTime(date: Date): Date {
  const dateStr = date.toISOString().slice(0, 10);
  return (
    projectDueAtFromWallClock(dateStr, DEFAULT_PROJECT_DUE_TIME, DEFAULT_PROJECT_DUE_AMPM) ??
    new Date(dateOnlyUtc(date).getTime() + (15 * 60 + 30) * 60 * 1000)
  );
}

/** Backlogged completion: end of the logged work day. */
export function completionAtFromSubmissionDate(submissionDate: Date): Date {
  const day = dateOnlyUtc(submissionDate);
  return new Date(day.getTime() + (23 * 60 + 59) * 60 * 1000 + 59 * 1000);
}

export function hoursUntilDueFromIso(dueAt: string | null, now = new Date()): number | null {
  if (!dueAt?.trim()) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  return (due.getTime() - now.getTime()) / 3600000;
}
