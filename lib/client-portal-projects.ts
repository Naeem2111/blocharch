import type { OpsProjectPhase, OpsProjectStatus } from "@prisma/client";

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
