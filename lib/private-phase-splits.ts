import type { PrivateDesignStage } from "@prisma/client";
import {
  PRIVATE_STAGE_DURATIONS,
  PRIVATE_STAGE_LABELS,
  PRIVATE_STAGE_ORDER,
  stageIndex,
} from "@/lib/private-constants";

export type PhaseSplitMap = Record<PrivateDesignStage, number>;

export type PhaseBreakdownRow = {
  stage: PrivateDesignStage;
  label: string;
  status: "completed" | "current" | "upcoming";
  feePercent: number;
  costPercent: number;
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

export function buildPhaseBreakdown(input: {
  designStage: PrivateDesignStage;
  feeZar: number;
  phaseFeePercents: PhaseSplitMap;
  phaseCostPercents: PhaseSplitMap;
}): PhaseBreakdownRow[] {
  return PRIVATE_STAGE_ORDER.map((stage) => {
    const feePercent = input.phaseFeePercents[stage];
    const costPercent = input.phaseCostPercents[stage];
    return {
      stage,
      label: PRIVATE_STAGE_LABELS[stage],
      status: phaseStatus(stage, input.designStage),
      feePercent,
      costPercent,
      feeZar: Math.round((input.feeZar * feePercent) / 100),
      costZar: Math.round((input.feeZar * costPercent) / 100),
    };
  });
}
