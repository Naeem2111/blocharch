import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseProjectAssignmentInput } from "@/lib/ops-project-assignments";

export const privateAssignedAthleteSelect = {
  id: true,
  fullName: true,
  athleteCode: true,
  privateWeeklyCapHours: true,
} as const;

export const activePrivateAthleteAssignmentsInclude = {
  where: { removedAt: null },
  orderBy: [{ isPrimary: "desc" as const }, { assignedAt: "asc" as const }],
  include: {
    athlete: { select: privateAssignedAthleteSelect },
  },
} satisfies Prisma.PrivateProject$athleteAssignmentsArgs;

export function whereAthletePrivateProjects(athleteId: string): Prisma.PrivateProjectWhereInput {
  return {
    OR: [
      { assignedAthleteId: athleteId },
      { athleteAssignments: { some: { athleteId, removedAt: null } } },
    ],
  };
}

export function parseOptionalPrivateAssignment(body: {
  assignedAthleteId?: unknown;
  assignedAthleteIds?: unknown;
  primaryAthleteId?: unknown;
}): { athleteIds: string[]; primaryAthleteId: string | null } | { error: string } {
  const hasFields =
    body.assignedAthleteId !== undefined ||
    body.assignedAthleteIds !== undefined ||
    body.primaryAthleteId !== undefined;
  if (!hasFields) {
    return { athleteIds: [], primaryAthleteId: null };
  }
  return parseProjectAssignmentInput(body);
}

export async function applyPrivateProjectAthleteAssignments(
  projectId: string,
  input: { athleteIds: string[]; primaryAthleteId: string | null },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ primaryAthleteId: string | null }> {
  const { athleteIds, primaryAthleteId } = input;
  const targetIds = new Set(athleteIds);

  if (athleteIds.length > 0) {
    const found = await db.opsAthlete.findMany({
      where: { id: { in: athleteIds } },
      select: { id: true },
    });
    if (found.length !== athleteIds.length) {
      throw new Error("Athlete not found");
    }
  }

  const existing = await db.privateProjectAthleteAssignment.findMany({
    where: { projectId },
  });

  for (const row of existing) {
    if (targetIds.has(row.athleteId)) {
      if (row.removedAt) {
        await db.privateProjectAthleteAssignment.update({
          where: { id: row.id },
          data: { removedAt: null, isPrimary: row.athleteId === primaryAthleteId },
        });
      } else if (row.isPrimary !== (row.athleteId === primaryAthleteId)) {
        await db.privateProjectAthleteAssignment.update({
          where: { id: row.id },
          data: { isPrimary: row.athleteId === primaryAthleteId },
        });
      }
    } else if (!row.removedAt) {
      await db.privateProjectAthleteAssignment.update({
        where: { id: row.id },
        data: { removedAt: new Date(), isPrimary: false },
      });
    }
  }

  for (const athleteId of athleteIds) {
    const row = existing.find((r) => r.athleteId === athleteId);
    if (!row) {
      await db.privateProjectAthleteAssignment.create({
        data: {
          projectId,
          athleteId,
          isPrimary: athleteId === primaryAthleteId,
        },
      });
    }
  }

  await db.privateProject.update({
    where: { id: projectId },
    data: { assignedAthleteId: primaryAthleteId },
  });

  return { primaryAthleteId };
}