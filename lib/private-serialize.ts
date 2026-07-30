import type { PrivateProject, PrivateClient, OpsAthlete } from "@prisma/client";
import {
  PRIVATE_STAGE_LABELS,
  PRIVATE_PROJECT_TYPE_LABELS,
  athleteInitials,
} from "@/lib/private-constants";
import { computePrivateProgressPercent, marginPercent, privateStageMeta } from "@/lib/private-progress";

type ProjectWithRelations = PrivateProject & {
  client: Pick<PrivateClient, "id" | "name" | "contactEmail" | "contactPhone" | "slug">;
  assignedAthlete: Pick<OpsAthlete, "id" | "fullName" | "athleteCode" | "privateWeeklyCapHours"> | null;
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

  return {
    id: p.id,
    name: p.name,
    address: p.address,
    projectType: p.projectType,
    projectTypeLabel: PRIVATE_PROJECT_TYPE_LABELS[p.projectType],
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
    progressPercent: computePrivateProgressPercent({
      designStage: p.designStage,
      stageStartedAt: p.stageStartedAt,
    }),
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
