import { prisma } from "@/lib/prisma";
import {
  computeDeadlineBeatMetrics,
  projectCompletionFromLog,
} from "@/lib/project-completion";
import {
  isActiveProjectStatus,
  syncProjectAfterOpsUpdate,
} from "@/lib/planner-project-sync";

/** Progress when a completed project is moved back to active work. */
export const REACTIVATION_PROGRESS_PERCENT = 90;

type LatestCompletionLog = {
  progressPercent: number;
  submissionDate: Date;
  isBackloggedSession: boolean;
};

async function latestCompletionLogForProject(
  projectId: string,
  athleteId?: string | null
): Promise<LatestCompletionLog | null> {
  const latest = await prisma.opsSubmissionLineItem.findFirst({
    where: {
      projectId,
      completionPercent: { not: null },
      ...(athleteId
        ? { submission: { athleteId } }
        : {}),
    },
    orderBy: [{ submission: { submissionDate: "desc" } }, { submission: { updatedAt: "desc" } }],
    select: {
      completionPercent: true,
      submission: {
        select: {
          submissionDate: true,
          isBackloggedSession: true,
        },
      },
    },
  });
  if (!latest || latest.completionPercent == null) return null;
  return {
    progressPercent: Math.max(0, Math.min(100, Math.round(Number(latest.completionPercent)))),
    submissionDate: latest.submission.submissionDate,
    isBackloggedSession: latest.submission.isBackloggedSession,
  };
}

/** When a backlogged log marks 100%, use end of that session date for deadline comparison. */
export function resolveCompletedAtFromLog(log: LatestCompletionLog | null): Date {
  if (!log || log.progressPercent < 100) return projectCompletionFromLog(null);
  return projectCompletionFromLog({
    submissionDate: log.submissionDate,
    isBackloggedSession: log.isBackloggedSession,
  });
}

function completionMetrics(
  dueDate: Date | null,
  log: LatestCompletionLog | null
): {
  completedAt: Date;
  deadlineBeatenDays: number | null;
  deadlineBeatenMinutes: number | null;
} {
  const completedAt = resolveCompletedAtFromLog(log);
  if (!dueDate || !log || log.progressPercent < 100) {
    return { completedAt, deadlineBeatenDays: null, deadlineBeatenMinutes: null };
  }
  const beat = computeDeadlineBeatMetrics(dueDate, completedAt);
  return { completedAt, ...beat };
}

const INACTIVE_PROJECT_STATUSES = new Set(["completed", "handed_over"]);

/** When ops reassigns a finished project, reopen it for the client portal and athlete workspace. */
export async function reactivateProjectOnAthleteReassign(
  projectId: string,
  previousAthleteId: string | null,
  nextAthleteId: string | null,
  currentStatus: string
): Promise<{
  currentStatus: "in_progress";
  progressPercent: number;
  completedAt: null;
  deadlineBeatenDays: null;
  deadlineBeatenMinutes: null;
} | null> {
  if (!nextAthleteId || nextAthleteId === previousAthleteId) return null;
  if (!INACTIVE_PROJECT_STATUSES.has(currentStatus)) return null;

  const latestForAssignee = await latestCompletionLogForProject(projectId, nextAthleteId);
  const progressPercent = latestForAssignee?.progressPercent ?? 0;

  return {
    currentStatus: "in_progress",
    progressPercent,
    completedAt: null,
    deadlineBeatenDays: null,
    deadlineBeatenMinutes: null,
  };
}

/** Recalculate project progress from the primary assignee's daily log entries. */
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
        portalDisplayLocked: true,
      },
    });
    if (!before) continue;
    if (before.portalDisplayLocked) continue;

    const latestLog = await latestCompletionLogForProject(
      projectId,
      before.assignedAthleteId
    );
    const progressPercent = latestLog?.progressPercent ?? 0;

    const wasCompleted =
      before.currentStatus === "completed" || before.currentStatus === "handed_over";

    if (progressPercent >= 100 && isActiveProjectStatus(before.currentStatus) && before.assignedAthleteId) {
      const { completedAt, deadlineBeatenDays, deadlineBeatenMinutes } = completionMetrics(
        before.dueDate,
        latestLog
      );

      const completed = await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent: 100,
          currentStatus: "completed",
          completedAt,
          deadlineBeatenDays,
          deadlineBeatenMinutes,
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

    if (wasCompleted && progressPercent >= 100) {
      const { completedAt, deadlineBeatenDays, deadlineBeatenMinutes } = completionMetrics(
        before.dueDate,
        latestLog
      );
      await prisma.opsProject.update({
        where: { id: projectId },
        data: {
          progressPercent,
          completedAt,
          deadlineBeatenDays,
          deadlineBeatenMinutes,
        },
      });
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
          deadlineBeatenMinutes: null,
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
