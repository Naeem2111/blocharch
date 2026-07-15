import type { OpsProjectPhase, OpsProjectStatus } from "@prisma/client";
import { formatDeadlineBeat, projectBeatDeadline } from "@/lib/project-deadline";
import { dateOnlyUtc } from "@/lib/ops-hours";

/** Internal / housekeeping work — hidden from client portal. */
export function isHousekeepingClientProject(project: {
  name: string;
  currentStage: OpsProjectPhase;
}): boolean {
  if (project.currentStage === "housekeeping_internal") return true;
  return /housekeeping/i.test(project.name);
}

/** Stable lane label (1…N) from project number when no lane field exists. */
export function deriveClientPortalLaneNumber(
  projectNumber: string,
  activeLaneCount: number
): number {
  const lanes = Math.max(1, activeLaneCount);
  const digits = projectNumber.replace(/\D/g, "");
  const n = digits ? parseInt(digits, 10) : 0;
  const seed = Number.isFinite(n) && n > 0 ? n : projectNumber.charCodeAt(0) || 1;
  return (seed % lanes) + 1;
}

/** Client portal "active" — still in delivery (not fully handed over at 100%). */
export function isClientPortalActiveProject(project: {
  currentStatus: OpsProjectStatus;
  progressPercent: number | null;
}): boolean {
  if (project.currentStatus === "handed_over") return false;
  if (project.progressPercent != null && project.progressPercent >= 100) return false;
  return true;
}

export function isClientPortalCompletedProject(project: {
  currentStatus: OpsProjectStatus;
  progressPercent: number | null;
}): boolean {
  return !isClientPortalActiveProject(project);
}

function handoverBeatsDue(
  handoverDate: string,
  dueAt: string | null
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const handover = dateOnlyUtc(new Date(`${handoverDate}T12:00:00`));
  const handoverEnd = new Date(handover.getTime() + 24 * 60 * 60 * 1000 - 1);
  return handoverEnd.getTime() <= due.getTime();
}

/** Delivered on or before the due datetime (early or on time). */
export function clientPortalProjectBeatDeadline(project: {
  deadlineBeatenMinutes?: number | null;
  deadlineBeatenDays: number | null;
  handoverDate: string | null;
  dueDate: string | null;
  dueAt?: string | null;
}): boolean {
  if (projectBeatDeadline(project)) return true;
  if (project.handoverDate && (project.dueAt || project.dueDate)) {
    return handoverBeatsDue(project.handoverDate, project.dueAt ?? `${project.dueDate}T17:00:00`);
  }
  return false;
}

export function clientPortalDeadlineBeatDescription(project: {
  name: string;
  deadlineBeatenMinutes?: number | null;
  deadlineBeatenDays: number | null;
  handoverDate: string | null;
  dueDate: string | null;
  dueAt?: string | null;
}): { title: string; description: string } {
  if (project.deadlineBeatenMinutes != null && project.deadlineBeatenMinutes > 0) {
    const label = formatDeadlineBeat(project.deadlineBeatenMinutes);
    return {
      title: `Deadline beaten — ${project.name}`,
      description: label
        ? `Delivered ${label.replace(" early", "")} ahead of schedule.`
        : "Delivered ahead of schedule.",
    };
  }
  if (project.deadlineBeatenDays != null && project.deadlineBeatenDays > 0) {
    return {
      title: `Deadline beaten — ${project.name}`,
      description: `Delivered ${project.deadlineBeatenDays} day${project.deadlineBeatenDays === 1 ? "" : "s"} ahead of schedule.`,
    };
  }
  return {
    title: `Deadline beaten — ${project.name}`,
    description: "Delivered on or ahead of the deadline.",
  };
}
