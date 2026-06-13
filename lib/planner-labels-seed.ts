import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BOARD_LABELS } from "@/lib/planner-default-labels";

type Tx = Prisma.TransactionClient;

/** Idempotently ensure standard labels exist on a board. */
export async function ensureDefaultLabelsOnBoard(boardId: string, tx: Tx = prisma) {
  const existing = await tx.plannerLabel.findMany({
    where: { boardId },
    select: { name: true },
  });
  const names = new Set(existing.map((l) => l.name.toLowerCase()));
  const missing = DEFAULT_BOARD_LABELS.filter((l) => !names.has(l.name.toLowerCase()));
  for (const l of missing) {
    await tx.plannerLabel.create({
      data: { boardId, name: l.name, color: l.color },
    });
  }
}
