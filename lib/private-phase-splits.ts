import type { PrivateDesignStage } from "@prisma/client";
import {
  PRIVATE_STAGE_DURATIONS,
  PRIVATE_STAGE_ORDER,
  stageIndex,
} from "@/lib/private-constants";
import {
  allDesignPhases,
  defaultPhaseStructure,
  resolvePhaseStructure,
  type PhaseStructure,
  type ProjectDesignPhase,
  type ProjectPhaseGroup,
} from "@/lib/private-phase-structure";
import {
  computeCostPercentsFromExpenses,
  expenseTotalsByStage,
  type StageExpenseTotals,
} from "@/lib/private-stage-expenses";

/** Fee % keyed by design phase id (UUID or legacy built-in key). */
export type PhaseSplitMap = Record<string, number>;

export type StageBillingRow = {
  phaseId: string;
  /** @deprecated Use phaseId — kept for rows tied to built-in workflow. */
  stage?: PrivateDesignStage;
  label: string;
  status: "completed" | "current" | "upcoming";
  feePercent: number;
  costPercent: number;
  feeZar: number;
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

function designPhaseDuration(phase: ProjectDesignPhase): number {
  if (phase.builtInKey) return PRIVATE_STAGE_DURATIONS[phase.builtInKey];
  return 1;
}

export function defaultPhaseSplits(structure: PhaseStructure = defaultPhaseStructure()): PhaseSplitMap {
  const phases = allDesignPhases(structure);
  const totalWeight = phases.reduce((sum, phase) => sum + designPhaseDuration(phase), 0);
  if (totalWeight <= 0 || phases.length === 0) return {};

  const raw = phases.map((phase) => ({
    id: phase.id,
    pct: (designPhaseDuration(phase) / totalWeight) * 100,
  }));
  const rounded = raw.map((row) => ({ ...row, pct: Math.round(row.pct) }));
  let sum = rounded.reduce((s, row) => s + row.pct, 0);
  let i = 0;
  while (sum !== 100 && i < 100 && rounded.length > 0) {
    const idx = i % rounded.length;
    rounded[idx].pct += sum < 100 ? 1 : -1;
    sum = rounded.reduce((s, row) => s + row.pct, 0);
    i++;
  }
  return Object.fromEntries(rounded.map((row) => [row.id, row.pct]));
}

export function parsePhaseSplitMap(
  json: unknown,
  structure?: PhaseStructure,
): PhaseSplitMap | null {
  if (!json || typeof json !== "object") return null;
  const map: PhaseSplitMap = {};
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    map[key] = Math.round(n);
  }

  if (structure) {
    const ids = new Set(allDesignPhases(structure).map((p) => p.id));
    for (const id of Object.keys(map)) {
      if (!ids.has(id)) return null;
    }
  }

  return map;
}

/** Migrate legacy enum-keyed fee map to design phase ids. */
export function migratePhaseSplitMap(
  json: unknown,
  structure: PhaseStructure,
): PhaseSplitMap {
  const parsed = parsePhaseSplitMap(json) ?? {};
  const phases = allDesignPhases(structure);
  const map: PhaseSplitMap = {};

  for (const phase of phases) {
    if (parsed[phase.id] != null) {
      map[phase.id] = parsed[phase.id];
    } else if (phase.builtInKey && parsed[phase.builtInKey] != null) {
      map[phase.id] = parsed[phase.builtInKey];
    } else {
      map[phase.id] = 0;
    }
  }

  return map;
}

export function resolvePhaseSplits(
  feeJson: unknown,
  costJson: unknown,
  structure: PhaseStructure = defaultPhaseStructure(),
): { feePercents: PhaseSplitMap; costPercents: PhaseSplitMap } {
  const defaults = defaultPhaseSplits(structure);
  const feePercents = migratePhaseSplitMap(feeJson, structure);
  const hasFeeValues = Object.values(feePercents).some((v) => v > 0);
  return {
    feePercents: hasFeeValues ? feePercents : defaults,
    costPercents: migratePhaseSplitMap(costJson, structure),
  };
}

export function phaseSplitSum(map: PhaseSplitMap, structure?: PhaseStructure): number {
  if (structure) {
    return allDesignPhases(structure).reduce((sum, phase) => sum + (map[phase.id] ?? 0), 0);
  }
  return Object.values(map).reduce((sum, value) => sum + value, 0);
}

export function validatePhaseSplitMap(
  map: PhaseSplitMap,
  structure: PhaseStructure,
): { ok: boolean; sum: number } {
  const sum = phaseSplitSum(map, structure);
  return { ok: sum === 100, sum };
}

export function distributeFeePercentAcrossDesignPhases(
  designPhases: ProjectDesignPhase[],
  totalPercent: number,
): Partial<PhaseSplitMap> {
  if (designPhases.length === 0) return {};
  const totalWeight = designPhases.reduce((sum, phase) => sum + designPhaseDuration(phase), 0);
  if (totalWeight <= 0) {
    const even = Math.round(totalPercent / designPhases.length);
    return Object.fromEntries(designPhases.map((phase) => [phase.id, even]));
  }
  const raw = designPhases.map((phase) => ({
    id: phase.id,
    pct: (designPhaseDuration(phase) / totalWeight) * totalPercent,
  }));
  const rounded = raw.map((row) => ({ ...row, pct: Math.round(row.pct) }));
  let sum = rounded.reduce((s, row) => s + row.pct, 0);
  let i = 0;
  while (sum !== Math.round(totalPercent) && i < 100) {
    const idx = i % rounded.length;
    rounded[idx].pct += sum < Math.round(totalPercent) ? 1 : -1;
    sum = rounded.reduce((s, row) => s + row.pct, 0);
    i++;
  }
  return Object.fromEntries(rounded.map((row) => [row.id, row.pct]));
}

export function syncPhaseFeePercentsFromStructure(
  phaseFeePercents: PhaseSplitMap,
  phaseStructure: PhaseStructure,
): PhaseSplitMap {
  let next = { ...phaseFeePercents };
  for (const group of phaseStructure.phases) {
    if (group.feePercent != null && group.designPhases.length > 0) {
      next = {
        ...next,
        ...(distributeFeePercentAcrossDesignPhases(
          group.designPhases,
          group.feePercent,
        ) as PhaseSplitMap),
      };
    }
  }
  return next;
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

function designPhaseStatus(
  phase: ProjectDesignPhase,
  currentStage: PrivateDesignStage,
  groupState: "completed" | "current" | "upcoming",
): "completed" | "current" | "upcoming" {
  if (phase.builtInKey) return phaseStatus(phase.builtInKey, currentStage);
  return groupState;
}

function buildPhaseRow(input: {
  phase: ProjectDesignPhase;
  groupState: "completed" | "current" | "upcoming";
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  expenseZar: number;
  totalExpenseZar: number;
}): StageBillingRow {
  const feePercent = input.phaseFeePercents[input.phase.id] ?? 0;
  const expenseZar = Math.round(input.expenseZar);
  const costPercent =
    input.totalExpenseZar > 0
      ? Math.round((input.expenseZar / input.totalExpenseZar) * 100)
      : 0;
  const status = designPhaseStatus(input.phase, input.designStage, input.groupState);
  return {
    phaseId: input.phase.id,
    stage: input.phase.builtInKey,
    label: input.phase.name,
    status,
    feePercent,
    costPercent,
    feeZar: Math.round((input.feeZar * feePercent) / 100),
    expenseZar,
    costZar: expenseZar,
  };
}

function groupWorkflowState(
  group: ProjectPhaseGroup,
  currentStage: PrivateDesignStage,
): "completed" | "current" | "upcoming" {
  const indices = group.designPhases
    .map((p) => (p.builtInKey ? stageIndex(p.builtInKey) : null))
    .filter((idx): idx is number => idx != null);
  if (indices.length === 0) return "upcoming";
  const currentIdx = stageIndex(currentStage);
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);
  if (maxIdx < currentIdx) return "completed";
  if (minIdx <= currentIdx && currentIdx <= maxIdx) return "current";
  return "upcoming";
}

/** @deprecated Use buildProjectPhaseBreakdown — flat list kept for compatibility. */
export function buildPhaseBreakdown(input: {
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  phaseStructure?: PhaseStructure;
  stageExpenseTotals?: StageExpenseTotals;
  totalExpenseZar?: number;
}): StageBillingRow[] {
  const structure = input.phaseStructure ?? defaultPhaseStructure();
  const breakdown = buildProjectPhaseBreakdown({
    designStage: input.designStage,
    feeZar: input.feeZar,
    phaseFeePercents: input.phaseFeePercents,
    phaseStructure: structure,
  });
  return breakdown.stages;
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
  const costPercents = migratePhaseSplitMap(
    computeCostPercentsFromExpenses(totals),
    input.phaseStructure,
  );
  const effectiveFeePercents = syncPhaseFeePercentsFromStructure(
    input.phaseFeePercents,
    input.phaseStructure,
  );

  const phaseGroups = input.phaseStructure.phases.map((group: ProjectPhaseGroup) => {
    const groupState = groupWorkflowState(group, input.designStage);
    const phaseStages = group.designPhases.map((phase) => {
      const expenseZar = phase.builtInKey ? totals[phase.builtInKey] : 0;
      return buildPhaseRow({
        phase,
        groupState,
        designStage: input.designStage,
        feeZar: input.feeZar,
        phaseFeePercents: effectiveFeePercents,
        expenseZar,
        totalExpenseZar,
      });
    });
    return {
      id: group.id,
      name: group.name,
      stages: phaseStages,
      feeZar: phaseStages.reduce((sum, s) => sum + s.feeZar, 0),
      costZar: phaseStages.reduce((sum, s) => sum + s.expenseZar, 0),
    };
  });

  const stages = phaseGroups.flatMap((group) => group.stages);

  return {
    phaseGroups,
    stages,
    stageExpenseTotals: totals,
    unassignedExpenseZar: unassignedZar,
    totalExpenseZar,
    costPercents,
  };
}

export function resolveProjectPhaseStructure(json: unknown): PhaseStructure {
  return resolvePhaseStructure(json);
}

export { defaultPhaseStructure };
