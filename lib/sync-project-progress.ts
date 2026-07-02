import { prisma } from "@/lib/prisma";
import {
  computeDeadlineBeatenDays,
  projectCompletionDate,
} from "@/lib/project-completion";
import {
  isActiveProjectStatus,
  syncProjectAfterOpsUpdate,
} from "@/lib/planner-project-sync";

/** Progress when a completed project is moved back to active work. */
export const REACTIVATION_PROGRESS_PERCENT = 90;

async function latestCompletionPercentForProject(projectId: string): Promise<number | null> {
  const latest = await prisma.opsSubmissionLineItem.findFirst({
    where: { projectId, completionPercent: { not: null } },
    orderBy: [{ submission: { submissionDate: "desc" } }, { submission: { updatedAt: "desc" } }],
    select: { completionPercent: true },
  });
  if (!latest || latest.completionPercent == null) return null;
  return Math.max(0, Math.min(100, Math.round(Number(latest.completionPercent))));
}

/** Recalculate project progress from all daily log line items and sync completion state. */
export async function syncProjectProgressForProjects(projectIds: string[]) {
  const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)));
  for (const projectId of uniqueIds) {
    const before = await prisma.opsProject.findUnique({
      where: { id: projectId },
      select: {
        assignedAthleteId: true,
        currentStatus: true,
        name: true,
        progressPercent: true,
        dueDate: true,
      },
    });
    if (!before) continue;

    const maxFromLogs = await latestCompletionPercentForProject(projectId);
    const progressPercent =
      maxFromLogs ?? before.progressPercent ?? 0;

    const wasCompleted =
      before.currentStatus === "completed" || before.currentStatus === "handed_over";

    if (progressPercent >= 100 && isActiveProjectStatus(before.currentStatus) && before.assignedAthleteId) {
      const completedAt = projectCompletionDate();
      const deadlineBeatenDays = before.dueDate
        ? computeDeadlineBeatenDays(before.dueDate, completedAt)
        : null;

      const completed = await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent: 100,
          currentStatus: "completed",
          completedAt,
          deadlineBeatenDays,
        },
        select: {
          assignedAthleteId: true,
          currentStatus: true,
          name: true,
        },
      });

      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: before.assignedAthleteId,
          currentStatus: before.currentStatus,
          name: before.name,
        },
        {
          assignedAthleteId: completed.assignedAthleteId,
          currentStatus: completed.currentStatus,
          name: completed.name,
        }
      );
      continue;
    }

    if (wasCompleted && progressPercent < 100) {
      const reactivated = await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent,
          currentStatus: "in_progress",
          completedAt: null,
          deadlineBeatenDays: null,
        },
        select: {
          assignedAthleteId: true,
          currentStatus: true,
          name: true,
        },
      });

      await syncProjectAfterOpsUpdate(
        projectId,
        {
          assignedAthleteId: before.assignedAthleteId,
          currentStatus: before.currentStatus,
          name: before.name,
        },
        {
          assignedAthleteId: reactivated.assignedAthleteId,
          currentStatus: reactivated.currentStatus,
          name: reactivated.name,
        }
      );
      continue;
    }

    await prisma.opsProject.update({
      where: { id: projectId },
      data: { progressPercent },
    });
  }
}

/** @deprecated Prefer syncProjectProgressForProjects after persisting line items. */
export async function syncProjectProgressFromLineItems(
  lineItems: Array<{ projectId: string; completionPercent?: number | null }>
) {
  await syncProjectProgressForProjects(lineItems.map((li) => li.projectId));
}
