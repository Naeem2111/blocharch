import { prisma } from "@/lib/prisma";
import { createAthleteNotification } from "@/lib/ops-athlete-notifications";
import { ensureDefaultLabelsOnBoard } from "@/lib/planner-labels-seed";
import { ensureAthleteSystemBoards, findAthleteMyTasksBoard } from "@/lib/planner-system-boards";

type DeliverResult = {
  taskId?: string;
  skipped: boolean;
  reason?: string;
};

/** Copy an assigned planner task onto the athlete's My Tasks board (idempotent). */
export async function deliverAssignedTaskToAthleteInbox(
  sourceTaskId: string
): Promise<DeliverResult> {
  const source = await prisma.plannerTask.findUnique({
    where: { id: sourceTaskId },
    include: {
      labels: { include: { label: { select: { name: true } } } },
      column: {
        include: {
          board: {
            select: { id: true, kind: true, athleteId: true, title: true },
          },
        },
      },
    },
  });

  if (!source?.assigneeId) return { skipped: true, reason: "no_assignee" };

  const athlete = await prisma.opsAthlete.findFirst({
    where: { userId: source.assigneeId, status: "active" },
    select: { id: true, userId: true },
  });
  if (!athlete) return { skipped: true, reason: "not_athlete" };

  const sourceBoard = source.column.board;
  if (sourceBoard.kind === "my_tasks" && sourceBoard.athleteId === athlete.id) {
    return { skipped: true, reason: "already_on_my_tasks" };
  }

  const existing = await prisma.plannerTask.findFirst({
    where: {
      column: { board: { athleteId: athlete.id, kind: "my_tasks" } },
      customFields: {
        path: ["sourceTaskId"],
        equals: sourceTaskId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    return { taskId: existing.id, skipped: true, reason: "already_delivered" };
  }

  await ensureAthleteSystemBoards(athlete.id, athlete.userId);

  const myTasksBoard = await findAthleteMyTasksBoard(athlete.id);
  if (!myTasksBoard) return { skipped: true, reason: "no_my_tasks_board" };

  const backlog = await prisma.plannerColumn.findFirst({
    where: { boardId: myTasksBoard.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!backlog) return { skipped: true, reason: "no_my_tasks_column" };

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: backlog.id },
    _max: { sortOrder: true },
  });

  const task = await prisma.plannerTask.create({
    data: {
      columnId: backlog.id,
      title: source.title,
      summary: source.summary,
      description: source.description,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      assigneeId: source.assigneeId,
      dueAt: source.dueAt,
      customFields: {
        sourceTaskId,
        source: "assignee",
        sourceBoardTitle: sourceBoard.title,
      },
    },
  });

  if (source.labels.length > 0) {
    await ensureDefaultLabelsOnBoard(myTasksBoard.id);
    for (const row of source.labels) {
      const boardLabel = await prisma.plannerLabel.findFirst({
        where: { boardId: myTasksBoard.id, name: row.label.name },
        select: { id: true },
      });
      if (!boardLabel) continue;
      await prisma.plannerTaskLabel
        .create({
          data: { taskId: task.id, labelId: boardLabel.id },
        })
        .catch(() => {});
    }
  }

  await createAthleteNotification({
    athleteId: athlete.id,
    type: "task_assigned",
    title: source.title,
    message: sourceBoard.title ? `From: ${sourceBoard.title}` : "New task on My Tasks",
    linkPath: `/dashboard/planner?area=team&athlete=me&group=blocharch&board=${myTasksBoard.id}&task=${task.id}`,
  }).catch(() => {});

  return { taskId: task.id, skipped: false };
}
