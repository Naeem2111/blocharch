import type { PrivateDesignStage } from "@prisma/client";
import {
  PRIVATE_STAGE_DURATIONS,
  PRIVATE_STAGE_ORDER,
  PRIVATE_STAGE_TYPICAL_COPY,
  TOTAL_PRIVATE_STAGE_DAYS,
  stageIndex,
} from "@/lib/private-constants";

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/**
 * Duration-weighted progress: completed stages count their full typical days;
 * current stage counts min(elapsed, typical). Caps at 99 until council_approved
 * so 100% never overclaims "finished".
 */
export function resolvePrivateProgressPercent(input: {
  designStage: PrivateDesignStage;
  stageStartedAt: Date;
  manualProgressPercent?: number | null;
  asOf?: Date;
}): number {
  if (input.manualProgressPercent != null) {
    return Math.min(100, Math.max(0, Math.round(input.manualProgressPercent)));
  }
  return computePrivateProgressPercent(input);
}

export function computePrivateProgressPercent(input: {
  designStage: PrivateDesignStage;
  stageStartedAt: Date;
  asOf?: Date;
}): number {
  const asOf = input.asOf ?? new Date();
  const idx = stageIndex(input.designStage);
  if (idx < 0) return 0;

  let completedDays = 0;
  for (let i = 0; i < idx; i++) {
    completedDays += PRIVATE_STAGE_DURATIONS[PRIVATE_STAGE_ORDER[i]];
  }

  const typical = PRIVATE_STAGE_DURATIONS[input.designStage];
  const elapsed = daysBetween(input.stageStartedAt, asOf);
  const currentContribution = Math.min(elapsed, typical);

  if (input.designStage === "council_approved") {
    return 100;
  }

  const raw = ((completedDays + currentContribution) / TOTAL_PRIVATE_STAGE_DAYS) * 100;
  return Math.min(99, Math.max(0, Math.round(raw)));
}

export function privateStageMeta(input: {
  designStage: PrivateDesignStage;
  stageStartedAt: Date;
  asOf?: Date;
}) {
  const asOf = input.asOf ?? new Date();
  const typical = PRIVATE_STAGE_DURATIONS[input.designStage];
  const daysIntoStage = daysBetween(input.stageStartedAt, asOf);
  const overTypical = daysIntoStage > typical;
  const quietExplanation =
    overTypical && PRIVATE_STAGE_TYPICAL_COPY[input.designStage]
      ? PRIVATE_STAGE_TYPICAL_COPY[input.designStage]
      : overTypical
        ? `This stage usually takes about ${typical} days. It's running longer than typical — nothing's necessarily wrong.`
        : null;

  return {
    stageNumber: stageIndex(input.designStage) + 1,
    stageCount: PRIVATE_STAGE_ORDER.length,
    typicalDays: typical,
    daysIntoStage,
    overTypical,
    quietExplanation,
    progressPercent: computePrivateProgressPercent(input),
  };
}

export function marginPercent(feeZar: number, costZar: number): number | null {
  if (feeZar <= 0) return null;
  return Math.round(((feeZar - costZar) / feeZar) * 100);
}
