import { prisma } from "@/lib/prisma";
import {
  applyProjectAthleteAssignments,
  projectTeamForReactivation,
} from "@/lib/ops-project-assignments";
import {
  computeDeadlineBeatMetrics,
  projectCompletionFromLog,
} from "@/lib/project-completion";
import { ensureOpsProjectDueDate } from "@/lib/project-due-sources";
import {
  isActiveProjectStatus,
  syncProjectAfterOpsUpdate,
} from "@/lib/planner-project-sync";

/** Progress when a completed project is moved back to active work. */
export const REACTIVATION_PROGRESS_PERCENT = 85;

type LatestCompletionLog = {
  progressPercent: number;
  submissionDate: Date;
  isBackloggedSession: boolean;
};

async function assignedAthleteIds(projectId: string): Promise<string[]> {
  const [project, rows] = await Promise.all([
    prisma.opsProject.findUnique({
      where: { id: projectId },
      select: { assignedAthleteId: true },
    }),
    prisma.opsProjectAthleteAssignment.findMany({
      where: { projectId, removedAt: null },
      select: { athleteId: true },
    }),
  ]);
  const ids = new Set(rows.map((row) => row.athleteId));
  if (project?.assignedAthleteId) ids.add(project.assignedAthleteId);
  return Array.from(ids);
}

async function latestCompletionLogForProject(
  projectId: string,
  athleteIds?: string[] | null
): Promise<LatestCompletionLog | null> {
  const latest = await prisma.opsSubmissionLineItem.findFirst({
    where: {
      projectId,
      completionPercent: { not: null },
      ...(athleteIds && athleteIds.length > 0
        ? { submission: { athleteId: { in: athleteIds } } }
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

  const latestForAssignee = await latestCompletionLogForProject(
    projectId,
    nextAthleteId ? [nextAthleteId] : null
  );
  const progressPercent = latestForAssignee?.progressPercent ?? 0;

  return {
    currentStatus: "in_progress",
    progressPercent,
    completedAt: null,
    deadlineBeatenDays: null,
    deadlineBeatenMinutes: null,
  };
}

export async function reactivateArchivedOpsProject(projectId: string): Promise<
  | { ok: true }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      assignedAthleteId: true,
      currentStatus: true,
    },
  });
  if (!project) return { ok: false, error: "Project not found", status: 404 };

  const wasCompleted =
    project.currentStatus === "completed" || project.currentStatus === "handed_over";
  if (!wasCompleted) {
    return {
      ok: false,
      error: "Only archived projects can be brought back to active",
      status: 400,
    };
  }

  const team = await projectTeamForReactivation(projectId);
  const latestLine = await prisma.opsSubmissionLineItem.findFirst({
    where: {
      projectId,
      completionPercent: { not: null },
      ...(team.athleteIds.length > 0
        ? { submission: { athleteId: { in: team.athleteIds } } }
        : {}),
    },
    orderBy: [
      { submission: { submissionDate: "desc" } },
      { submission: { updatedAt: "desc" } },
    ],
    select: { id: true },
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (latestLine) {
      await tx.opsSubmissionLineItem.update({
        where: { id: latestLine.id },
        data: { completionPercent: REACTIVATION_PROGRESS_PERCENT },
      });
    }
    return tx.opsProject.update({
      where: { id: projectId },
      data: {
        currentStatus: "in_progress",
        progressPercent: REACTIVATION_PROGRESS_PERCENT,
        completedAt: null,
        deadlineBeatenDays: null,
        deadlineBeatenMinutes: null,
        portalDisplayLocked: false,
      },
      select: {
        assignedAthleteId: true,
        currentStatus: true,
        name: true,
      },
    });
  });

  if (team.athleteIds.length > 0) {
    await applyProjectAthleteAssignments(projectId, team);
  }

  await syncProjectAfterOpsUpdate(
    projectId,
    {
      assignedAthleteId: project.assignedAthleteId,
      currentStatus: project.currentStatus,
      name: project.name,
    },
    {
      assignedAthleteId: team.primaryAthleteId ?? updated.assignedAthleteId,
      currentStatus: updated.currentStatus,
      name: updated.name,
    },
  );

  return { ok: true };
}

/** Recalculate project progress from any assigned athlete's daily log entries. */
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

    const athleteIds = await assignedAthleteIds(projectId);
    const latestLog = await latestCompletionLogForProject(
      projectId,
      athleteIds.length > 0 ? athleteIds : null
    );
    const progressPercent = latestLog?.progressPercent ?? 0;

    const wasCompleted =
      before.currentStatus === "completed" || before.currentStatus === "handed_over";

    if (progressPercent >= 100 && isActiveProjectStatus(before.currentStatus)) {
      // Archives / beat metrics need a due date — carry from pipeline, planner, or outbox if unset.
      const dueDate = await ensureOpsProjectDueDate(projectId);
      const { completedAt, deadlineBeatenDays, deadlineBeatenMinutes } = completionMetrics(
        dueDate,
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
      const dueDate = await ensureOpsProjectDueDate(projectId);
      const { completedAt, deadlineBeatenDays, deadlineBeatenMinutes } = completionMetrics(
        dueDate,
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
