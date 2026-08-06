import type { PrivateProjectExpenseKind } from "@prisma/client";

const EXPENSE_KINDS: PrivateProjectExpenseKind[] = ["third_party", "athlete"];

export function parseExpenseKind(value: unknown): PrivateProjectExpenseKind | null {
  const kind = String(value || "third_party").trim() as PrivateProjectExpenseKind;
  return EXPENSE_KINDS.includes(kind) ? kind : null;
}

export function validateExpenseAthleteAssignment(
  kind: PrivateProjectExpenseKind,
  athleteId: string | null | undefined,
): { ok: boolean; error?: string } {
  if (kind === "athlete") {
    if (!athleteId?.trim()) {
      return { ok: false, error: "Select an athlete for athlete payments." };
    }
    return { ok: true };
  }
  if (athleteId) {
    return { ok: false, error: "Athlete can only be set on athlete payments." };
  }
  return { ok: true };
}

export function expenseKindLabel(kind: PrivateProjectExpenseKind): string {
  return kind === "athlete" ? "Athlete payment" : "Third party";
}

/** Change to project costZar when athlete-payment expenses are created or edited. */
export function athleteExpenseCostDelta(
  before: { kind: PrivateProjectExpenseKind; amountZar: number } | null,
  after: { kind: PrivateProjectExpenseKind; amountZar: number } | null,
): number {
  const beforeCost = before?.kind === "athlete" ? before.amountZar : 0;
  const afterCost = after?.kind === "athlete" ? after.amountZar : 0;
  return afterCost - beforeCost;
}
