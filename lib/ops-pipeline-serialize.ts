import type { OpsProjectPhase } from "@prisma/client";
import { displayProjectStageLabel } from "@/lib/ops-constants";

type PipelineRow = {
  id: string;
  clientId: string;
  name: string;
  address: string | null;
  description: string | null;
  expectedStage: OpsProjectPhase | null;
  targetStartDate: Date | null;
  targetDueDate: Date | null;
  notes: string | null;
  sortOrder: number;
  visibleToClient: boolean;
  convertedProjectId: string | null;
  convertedAt: Date | null;
  updatedAt: Date;
  client?: {
    name: string;
    logoUrl: string | null;
    logoBgColor: string | null;
    logoTextTone: string | null;
  };
};

export function serializePipelineRow(row: PipelineRow, extras: Record<string, unknown> = {}) {
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: row.client?.name ?? "",
    clientLogoUrl: row.client?.logoUrl ?? null,
    clientLogoBgColor: row.client?.logoBgColor ?? null,
    clientLogoTextTone: row.client?.logoTextTone ?? null,
    name: row.name,
    address: row.address,
    description: row.description,
    expectedStage: row.expectedStage,
    expectedStageLabel: row.expectedStage ? displayProjectStageLabel(row.expectedStage) : null,
    targetStartDate: row.targetStartDate?.toISOString().slice(0, 10) ?? null,
    targetDueDate: row.targetDueDate?.toISOString().slice(0, 10) ?? null,
    notes: row.notes,
    sortOrder: row.sortOrder,
    visibleToClient: row.visibleToClient,
    convertedProjectId: row.convertedProjectId,
    convertedAt: row.convertedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    ...extras,
  };
}

export function serializePublicPipelineRow(row: PipelineRow) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description?.trim() || null,
    expectedStageLabel: row.expectedStage ? displayProjectStageLabel(row.expectedStage) : null,
    targetStartDate: row.targetStartDate?.toISOString().slice(0, 10) ?? null,
    targetDueDate: row.targetDueDate?.toISOString().slice(0, 10) ?? null,
  };
}
