import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPROVED_PLANNER_LABELS } from "@/lib/planner-approved-labels";
import {
  DEFAULT_PLANNER_COLUMNS,
  isGeneralColumnTitle,
} from "@/lib/planner-default-columns";

type Tx = Prisma.TransactionClient;

function boardHasLabelLinkedColumns(
  columns: { linkedLabelName: string | null }[]
): boolean {
  return APPROVED_PLANNER_LABELS.some((l) =>
    columns.some((c) => c.linkedLabelName === l.name)
  );
}

/** Create default kanban columns on a new board. */
export async function createDefaultColumnsOnBoard(
  boardId: string,
  tx: Tx = prisma
): Promise<void> {
  await tx.plannerColumn.createMany({
    data: DEFAULT_PLANNER_COLUMNS.map((c) => ({
      boardId,
      title: c.title,
      color: c.color,
      sortOrder: c.sortOrder,
      linkedLabelName: c.linkedLabelName,
    })),
  });
}

/**
 * Backfill label-linked columns on existing boards (idempotent).
 * Renames legacy Backlog → General; adds missing label columns and Done.
 */
export async function ensureDefaultColumnsOnBoard(
  boardId: string,
  tx: Tx = prisma
): Promise<void> {
  const columns = await tx.plannerColumn.findMany({
    where: { boardId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      linkedLabelName: true,
    },
  });

  if (columns.length === 0) {
    await createDefaultColumnsOnBoard(boardId, tx);
    return;
  }

  if (boardHasLabelLinkedColumns(columns)) {
    const doneExists = columns.some((c) => /^(done|completed)\b/i.test(c.title.trim()));
    if (!doneExists) {
      const maxOrder = Math.max(...columns.map((c) => c.sortOrder), -1);
      await tx.plannerColumn.create({
        data: {
          boardId,
          title: "Done",
          color: "#22c55e",
          sortOrder: maxOrder + 1,
          linkedLabelName: null,
        },
      });
    }
    return;
  }

  const backlog = columns.find((c) => /^backlog\b/i.test(c.title.trim()));
  if (backlog) {
    await tx.plannerColumn.update({
      where: { id: backlog.id },
      data: { title: "General", sortOrder: 0, linkedLabelName: null },
    });
  } else if (!columns.some((c) => isGeneralColumnTitle(c.title))) {
    await tx.plannerColumn.updateMany({
      where: { boardId },
      data: { sortOrder: { increment: 1 } },
    });
    await tx.plannerColumn.create({
      data: {
        boardId,
        title: "General",
        color: "#64748b",
        sortOrder: 0,
        linkedLabelName: null,
      },
    });
  }

  const refreshed = await tx.plannerColumn.findMany({
    where: { boardId },
    select: { id: true, title: true, sortOrder: true, linkedLabelName: true },
  });

  const maxSort = Math.max(...refreshed.map((c) => c.sortOrder), 0);
  let nextSort = maxSort + 1;

  for (const def of DEFAULT_PLANNER_COLUMNS) {
    if (def.title === "General") continue;
    if (def.linkedLabelName) {
      const exists = refreshed.some((c) => c.linkedLabelName === def.linkedLabelName);
      if (exists) continue;
      const titleMatch = refreshed.some(
        (c) => c.title.trim().toLowerCase() === def.title.toLowerCase()
      );
      if (titleMatch) {
        const col = refreshed.find(
          (c) => c.title.trim().toLowerCase() === def.title.toLowerCase()
        );
        if (col) {
          await tx.plannerColumn.update({
            where: { id: col.id },
            data: { linkedLabelName: def.linkedLabelName, color: def.color },
          });
        }
        continue;
      }
    } else if (def.title === "Done") {
      const doneExists = refreshed.some((c) => /^(done|completed)\b/i.test(c.title.trim()));
      if (doneExists) continue;
    } else {
      continue;
    }

    await tx.plannerColumn.create({
      data: {
        boardId,
        title: def.title,
        color: def.color,
        sortOrder: def.linkedLabelName ? def.sortOrder : nextSort++,
        linkedLabelName: def.linkedLabelName,
      },
    });
  }
}
