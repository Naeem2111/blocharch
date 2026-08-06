import type { PrivateProject, PrivateClient, OpsAthlete, PrivateProjectCustomType } from "@prisma/client";
import {
  PRIVATE_STAGE_LABELS,
  athleteInitials,
} from "@/lib/private-constants";
import { resolvePrivateProjectTypeLabel } from "@/lib/private-project-types";
import { computePrivateProgressPercent, resolvePrivateProgressPercent, marginPercent, privateStageMeta } from "@/lib/private-progress";

type ProjectWithRelations = PrivateProject & {
  client: Pick<PrivateClient, "id" | "name" | "contactEmail" | "contactPhone" | "slug">;
  assignedAthlete: Pick<OpsAthlete, "id" | "fullName" | "athleteCode" | "privateWeeklyCapHours"> | null;
  customProjectType?: Pick<PrivateProjectCustomType, "id" | "label"> | null;
};

export function serializePrivateProject(
  p: ProjectWithRelations,
  extras?: {
    hoursLifeToDate?: number;
    openActionTitle?: string | null;
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
    briefReceivedAt: p.briefReceivedAt?.toISOString().slice(0, 10) ?? null,
    councilSubmittedAt: p.councilSubmittedAt?.toISOString().slice(0, 10) ?? null,
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
    stageMeta: meta,
    updatedAt: p.updatedAt.toISOString(),
    client: {
      id: p.client.id,
      name: p.client.name,
      contactEmail: p.client.contactEmail,
      contactPhone: p.client.contactPhone,
      slug: p.client.slug,
    },
    athlete: p.assignedAthlete
      ? {
          id: p.assignedAthlete.id,
          fullName: p.assignedAthlete.fullName,
          athleteCode: p.assignedAthlete.athleteCode,
          initials: athleteInitials(p.assignedAthlete.fullName),
          privateWeeklyCapHours: p.assignedAthlete.privateWeeklyCapHours,
        }
      : null,
    hoursLifeToDate: extras?.hoursLifeToDate ?? null,
    openActionTitle: extras?.openActionTitle ?? null,
  };
}
