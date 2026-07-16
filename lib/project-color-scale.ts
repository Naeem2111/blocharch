import { dueAtFallbackForDateOnly } from "@/lib/project-deadline";

/** Fixed hex scale for project urgency by days until due (Blocharch palette). */
export function projectDueColor(daysUntilDue: number | null): string {
  if (daysUntilDue == null) return "#64748b";
  if (daysUntilDue < 0) return "#ef4444";
  if (daysUntilDue <= 3) return "#f97316";
  if (daysUntilDue <= 7) return "#eab308";
  if (daysUntilDue <= 14) return "#3b82f6";
  return "#22c55e";
}

/** Contrasting text on solid urgency fills (matches MiniMonthCalendar). */
export function projectDueFillTextColor(bg: string): string {
  const c = bg.toLowerCase();
  if (c === "#eab308") return "#422006";
  if (c === "#64748b") return "#f8fafc";
  return "#ffffff";
}

export function daysUntilDueFromIso(dueDate: string | null): number | null {
  if (!dueDate?.trim()) return null;
  const due = new Date(dueDate.includes("T") ? dueDate : dueAtFallbackForDateOnly(dueDate.trim()));
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}
