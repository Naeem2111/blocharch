import type { OpsProjectPhase, OpsProjectStatus } from "@prisma/client";
import { projectDisplayFields } from "@/lib/project-display";
import { serializeProjectDueAt } from "@/lib/project-deadline";

type ProjectLike = {
  id: string;
  clientId: string;
  assignedAthleteId: string | null;
  projectLeadContactId: string | null;
  name: string;
  projectNumber: string;
  address: string | null;
  projectLead: string | null;
  complexity: string;
  startDate: Date | null;
  dueDate: Date | null;
  handoverDate: Date | null;
  currentStage: OpsProjectPhase;
  currentStatus: OpsProjectStatus | string;
  progressPercent: number | null;
  completedAt: Date | null;
  deadlineBeatenDays: number | null;
  deadlineBeatenMinutes: number | null;
  notes: string | null;
  blockerFlag: boolean;
  checkInRequested: boolean;
};

export function serializeOpsProjectRow<T extends ProjectLike>(
  project: T,
  extras: Record<string, unknown> = {}
) {
  const { displayTitle, stageLabel } = projectDisplayFields(project);
  const due = serializeProjectDueAt(project.dueDate);
  return {
    id: project.id,
    clientId: project.clientId,
    assignedAthleteId: project.assignedAthleteId,
    projectLeadContactId: project.projectLeadContactId,
    name: project.name,
    displayTitle,
    stageLabel,
    projectNumber: project.projectNumber,
    address: project.address,
    projectLead: project.projectLead,
    complexity: project.complexity,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: due.dueDate,
    dueAt: due.dueAt,
    handoverDate: project.handoverDate?.toISOString().slice(0, 10) ?? null,
    currentStage: project.currentStage,
    currentStatus: project.currentStatus,
    progressPercent: project.progressPercent,
    completedAt: project.completedAt?.toISOString() ?? null,
    deadlineBeatenDays: project.deadlineBeatenDays,
    deadlineBeatenMinutes: project.deadlineBeatenMinutes,
    notes: project.notes,
    blockerFlag: project.blockerFlag,
    checkInRequested: project.checkInRequested,
    ...extras,
  };
}
