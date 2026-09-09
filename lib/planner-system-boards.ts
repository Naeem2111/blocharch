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

export const ATHLETE_PERSONAL_BOARD_TITLE = "Personal";

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

async function moveTasksOntoBoard(
  sourceBoardIds: string[],
  destBoardId: string,
  tx: Tx
) {
  const destColumnId = await firstColumnId(destBoardId, tx);
  if (!destColumnId) return;

  for (const boardId of sourceBoardIds) {
    if (boardId === destBoardId) continue;
    const tasks = await tx.plannerTask.findMany({
      where: { column: { boardId } },
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

/** Default Personal board for athlete workspace (custom kind, Personal group). */
export async function ensureAthletePersonalBoard(
  athleteId: string,
  athleteUserId: string,
  tx: Tx = prisma
) {
  const existing = await tx.plannerBoard.findFirst({
    where: {
      athleteId,
      ownerId: athleteUserId,
      kind: "custom",
      title: { equals: ATHLETE_PERSONAL_BOARD_TITLE, mode: "insensitive" },
    },
  });
  if (existing) return existing;

  const anyCustom = await tx.plannerBoard.findFirst({
    where: {
      athleteId,
      ownerId: athleteUserId,
      kind: "custom",
    },
    orderBy: { createdAt: "asc" },
  });
  if (anyCustom) return anyCustom;

  return createBoardWithColumns(tx, {
    title: ATHLETE_PERSONAL_BOARD_TITLE,
    scope: "personal",
    kind: "custom",
    ownerId: athleteUserId,
    athleteId,
    isSystem: false,
    color: "#64748b",
  });
}

/** Move legacy My Tasks / inbox cards onto the athlete Personal board. */
async function consolidateLegacyOntoPersonal(
  athleteId: string,
  athleteUserId: string,
  personalBoardId: string,
  tx: Tx
) {
  const sourceBoards = await tx.plannerBoard.findMany({
    where: {
      athleteId,
      ownerId: athleteUserId,
      OR: [
        { kind: "my_tasks" },
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

  await moveTasksOntoBoard(
    sourceBoards.map((b) => b.id),
    personalBoardId,
    tx
  );
}

/**
 * Athlete workspace boards: Completed (hidden archive) + Personal.
 * My Tasks is retired — existing cards are moved onto Personal.
 */
export async function ensureAthleteSystemBoards(
  athleteId: string,
  athleteUserId: string,
  tx: Tx = prisma
) {
  await createBoardWithColumns(tx, {
    title: SYSTEM_BOARD_TITLES.completed,
    scope: "personal",
    kind: "completed",
    ownerId: athleteUserId,
    athleteId,
    isSystem: true,
    color: "#22c55e",
  });

  const personal = await ensureAthletePersonalBoard(athleteId, athleteUserId, tx);
  const legacy = await tx.plannerBoard.findFirst({
    where: {
      athleteId,
      ownerId: athleteUserId,
      OR: [{ kind: "my_tasks" }, { kind: "blocharch_inbox" }],
    },
    select: { id: true },
  });
  if (legacy) {
    await consolidateLegacyOntoPersonal(athleteId, athleteUserId, personal.id, tx);
  }
  return personal;
}

/** @deprecated My Tasks retired — prefer resolveAthleteDeliveryBoard. */
export async function findAthleteMyTasksBoard(athleteId: string, tx: Tx = prisma) {
  return tx.plannerBoard.findFirst({
    where: { athleteId, kind: "my_tasks" },
    select: { id: true },
  });
}

/**
 * Destination for assigned / outbox work:
 * project board when linked, otherwise athlete Personal board.
 */
export async function resolveAthleteDeliveryBoard(
  athleteId: string,
  athleteUserId: string,
  opsProjectId: string | null | undefined,
  tx: Tx = prisma
): Promise<{ id: string; kind: PlannerBoardKind }> {
  await ensureAthleteSystemBoards(athleteId, athleteUserId, tx);

  if (opsProjectId) {
    const project = await tx.opsProject.findUnique({
      where: { id: opsProjectId },
      select: { id: true, name: true },
    });
    if (project) {
      const board = await ensureProjectBoard(
        athleteId,
        athleteUserId,
        project.id,
        project.name,
        tx
      );
      return { id: board.id, kind: board.kind };
    }
  }

  const personal = await ensureAthletePersonalBoard(athleteId, athleteUserId, tx);
  return { id: personal.id, kind: personal.kind };
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
