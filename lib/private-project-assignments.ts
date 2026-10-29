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

export function parseAthleteTitles(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const titles: Record<string, string> = {};
  for (const [id, title] of Object.entries(value as Record<string, unknown>)) {
    const athleteId = id.trim();
    if (!athleteId) continue;
    titles[athleteId] = String(title ?? "").trim().slice(0, 80);
  }
  return titles;
}

export function parseOptionalPrivateAssignment(body: {
  assignedAthleteId?: unknown;
  assignedAthleteIds?: unknown;
  primaryAthleteId?: unknown;
  athleteTitles?: unknown;
}): { athleteIds: string[]; primaryAthleteId: string | null; athleteTitles: Record<string, string> } | { error: string } {
  const hasFields =
    body.assignedAthleteId !== undefined ||
    body.assignedAthleteIds !== undefined ||
    body.primaryAthleteId !== undefined;
  if (!hasFields) {
    return { athleteIds: [], primaryAthleteId: null, athleteTitles: {} };
  }
  const parsed = parseProjectAssignmentInput(body);
  if ("error" in parsed) return parsed;
  return { ...parsed, athleteTitles: parseAthleteTitles(body.athleteTitles) };
}

function assignmentTitle(titles: Record<string, string>, athleteId: string): string | null {
  const title = titles[athleteId]?.trim() ?? "";
  return title ? title.slice(0, 80) : null;
}

/** Restore the team that was on a private project when it was archived. */
export async function restorePrivateProjectTeam(projectId: string): Promise<void> {
  const [project, rows] = await Promise.all([
    prisma.privateProject.findUnique({
      where: { id: projectId },
      select: { assignedAthleteId: true, completedAt: true },
    }),
    prisma.privateProjectAthleteAssignment.findMany({
      where: { projectId },
      orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
    }),
  ]);

  const completedAt = project?.completedAt?.getTime() ?? null;
  const keep = new Set<string>();
  for (const row of rows) {
    if (!row.removedAt) {
      keep.add(row.athleteId);
      continue;
    }
    if (completedAt != null && row.removedAt.getTime() >= completedAt - 2 * 60 * 1000) {
      keep.add(row.athleteId);
    }
  }
  if (project?.assignedAthleteId) keep.add(project.assignedAthleteId);
  const athleteIds = Array.from(keep);
  if (athleteIds.length === 0) return;

  const primaryFromRows = rows.find((row) => row.isPrimary && keep.has(row.athleteId))?.athleteId ?? null;
  const primaryAthleteId =
    project?.assignedAthleteId && keep.has(project.assignedAthleteId)
      ? project.assignedAthleteId
      : primaryFromRows ?? athleteIds[0] ?? null;
  const athleteTitles: Record<string, string> = {};
  for (const row of rows) {
    if (keep.has(row.athleteId) && row.title) athleteTitles[row.athleteId] = row.title;
  }

  await applyPrivateProjectAthleteAssignments(projectId, {
    athleteIds,
    primaryAthleteId,
    athleteTitles,
  });
}

export async function applyPrivateProjectAthleteAssignments(
  projectId: string,
  input: { athleteIds: string[]; primaryAthleteId: string | null; athleteTitles?: Record<string, string> },
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ primaryAthleteId: string | null }> {
  const { athleteIds, primaryAthleteId, athleteTitles = {} } = input;
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
      await db.privateProjectAthleteAssignment.update({
        where: { id: row.id },
        data: {
          removedAt: null,
          isPrimary: row.athleteId === primaryAthleteId,
          title: assignmentTitle(athleteTitles, row.athleteId),
        },
      });
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
          title: assignmentTitle(athleteTitles, athleteId),
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