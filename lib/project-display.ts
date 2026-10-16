import type { OpsProjectPhase } from "@prisma/client";
import { displayProjectStageLabel, PROJECT_PHASE_LABELS } from "@/lib/ops-constants";

export function projectStageDisplayLabel(
  stage: OpsProjectPhase | string,
  customLabel?: string | null,
): string {
  const custom = customLabel?.trim();
  if (custom) return custom;
  if (stage === "survey_conversion" || stage === "existing_drawings") {
    return displayProjectStageLabel(stage);
  }
  if (stage in PROJECT_PHASE_LABELS) {
    return displayProjectStageLabel(stage as OpsProjectPhase);
  }
  return "Custom package";
}

/** Full title with stage/package — consistent across athlete, admin, archives, and daily logs. */
export function formatProjectFullTitle(
  name: string,
  currentStage: OpsProjectPhase | string,
  customLabel?: string | null,
): string {
  const stageLabel = projectStageDisplayLabel(currentStage, customLabel);
  const trimmed = name.trim();
  if (!trimmed) return stageLabel;

  const nameLower = trimmed.toLowerCase();
  const stageParts = stageLabel
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (nameLower.includes(stageLabel.toLowerCase())) return trimmed;
  if (stageParts.some((part) => nameLower.includes(part))) return trimmed;

  return `${trimmed} (${stageLabel})`;
}

export function projectDisplayFields(project: {
  name: string;
  currentStage: OpsProjectPhase;
  customStage?: { label: string } | null;
}) {
  const customLabel = project.customStage?.label ?? null;
  const stageLabel = projectStageDisplayLabel(project.currentStage, customLabel);
  const displayTitle = formatProjectFullTitle(project.name, project.currentStage, customLabel);
  return { stageLabel, displayTitle };
}
