import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { syncProjectBoardOnAssign } from "@/lib/planner-project-sync";

export type ProjectAssignmentAthlete = {
  id: string;
  fullName: string;
  athleteCode: string;
};

export type SerializedProjectAssignment = {
  athleteId: string;
  fullName: string;
  athleteCode: string;
  isPrimary: boolean;
  assignedAt: string;
  removedAt: string | null;
};

export const activeAthleteAssignmentsInclude = {
  where: { removedAt: null },
  orderBy: [{ isPrimary: "desc" as const }, { assignedAt: "asc" as const }],
  include: {
    athlete: { select: { id: true, fullName: true, athleteCode: true } },
  },
} satisfies Prisma.OpsProject$athleteAssignmentsArgs;

/** Projects an athlete can work on (active assignment or legacy primary field). */
export function whereAthleteActiveProjects(athleteId: string): Prisma.OpsProjectWhereInput {
  return {
    OR: [
      { assignedAthleteId: athleteId },
      { athleteAssignments: { some: { athleteId, removedAt: null } } },
    ],
  };
}

/** Line items counted toward an athlete's hours on a project. */
export function whereProjectHoursByAthlete(
  athleteId: string,
  projectId: string
): Prisma.OpsSubmissionLineItemWhereInput {
  return {
    projectId,
    submission: { athleteId },
  };
}
/** Whether an athlete may access a specific project. */
export function whereAthleteProjectAccess(
  athleteId: string,
  projectId: string
): Prisma.OpsProjectWhereInput {
  return {
    id: projectId,
    ...whereAthleteActiveProjects(athleteId),
  };
}

export function parseProjectAssignmentInput(body: {
  assignedAthleteId?: unknown;
  assignedAthleteIds?: unknown;
  primaryAthleteId?: unknown;
}):
  | { athleteIds: string[]; primaryAthleteId: string | null }
  | { error: string } {
  const hasMulti =
    body.assignedAthleteIds !== undefined || body.primaryAthleteId !== undefined;

  if (!hasMulti) {
    if (body.assignedAthleteId === undefined) {
      return { error: "No assignment fields provided" };
    }
    const id = body.assignedAthleteId ? String(body.assignedAthleteId).trim() : null;
    return { athleteIds: id ? [id] : [], primaryAthleteId: id };
  }

  const rawIds = Array.isArray(body.assignedAthleteIds) ? body.assignedAthleteIds : [];
  const athleteIds = Array.from(new Set(rawIds.map((id) => String(id).trim()).filter(Boolean)));
  let primaryAthleteId = body.primaryAthleteId
    ? String(body.primaryAthleteId).trim()
    : athleteIds[0] ?? null;

  if (primaryAthleteId && !athleteIds.includes(primaryAthleteId)) {
    return { error: "Primary athlete must be included in assigned athletes" };
  }
  if (athleteIds.length > 0 && !primaryAthleteId) {
    primaryAthleteId = athleteIds[0];
  }

  return { athleteIds, primaryAthleteId };
}

export function serializeProjectAssignments(
  rows: Array<{
    athleteId: string;
    isPrimary: boolean;
    assignedAt: Date;
    removedAt: Date | null;
    athlete: ProjectAssignmentAthlete;
  }>
): SerializedProjectAssignment[] {
  return rows.map((row) => ({
    athleteId: row.athleteId,
    fullName: row.athlete.fullName,
    athleteCode: row.athlete.athleteCode,
    isPrimary: row.isPrimary,
    assignedAt: row.assignedAt.toISOString(),
    removedAt: row.removedAt?.toISOString() ?? null,
  }));
}

/** Backfill join rows from legacy assignedAthleteId when missing. */
export async function ensureProjectAssignmentRows(projectId: string) {
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    select: { assignedAthleteId: true },
  });
  if (!project?.assignedAthleteId) return;

  const existing = await prisma.opsProjectAthleteAssignment.findUnique({
    where: {
      projectId_athleteId: { projectId, athleteId: project.assignedAthleteId },
    },
  });
  if (existing) return;

  await prisma.opsProjectAthleteAssignment.create({
    data: {
      projectId,
      athleteId: project.assignedAthleteId,
      isPrimary: true,
    },
  });
}

/** Sync join table and denormalized primary athlete on OpsProject. */
export async function applyProjectAthleteAssignments(
  projectId: string,
  input: { athleteIds: string[]; primaryAthleteId: string | null }
): Promise<{ primaryAthleteId: string | null }> {
  const { athleteIds, primaryAthleteId } = input;
  const targetIds = new Set(athleteIds);

  if (athleteIds.length > 0) {
    const found = await prisma.opsAthlete.findMany({
      where: { id: { in: athleteIds } },
      select: { id: true },
    });
    if (found.length !== athleteIds.length) {
      throw new Error("Athlete not found");
    }
  }

  const existing = await prisma.opsProjectAthleteAssignment.findMany({
    where: { projectId },
  });

  await prisma.$transaction(async (tx) => {
    for (const row of existing) {
      if (targetIds.has(row.athleteId)) {
        if (row.removedAt) {
          await tx.opsProjectAthleteAssignment.update({
            where: { id: row.id },
            data: { removedAt: null, isPrimary: row.athleteId === primaryAthleteId },
          });
        } else if (row.isPrimary !== (row.athleteId === primaryAthleteId)) {
          await tx.opsProjectAthleteAssignment.update({
            where: { id: row.id },
            data: { isPrimary: row.athleteId === primaryAthleteId },
          });
        }
      } else if (!row.removedAt) {
        await tx.opsProjectAthleteAssignment.update({
          where: { id: row.id },
          data: { removedAt: new Date(), isPrimary: false },
        });
      }
    }

    for (const athleteId of athleteIds) {
      const row = existing.find((r) => r.athleteId === athleteId);
      if (!row) {
        await tx.opsProjectAthleteAssignment.create({
          data: {
            projectId,
            athleteId,
            isPrimary: athleteId === primaryAthleteId,
          },
        });
      }
    }

    await tx.opsProject.update({
      where: { id: projectId },
      data: { assignedAthleteId: primaryAthleteId },
    });
  });

  await syncProjectBoardOnAssign(projectId).catch(() => {});

  return { primaryAthleteId };
}
