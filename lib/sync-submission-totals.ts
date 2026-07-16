import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { whereAthleteActiveProjects } from "@/lib/ops-project-assignments";

type Db = Prisma.TransactionClient | typeof prisma;

/** Recompute daily submission totals from line items; remove empty submissions. */
export async function recalculateSubmissionTotals(
  submissionIds: Iterable<string>,
  db: Db = prisma
): Promise<void> {
  const ids = Array.from(new Set(submissionIds));
  if (ids.length === 0) return;

  for (const submissionId of ids) {
    const agg = await db.opsSubmissionLineItem.aggregate({
      where: { submissionId },
      _sum: { hoursWorked: true },
      _count: true,
    });
    const totalHours = Number(agg._sum.hoursWorked ?? 0);

    if (agg._count === 0) {
      await db.opsDailySubmission.delete({ where: { id: submissionId } });
      continue;
    }

    await db.opsDailySubmission.update({
      where: { id: submissionId },
      data: { totalHours },
    });
  }
}

/** Delete a project and drop orphaned hours from linked daily logs. */
export async function deleteProjectAndSyncSubmissions(projectId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const project = await tx.opsProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        assignedAthleteId: true,
        athleteAssignments: {
          where: { removedAt: null },
          select: { athleteId: true },
        },
      },
    });
    if (!project) return false;

    const submissionIds = new Set<string>();

    const projectLineItems = await tx.opsSubmissionLineItem.findMany({
      where: { projectId: project.id },
      select: { submissionId: true },
    });
    for (const li of projectLineItems) submissionIds.add(li.submissionId);

    const athleteIds = new Set<string>();
    if (project.assignedAthleteId) athleteIds.add(project.assignedAthleteId);
    for (const row of project.athleteAssignments) athleteIds.add(row.athleteId);

    for (const athleteId of Array.from(athleteIds)) {
      const otherProjects = await tx.opsProject.count({
        where: {
          clientId: project.clientId,
          id: { not: project.id },
          ...whereAthleteActiveProjects(athleteId),
        },
      });

      if (otherProjects === 0) {
        const housekeepingItems = await tx.opsSubmissionLineItem.findMany({
          where: {
            isHousekeeping: true,
            clientId: project.clientId,
            submission: { athleteId },
          },
          select: { id: true, submissionId: true },
        });

        if (housekeepingItems.length > 0) {
          for (const li of housekeepingItems) submissionIds.add(li.submissionId);
          await tx.opsSubmissionLineItem.deleteMany({
            where: { id: { in: housekeepingItems.map((row) => row.id) } },
          });
        }
      }
    }

    await tx.opsProject.delete({ where: { id: projectId } });
    await recalculateSubmissionTotals(submissionIds, tx);
    return true;
  });
}

/** Fix submissions whose stored total no longer matches their line items. */
export async function repairOrphanedSubmissionTotals(): Promise<number> {
  const submissions = await prisma.opsDailySubmission.findMany({
    where: { lineItems: { none: {} } },
    select: { id: true },
  });

  await recalculateSubmissionTotals(submissions.map((row) => row.id));
  return submissions.length;
}
