import type { OpsProjectPhase, OpsTaskType } from "@prisma/client";
import { PROJECT_PHASE_LABELS, TASK_TYPE_LABELS } from "@/lib/ops-constants";

/** V2: combined phase options shown in daily tracker UI. */
export const DAILY_PROJECT_PHASE_OPTIONS: { value: OpsProjectPhase; label: string }[] = [
  { value: "survey_conversion", label: "Survey Conversion (Existing Drawings)" },
  { value: "proposed_drawings", label: PROJECT_PHASE_LABELS.proposed_drawings },
  { value: "planning_submission", label: PROJECT_PHASE_LABELS.planning_submission },
  { value: "tender_construction_pack", label: PROJECT_PHASE_LABELS.tender_construction_pack },
  { value: "construction", label: PROJECT_PHASE_LABELS.construction },
  { value: "housekeeping_internal", label: PROJECT_PHASE_LABELS.housekeeping_internal },
];

export const DAILY_TASK_TYPE_OPTIONS = Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({
  value: value as OpsTaskType,
  label,
}));

export function formatTaskTypesDisplay(taskType: string, taskTypes?: string[] | null): string {
  const list =
    taskTypes && taskTypes.length > 0
      ? taskTypes
      : taskType
        ? [taskType]
        : [];
  return list
    .map((t) => TASK_TYPE_LABELS[t as OpsTaskType] ?? t)
    .join(", ");
}
