import type { PrivateDesignStage } from "@prisma/client";
import {
  PRIVATE_STAGE_DURATIONS,
  PRIVATE_STAGE_LABELS,
  PRIVATE_STAGE_ORDER,
  stageIndex,
} from "@/lib/private-constants";
import {
  defaultPhaseStructure,
  resolvePhaseStructure,
  type PhaseStructure,
  type ProjectPhaseGroup,
} from "@/lib/private-phase-structure";
import {
  computeCostPercentsFromExpenses,
  emptyStageExpenseTotals,
  expenseTotalsByStage,
  type StageExpenseTotals,
} from "@/lib/private-stage-expenses";

export type PhaseSplitMap = Record<PrivateDesignStage, number>;

export type StageBillingRow = {
  stage: PrivateDesignStage;
  label: string;
  status: "completed" | "current" | "upcoming";
  feePercent: number;
  costPercent: number;
  feeZar: number;
  /** Actual third-party expenses attributed to this stage. */
  expenseZar: number;
  /** @deprecated Use expenseZar — kept for API compatibility. */
  costZar: number;
};

export type PhaseGroupBreakdown = {
  id: string;
  name: string;
  stages: StageBillingRow[];
  feeZar: number;
  costZar: number;
};

const EMPTY_SPLITS = Object.fromEntries(
  PRIVATE_STAGE_ORDER.map((stage) => [stage, 0]),
) as PhaseSplitMap;

export function defaultPhaseSplits(): PhaseSplitMap {
  const totalDays = PRIVATE_STAGE_ORDER.reduce(
    (sum, stage) => sum + PRIVATE_STAGE_DURATIONS[stage],
    0,
  );
  const raw = PRIVATE_STAGE_ORDER.map((stage) => ({
    stage,
    pct: (PRIVATE_STAGE_DURATIONS[stage] / totalDays) * 100,
  }));
  const rounded = raw.map((row) => ({ ...row, pct: Math.round(row.pct) }));
  let sum = rounded.reduce((s, row) => s + row.pct, 0);
  let i = 0;
  while (sum !== 100 && i < 100) {
    const idx = i % rounded.length;
    rounded[idx].pct += sum < 100 ? 1 : -1;
    sum = rounded.reduce((s, row) => s + row.pct, 0);
    i++;
  }
  return Object.fromEntries(rounded.map((row) => [row.stage, row.pct])) as PhaseSplitMap;
}

export function parsePhaseSplitMap(json: unknown): PhaseSplitMap | null {
  if (!json || typeof json !== "object") return null;
  const map = { ...EMPTY_SPLITS };
  for (const stage of PRIVATE_STAGE_ORDER) {
    const value = (json as Record<string, unknown>)[stage];
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    map[stage] = Math.round(n);
  }
  return map;
}

export function resolvePhaseSplits(
  feeJson: unknown,
  costJson: unknown,
): { feePercents: PhaseSplitMap; costPercents: PhaseSplitMap } {
  const defaults = defaultPhaseSplits();
  return {
    feePercents: parsePhaseSplitMap(feeJson) ?? defaults,
    costPercents: parsePhaseSplitMap(costJson) ?? defaults,
  };
}

export function phaseSplitSum(map: PhaseSplitMap): number {
  return PRIVATE_STAGE_ORDER.reduce((sum, stage) => sum + map[stage], 0);
}

export function validatePhaseSplitMap(map: PhaseSplitMap): { ok: boolean; sum: number } {
  const sum = phaseSplitSum(map);
  return { ok: sum === 100, sum };
}

export function phaseStatus(
  stage: PrivateDesignStage,
  currentStage: PrivateDesignStage,
): "completed" | "current" | "upcoming" {
  const stageIdx = stageIndex(stage);
  const currentIdx = stageIndex(currentStage);
  if (stageIdx < currentIdx) return "completed";
  if (stageIdx === currentIdx) return "current";
  return "upcoming";
}

function buildStageRow(input: {
  stage: PrivateDesignStage;
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  stageExpenseZar: number;
  totalExpenseZar: number;
}): StageBillingRow {
  const feePercent = input.phaseFeePercents[input.stage];
  const expenseZar = Math.round(input.stageExpenseZar);
  const costPercent =
    input.totalExpenseZar > 0
      ? Math.round((input.stageExpenseZar / input.totalExpenseZar) * 100)
      : 0;
  return {
    stage: input.stage,
    label: PRIVATE_STAGE_LABELS[input.stage],
    status: phaseStatus(input.stage, input.designStage),
    feePercent,
    costPercent,
    feeZar: Math.round((input.feeZar * feePercent) / 100),
    expenseZar,
    costZar: expenseZar,
  };
}

/** @deprecated Use buildProjectPhaseBreakdown — flat stage list kept for compatibility. */
export function buildPhaseBreakdown(input: {
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  stageExpenseTotals?: StageExpenseTotals;
  totalExpenseZar?: number;
}): StageBillingRow[] {
  const totals = input.stageExpenseTotals ?? emptyStageExpenseTotals();
  const totalExpenseZar = input.totalExpenseZar ?? 0;
  return PRIVATE_STAGE_ORDER.map((stage) =>
    buildStageRow({
      stage,
      designStage: input.designStage,
      feeZar: input.feeZar,
      phaseFeePercents: input.phaseFeePercents,
      stageExpenseZar: totals[stage],
      totalExpenseZar,
    }),
  );
}

export function buildProjectPhaseBreakdown(input: {
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  phaseStructure: PhaseStructure;
  expenses?: Array<{ designStage: string | null; amountZar: number }>;
}): {
  phaseGroups: PhaseGroupBreakdown[];
  stages: StageBillingRow[];
  stageExpenseTotals: StageExpenseTotals;
  unassignedExpenseZar: number;
  totalExpenseZar: number;
  costPercents: PhaseSplitMap;
} {
  const { totals, unassignedZar } = expenseTotalsByStage(input.expenses ?? []);
  const totalExpenseZar = PRIVATE_STAGE_ORDER.reduce((sum, stage) => sum + totals[stage], 0);
  const costPercents = computeCostPercentsFromExpenses(totals);

  const stages = PRIVATE_STAGE_ORDER.map((stage) =>
    buildStageRow({
      stage,
      designStage: input.designStage,
      feeZar: input.feeZar,
      phaseFeePercents: input.phaseFeePercents,
      stageExpenseZar: totals[stage],
      totalExpenseZar,
    }),
  );
  const stageByKey = Object.fromEntries(stages.map((s) => [s.stage, s])) as Record<
    PrivateDesignStage,
    StageBillingRow
  >;

  const phaseGroups = input.phaseStructure.phases.map((phase: ProjectPhaseGroup) => {
    const phaseStages = phase.stageKeys.map((key) => stageByKey[key]).filter(Boolean);
    return {
      id: phase.id,
      name: phase.name,
      stages: phaseStages,
      feeZar: phaseStages.reduce((sum, s) => sum + s.feeZar, 0),
      costZar: phaseStages.reduce((sum, s) => sum + s.expenseZar, 0),
    };
  });

  return { phaseGroups, stages, stageExpenseTotals: totals, unassignedExpenseZar: unassignedZar, totalExpenseZar, costPercents };
}

export function resolveProjectPhaseStructure(json: unknown): PhaseStructure {
  return resolvePhaseStructure(json);
}

export { defaultPhaseStructure };
