import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAthleteSystemBoards } from "@/lib/planner-system-boards";

type RestoreMeta = {
  columnId: string;
  boardId: string;
  sortOrder: number;
};

function readRestoreMeta(customFields: unknown): RestoreMeta | null {
  if (!customFields || typeof customFields !== "object") return null;
  const r = (customFields as Record<string, unknown>).completedRestore;
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (typeof o.columnId !== "string" || typeof o.boardId !== "string") return null;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : 0;
  return { columnId: o.columnId, boardId: o.boardId, sortOrder };
}

function mergeCustomFields(
  existing: unknown,
  patch: Record<string, unknown>
): Prisma.InputJsonValue {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

async function getCompletedBoardColumn(athleteId: string, ownerUserId: string) {
  await ensureAthleteSystemBoards(athleteId, ownerUserId);
  const board = await prisma.plannerBoard.findFirst({
    where: { athleteId, kind: "completed" },
    select: { id: true },
  });
  if (!board) return null;
  const col = await prisma.plannerColumn.findFirst({
    where: { boardId: board.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return col ? { boardId: board.id, columnId: col.id } : null;
}

/** Move task to athlete Completed board (or legacy Done column on non-workspace boards). */
export async function setPlannerTaskCompleted(taskId: string, completed: boolean) {
  const task = await prisma.plannerTask.findUnique({
    where: { id: taskId },
    include: {
      column: {
        include: {
          board: {
            select: {
              id: true,
              kind: true,
              athleteId: true,
              ownerId: true,
              columns: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!task) throw new Error("Task not found");

  const board = task.column.board;
  const athleteId = board.athleteId;

  if (!athleteId) {
    return setLegacyDoneColumn(task, board, completed);
  }

  if (completed) {
    if (board.kind === "completed") return { taskId, noop: true };
    const target = await getCompletedBoardColumn(athleteId, board.ownerId);
    if (!target) throw new Error("Completed board not found");

    const restore: RestoreMeta = {
      columnId: task.columnId,
      boardId: board.id,
      sortOrder: task.sortOrder,
    };

    const maxOrder = await prisma.plannerTask.aggregate({
      where: { columnId: target.columnId },
      _max: { sortOrder: true },
    });

    await prisma.plannerTask.update({
      where: { id: taskId },
      data: {
        columnId: target.columnId,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        customFields: mergeCustomFields(task.customFields, { completedRestore: restore }),
      },
    });
    return { taskId, completed: true };
  }

  const restore = readRestoreMeta(task.customFields);
  if (board.kind !== "completed") return { taskId, noop: true };

  if (!restore) {
    const inbox = await prisma.plannerBoard.findFirst({
      where: { athleteId, kind: "blocharch_inbox" },
      include: { columns: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    const fallbackCol = inbox?.columns[0]?.id;
    if (!fallbackCol) throw new Error("Cannot restore task — no prior location");
    await prisma.plannerTask.update({
      where: { id: taskId },
      data: {
        columnId: fallbackCol,
        customFields: mergeCustomFields(task.customFields, { completedRestore: null }),
      },
    });
    return { taskId, completed: false, restored: "inbox" };
  }

  let destColumnId = restore.columnId;
  const colStill = await prisma.plannerColumn.findFirst({
    where: { id: restore.columnId, boardId: restore.boardId },
  });
  if (!colStill) {
    const fallback = await prisma.plannerColumn.findFirst({
      where: { boardId: restore.boardId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!fallback) throw new Error("Original board no longer exists");
    destColumnId = fallback.id;
  }

  const maxOrder = await prisma.plannerTask.aggregate({
    where: { columnId: destColumnId },
    _max: { sortOrder: true },
  });

  await prisma.plannerTask.update({
    where: { id: taskId },
    data: {
      columnId: destColumnId,
      sortOrder: Math.min(restore.sortOrder, (maxOrder._max.sortOrder ?? -1) + 1),
      customFields: mergeCustomFields(task.customFields, { completedRestore: null }),
    },
  });
  return { taskId, completed: false, restored: restore.boardId };
}

async function setLegacyDoneColumn(
  task: { id: string; columnId: string; sortOrder: number },
  board: { id: string; columns: { id: string; title: string }[] },
  completed: boolean
) {
  const doneCol =
    board.columns.find((c) => /^(done|completed)\b/i.test(c.title.trim())) ??
    board.columns[board.columns.length - 1];
  const firstCol = board.columns[0];
  if (!doneCol || !firstCol) throw new Error("Board has no columns");

  await prisma.plannerTask.update({
    where: { id: task.id },
    data: { columnId: completed ? doneCol.id : firstCol.id },
  });
  return { taskId: task.id, completed, legacy: true };
}

/** Card shows checked when sitting on Completed board. */
export function taskShowsAsCompleted(boardKind: string): boolean {
  return boardKind === "completed";
}

/** Athlete workspace boards use Completed-board flow instead of Done column. */
export function usesAthleteCompletedFlow(boardKind: string, athleteId: string | null): boolean {
  return !!athleteId && boardKind !== "completed" && boardKind !== "blocharch_outbox";
}
