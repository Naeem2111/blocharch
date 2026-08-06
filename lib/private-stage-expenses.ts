import type { PrivateDesignStage } from "@prisma/client";
import { isPrivateDesignStage, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";

export type StageExpenseTotals = Record<PrivateDesignStage, number>;
export type StageExpensePercentMap = Record<PrivateDesignStage, number>;

export function emptyStageExpenseTotals(): StageExpenseTotals {
  return Object.fromEntries(PRIVATE_STAGE_ORDER.map((stage) => [stage, 0])) as StageExpenseTotals;
}

export function sumStageExpenseTotals(totals: StageExpenseTotals): number {
  return PRIVATE_STAGE_ORDER.reduce((sum, stage) => sum + totals[stage], 0);
}

export function expenseTotalsByStage(
  expenses: Array<{ designStage: string | null; amountZar: number }>,
): { totals: StageExpenseTotals; unassignedZar: number } {
  const totals = emptyStageExpenseTotals();
  let unassignedZar = 0;

  for (const expense of expenses) {
    const amount = Number(expense.amountZar) || 0;
    if (expense.designStage && isPrivateDesignStage(expense.designStage)) {
      totals[expense.designStage] += amount;
    } else {
      unassignedZar += amount;
    }
  }

  return { totals, unassignedZar };
}

export function computeCostPercentsFromExpenses(
  totals: StageExpenseTotals,
): StageExpensePercentMap {
  const map = emptyStageExpenseTotals() as StageExpensePercentMap;
  const total = sumStageExpenseTotals(totals);
  if (total <= 0) return map;

  const raw = PRIVATE_STAGE_ORDER.map((stage) => ({
    stage,
    pct: (totals[stage] / total) * 100,
  }));
  const rounded = raw.map((row) => ({ ...row, pct: Math.round(row.pct) }));
  let sum = rounded.reduce((s, row) => s + row.pct, 0);
  let i = 0;
  while (sum !== 100 && total > 0 && i < 100) {
    const idx = i % rounded.length;
    if (totals[rounded[idx].stage] > 0) {
      rounded[idx].pct += sum < 100 ? 1 : -1;
      sum = rounded.reduce((s, row) => s + row.pct, 0);
    }
    i++;
  }

  return Object.fromEntries(rounded.map((row) => [row.stage, row.pct])) as StageExpensePercentMap;
}
