import type { PlannerBoardKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDefaultColumnsOnBoard } from "@/lib/planner-columns-seed";
import { resolveGeneralColumnId } from "@/lib/planner-default-columns";
import { ensureDefaultLabelsOnBoard } from "@/lib/planner-labels-seed";

export const SYSTEM_BOARD_TITLES = {
  blocharch_outbox: "Blocharch Outbox",
  blocharch_inbox: "Blocharch Inbox",
  my_tasks: "My Tasks",
  completed: "Completed",
} as const satisfies Record<Exclude<PlannerBoardKind, "custom" | "project">, string>;

type Tx = Prisma.TransactionClient;

async function createBoardWithColumns(
  tx: Tx,
  data: {
    title: string;
    scope: "personal" | "team";
    kind: PlannerBoardKind;
    ownerId: string;
    athleteId?: string;
    opsProjectId?: string;
    isSystem: boolean;
    color: string;
  }
) {
  const existing = await tx.plannerBoard.findFirst({
    where: {
      kind: data.kind,
      ownerId: data.ownerId,
      athleteId: data.athleteId ?? null,
      opsProjectId: data.opsProjectId ?? null,
    },
  });
  if (existing) return existing;

  const board = await tx.plannerBoard.create({
    data: {
      title: data.title,
      scope: data.scope,
      kind: data.kind,
      color: data.color,
      ownerId: data.ownerId,
      athleteId: data.athleteId,
      opsProjectId: data.opsProjectId,
      isSystem: data.isSystem,
    },
  });

  await createDefaultColumnsOnBoard(board.id, tx);
  await ensureDefaultLabelsOnBoard(board.id, tx);

  return board;
}

/** One admin Blocharch Outbox board (team scope, system). */
export async function ensureAdminOutboxBoard(adminUserId: string) {
  return createBoardWithColumns(prisma, {
    title: SYSTEM_BOARD_TITLES.blocharch_outbox,
    scope: "team",
    kind: "blocharch_outbox",
    ownerId: adminUserId,
    isSystem: true,
    color: "#f59e0b",
  });
}

async function firstColumnId(boardId: string, tx: Tx): Promise<string | null> {
  const cols = await tx.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true },
  });
  return resolveGeneralColumnId(cols);
}

/** Move legacy inbox / misplaced “Blocharch” personal boards onto My Tasks. */
async function consolidateAthleteTasksOntoMyTasks(
  athleteId: string,
  athleteUserId: string,
  myTasksBoardId: string,
  tx: Tx
) {
  const destColumnId = await firstColumnId(myTasksBoardId, tx);
  if (!destColumnId) return;

  const sourceBoards = await tx.plannerBoard.findMany({
    where: {
      athleteId,
      ownerId: athleteUserId,
      OR: [
        { kind: "blocharch_inbox" },
        {
          kind: "custom",
          title: { equals: "Blocharch", mode: "insensitive" },
        },
        {
          kind: "custom",
          title: { equals: "My Tasks", mode: "insensitive" },
        },
      ],
    },
    select: { id: true },
  });

  for (const board of sourceBoards) {
    if (board.id === myTasksBoardId) continue;
    const tasks = await tx.plannerTask.findMany({
      where: { column: { boardId: board.id } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (tasks.length === 0) continue;

    const maxOrder = await tx.plannerTask.aggregate({
      where: { columnId: destColumnId },
      _max: { sortOrder: true },
    });
    let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    for (const task of tasks) {
      await tx.plannerTask.update({
        where: { id: task.id },
        data: { columnId: destColumnId, sortOrder: nextOrder++ },
      });
    }
  }
}

/** Fixed athlete workspace boards: My Tasks + Completed (inbox retired). */
export async function ensureAthleteSystemBoards(
  athleteId: string,
  athleteUserId: string,
  tx: Tx = prisma
) {
  const myTasks = await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.my_tasks,
    scope: "personal",
    kind: "my_tasks",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#6366f1",
  });
  await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.completed,
    scope: "personal",
    kind: "completed",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#22c55e",
  });

  await consolidateAthleteTasksOntoMyTasks(athleteId, athleteUserId, myTasks.id, tx);
}

export async function findAthleteMyTasksBoard(athleteId: string, tx: Tx = prisma) {
  return tx.plannerBoard.findFirst({
    where: { athleteId, kind: "my_tasks" },
    select: { id: true },
  });
}

/** Active project board for an assigned athlete. */
export async function ensureProjectBoard(
  athleteId: string,
  athleteUserId: string,
  projectId: string,
  projectName: string,
  tx: Tx = prisma
) {
  return createBoardWithColumns(tx, {
    title: projectName,
    scope: "personal",
    kind: "project",
    ownerId: athleteUserId,
    athleteId,
    opsProjectId: projectId,
    isSystem: false,
    color: "#a855f7",
  });
}

export function isProtectedSystemBoard(kind: PlannerBoardKind, isSystem: boolean): boolean {
  if (!isSystem) return false;
  return kind !== "custom" && kind !== "project";
}
