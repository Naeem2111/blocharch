import { composeDueAtIso, splitDueAtIso } from "@/lib/planner-due-datetime";
import { dateOnlyUtc, parseDateOnly } from "@/lib/ops-hours";

export const DEFAULT_PROJECT_DUE_TIME = "5:00";
export const DEFAULT_PROJECT_DUE_AMPM = "PM" as const;

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
  const { date, time, ampm } = splitDueAtIso(d.toISOString());
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
  const iso = composeDueAtIso(date, time, ampmRaw);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const fallback = parseDateOnly(date);
  if (!fallback) return null;
  return applyDefaultDueTime(fallback);
}

/** Existing date-only deadlines → 5:00 PM on that day. */
export function applyDefaultDueTime(date: Date): Date {
  const base = dateOnlyUtc(date);
  return new Date(base.getTime() + 17 * 60 * 60 * 1000);
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
