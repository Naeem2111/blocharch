import { prisma } from "@/lib/prisma";

/**
 * When OpsProject.dueDate was never set, recover it from the same work’s other
 * surfaces so archives / deadline-beat still have a due to compare against.
 *
 * Priority:
 * 1. Existing project dueDate
 * 2. Pipeline target due (pre-conversion)
 * 3. Latest planner task due on a board linked to this project
 * 4. Latest outbox assignment due for this project
 */
export async function resolveOpsProjectDueDate(
  projectId: string,
  existingDue: Date | null | undefined
): Promise<Date | null> {
  if (existingDue) return existingDue;

  const pipeline = await prisma.opsPipelineProject.findFirst({
    where: { convertedProjectId: projectId },
    select: { targetDueDate: true },
  });
  if (pipeline?.targetDueDate) return pipeline.targetDueDate;

  const plannerTask = await prisma.plannerTask.findFirst({
    where: {
      column: { board: { opsProjectId: projectId } },
      dueAt: { not: null },
    },
    orderBy: { dueAt: "desc" },
    select: { dueAt: true },
  });
  if (plannerTask?.dueAt) return plannerTask.dueAt;

  const outbox = await prisma.opsOutboxTask.findFirst({
    where: { projectId, dueAt: { not: null } },
    orderBy: { dueAt: "desc" },
    select: { dueAt: true },
  });
  return outbox?.dueAt ?? null;
}

/** Persist a resolved due date when the project row is still empty. */
export async function ensureOpsProjectDueDate(projectId: string): Promise<Date | null> {
  const project = await prisma.opsProject.findUnique({
    where: { id: projectId },
    select: { dueDate: true },
  });
  if (!project) return null;
  if (project.dueDate) return project.dueDate;

  const resolved = await resolveOpsProjectDueDate(projectId, null);
  if (!resolved) return null;

  await prisma.opsProject.update({
    where: { id: projectId },
    data: { dueDate: resolved },
  });
  return resolved;
}

/**
 * Batch-resolve missing dues for archive/list views.
 * Returns a map of projectId → due Date (existing or carried).
 * Persists carries so later views and beat metrics stay consistent.
 */
export async function ensureOpsProjectDueDates(
  projects: Array<{ id: string; dueDate: Date | null }>
): Promise<Map<string, Date | null>> {
  const result = new Map<string, Date | null>();
  const missingIds = projects.filter((p) => !p.dueDate).map((p) => p.id);

  for (const p of projects) {
    result.set(p.id, p.dueDate);
  }
  if (missingIds.length === 0) return result;

  const [pipelines, plannerTasks, outboxTasks] = await Promise.all([
    prisma.opsPipelineProject.findMany({
      where: {
        convertedProjectId: { in: missingIds },
        targetDueDate: { not: null },
      },
      select: { convertedProjectId: true, targetDueDate: true },
    }),
    prisma.plannerTask.findMany({
      where: {
        column: { board: { opsProjectId: { in: missingIds } } },
        dueAt: { not: null },
      },
      select: {
        dueAt: true,
        column: { select: { board: { select: { opsProjectId: true } } } },
      },
      orderBy: { dueAt: "desc" },
    }),
    prisma.opsOutboxTask.findMany({
      where: {
        projectId: { in: missingIds },
        dueAt: { not: null },
      },
      select: { projectId: true, dueAt: true },
      orderBy: { dueAt: "desc" },
    }),
  ]);

  const fromPipeline = new Map<string, Date>();
  for (const row of pipelines) {
    if (row.convertedProjectId && row.targetDueDate) {
      fromPipeline.set(row.convertedProjectId, row.targetDueDate);
    }
  }

  const fromPlanner = new Map<string, Date>();
  for (const row of plannerTasks) {
    const projectId = row.column.board.opsProjectId;
    if (!projectId || !row.dueAt || fromPlanner.has(projectId)) continue;
    fromPlanner.set(projectId, row.dueAt);
  }

  const fromOutbox = new Map<string, Date>();
  for (const row of outboxTasks) {
    if (!row.projectId || !row.dueAt || fromOutbox.has(row.projectId)) continue;
    fromOutbox.set(row.projectId, row.dueAt);
  }

  const toPersist: Array<{ id: string; dueDate: Date }> = [];
  for (const id of missingIds) {
    const due =
      fromPipeline.get(id) ?? fromPlanner.get(id) ?? fromOutbox.get(id) ?? null;
    result.set(id, due);
    if (due) toPersist.push({ id, dueDate: due });
  }

  await Promise.all(
    toPersist.map((row) =>
      prisma.opsProject.update({
        where: { id: row.id },
        data: { dueDate: row.dueDate },
      })
    )
  );

  return result;
}
