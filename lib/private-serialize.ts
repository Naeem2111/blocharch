import type { PrivateProject, PrivateClient, OpsAthlete, PrivateProjectCustomType } from "@prisma/client";
import {
  PRIVATE_STAGE_LABELS,
  athleteInitials,
} from "@/lib/private-constants";
import { resolvePrivateProjectTypeLabel } from "@/lib/private-project-types";
import { computePrivateProgressPercent, resolvePrivateProgressPercent, marginPercent, privateStageMeta } from "@/lib/private-progress";
import {
  buildProjectPhaseBreakdown,
  resolvePhaseSplits,
} from "@/lib/private-phase-splits";
import { resolvePhaseStructure } from "@/lib/private-phase-structure";
import { isoDateOnly, parseStageDateMap, resolveStageDates } from "@/lib/private-stage-dates";

type SerializedAthlete = {
  id: string;
  fullName: string;
  athleteCode: string;
  initials: string;
  isPrimary: boolean;
  privateWeeklyCapHours: number;
};

type AssignmentRow = {
  isPrimary: boolean;
  athlete: Pick<OpsAthlete, "id" | "fullName" | "athleteCode" | "privateWeeklyCapHours">;
};

type ProjectWithRelations = PrivateProject & {
  client: Pick<PrivateClient, "id" | "name" | "contactEmail" | "contactPhone" | "slug">;
  assignedAthlete: Pick<OpsAthlete, "id" | "fullName" | "athleteCode" | "privateWeeklyCapHours"> | null;
  athleteAssignments?: AssignmentRow[];
  customProjectType?: Pick<PrivateProjectCustomType, "id" | "label"> | null;
  expenses?: Array<{ designStage: string | null; amountZar: { toString(): string } | number }>;
};

function serializeAthlete(
  athlete: Pick<OpsAthlete, "id" | "fullName" | "athleteCode" | "privateWeeklyCapHours">,
  isPrimary: boolean,
): SerializedAthlete {
  return {
    id: athlete.id,
    fullName: athlete.fullName,
    athleteCode: athlete.athleteCode,
    initials: athleteInitials(athlete.fullName),
    isPrimary,
    privateWeeklyCapHours: athlete.privateWeeklyCapHours,
  };
}

function serializePrivateAthletes(p: ProjectWithRelations): SerializedAthlete[] {
  const fromAssignments = (p.athleteAssignments ?? []).map((row) =>
    serializeAthlete(row.athlete, row.isPrimary),
  );
  if (fromAssignments.length > 0) return fromAssignments;
  if (p.assignedAthlete) return [serializeAthlete(p.assignedAthlete, true)];
  return [];
}

export function serializePrivateProject(
  p: ProjectWithRelations,
  extras?: {
    hoursLifeToDate?: number;
    openActionTitle?: string | null;
    includeExpenseRecords?: boolean;
  },
) {
  const fee = Number(p.feeZar);
  const cost = Number(p.costZar);
  const meta = privateStageMeta({
    designStage: p.designStage,
    stageStartedAt: p.stageStartedAt,
  });

  const calculatedProgress = computePrivateProgressPercent({
    designStage: p.designStage,
    stageStartedAt: p.stageStartedAt,
  });

  const phaseStructure = resolvePhaseStructure(p.phaseStructure);
  const { feePercents } = resolvePhaseSplits(p.phaseFeePercents, p.phaseCostPercents, phaseStructure);
  const expenseRows = (p.expenses ?? []).map((e) => ({
    designStage: e.designStage,
    amountZar: Number(e.amountZar),
  }));
  const breakdown = buildProjectPhaseBreakdown({
    designStage: p.designStage,
    feeZar: fee,
    phaseFeePercents: feePercents,
    phaseStructure,
    expenses: expenseRows,
  });
  const athletes = serializePrivateAthletes(p);

  return {
    id: p.id,
    name: p.name,
    address: p.address,
    projectType: p.projectType,
    projectTypeLabel: resolvePrivateProjectTypeLabel(p.projectType, p.customProjectType),
    customProjectTypeId: p.customProjectTypeId,
    designStage: p.designStage,
    designStageLabel: PRIVATE_STAGE_LABELS[p.designStage],
    status: p.status,
    feeZar: fee,
    costZar: cost,
    marginZar: fee - cost,
    marginPercent: marginPercent(fee, cost),
    outOfScopeBilledZar: Number(p.outOfScopeBilledZar),
    outOfScopeFlag: p.outOfScopeFlag,
    stageNotes: p.stageNotes,
    clientDescription: p.clientDescription,
    dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
    briefReceivedAt: p.briefReceivedAt?.toISOString().slice(0, 10) ?? null,
    councilSubmittedAt: p.councilSubmittedAt?.toISOString().slice(0, 10) ?? null,
    stageDates: resolveStageDates(parseStageDateMap(p.stageDates) ?? {}, {
      briefReceivedAt: isoDateOnly(p.briefReceivedAt),
      councilSubmittedAt: isoDateOnly(p.councilSubmittedAt),
    }),
    stageStartedAt: p.stageStartedAt.toISOString().slice(0, 10),
    completedAt: p.completedAt?.toISOString().slice(0, 10) ?? null,
    handoverOutcome: p.handoverOutcome,
    progressPercent: resolvePrivateProgressPercent({
      designStage: p.designStage,
      stageStartedAt: p.stageStartedAt,
      manualProgressPercent: p.manualProgressPercent,
    }),
    calculatedProgressPercent: calculatedProgress,
    manualProgressPercent: p.manualProgressPercent,
    progressIsManual: p.manualProgressPercent != null,
    phaseFeePercents: feePercents,
    phaseCostPercents: breakdown.costPercents,
    phaseStructure,
    phaseGroups: breakdown.phaseGroups,
    phases: breakdown.stages,
    expensesTotalZar: breakdown.totalExpenseZar,
    unassignedExpenseZar: breakdown.unassignedExpenseZar,
    expenseRecords: extras?.includeExpenseRecords ? expenseRows : undefined,
    stageMeta: meta,
    updatedAt: p.updatedAt.toISOString(),
    client: {
      id: p.client.id,
      name: p.client.name,
      contactEmail: p.client.contactEmail,
      contactPhone: p.client.contactPhone,
      slug: p.client.slug,
    },
    athletes,
    athlete: athletes.find((a) => a.isPrimary) ?? athletes[0] ?? null,
    hoursLifeToDate: extras?.hoursLifeToDate ?? null,
    openActionTitle: extras?.openActionTitle ?? null,
  };
}
