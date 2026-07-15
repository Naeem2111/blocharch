import {
  computeDeadlineBeat,
  completionAtFromSubmissionDate,
} from "@/lib/project-deadline";

/** @deprecated Use computeDeadlineBeat — days only, for legacy callers. */
export function computeDeadlineBeatenDays(
  dueDate: Date,
  completedDate: Date
): number | null {
  const beat = computeDeadlineBeat(dueDate, completedDate);
  if (beat.minutes == null) return null;
  const days = Math.floor(beat.minutes / 1440);
  return days > 0 ? days : null;
}

export function computeDeadlineBeatMetrics(
  dueAt: Date,
  completedAt: Date
): { deadlineBeatenMinutes: number | null; deadlineBeatenDays: number | null } {
  const beat = computeDeadlineBeat(dueAt, completedAt);
  if (beat.minutes == null) {
    return { deadlineBeatenMinutes: null, deadlineBeatenDays: null };
  }
  return {
    deadlineBeatenMinutes: beat.minutes,
    deadlineBeatenDays: beat.days != null && beat.days > 0 ? beat.days : null,
  };
}

export function projectCompletionDate(now = new Date()): Date {
  return now;
}

export function projectCompletionFromLog(
  log: { submissionDate: Date; isBackloggedSession: boolean } | null,
  now = new Date()
): Date {
  if (!log) return now;
  if (log.isBackloggedSession) return completionAtFromSubmissionDate(log.submissionDate);
  return now;
}
