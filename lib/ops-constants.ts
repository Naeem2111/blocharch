import type {
  OpsPricingTier,
  OpsProjectComplexity,
  OpsProjectPhase,
  OpsProjectStatus,
  OpsTaskType,
  OpsUrgencyStatus,
} from "@prisma/client";

export const PRICING_TIER_LANE_GBP: Record<OpsPricingTier, number> = {
  tier_25: 2187,
  tier_30: 2041,
  tier_35: 1895,
  tier_40: 1750,
};

export const PROJECT_PHASE_LABELS: Record<OpsProjectPhase, string> = {
  survey_conversion: "Survey Conversion",
  existing_drawings: "Existing Drawings",
  proposed_drawings: "Proposed Drawings",
  planning_submission: "Planning / Submission",
  tender_construction_pack: "Tender / Construction Pack",
  construction: "Construction",
  housekeeping_internal: "Housekeeping / Internal",
};

export const TASK_TYPE_LABELS: Record<OpsTaskType, string> = {
  plans: "Plans",
  sections: "Sections",
  elevations: "Elevations",
  joinery_drawings: "Joinery Drawings",
  electrical_drawings: "Electrical Drawings",
  modelling_3d: "3D Modelling",
  rendering: "Rendering",
  coordination_markups: "Coordination / Markups",
  review_qa: "Review / QA",
  admin_housekeeping: "Admin / Housekeeping",
  other: "Other",
};

export const PROJECT_STATUS_LABELS: Record<OpsProjectStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting_on_feedback: "Waiting on Feedback",
  zoom_required: "Zoom Required",
  blocked: "Blocked",
  completed: "Completed",
  handed_over: "Handed Over",
};

export const COMPLEXITY_LABELS: Record<OpsProjectComplexity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const URGENCY_LABELS: Record<OpsUrgencyStatus, string> = {
  normal: "Normal",
  critical: "Critical",
  completed: "Completed",
};

export const PRICING_TIER_LABELS: Record<OpsPricingTier, string> = {
  tier_25: "25%",
  tier_30: "30%",
  tier_35: "35%",
  tier_40: "40%",
};

export function laneCostForTier(tier: OpsPricingTier): number {
  return PRICING_TIER_LANE_GBP[tier];
}

export function isOpsProjectPhase(v: string): v is OpsProjectPhase {
  return v in PROJECT_PHASE_LABELS;
}

export function isOpsTaskType(v: string): v is OpsTaskType {
  return v in TASK_TYPE_LABELS;
}

export function isOpsProjectStatus(v: string): v is OpsProjectStatus {
  return v in PROJECT_STATUS_LABELS;
}

export function isOpsProjectComplexity(v: string): v is OpsProjectComplexity {
  return v in COMPLEXITY_LABELS;
}

export function isOpsUrgencyStatus(v: string): v is OpsUrgencyStatus {
  return v in URGENCY_LABELS;
}

export function isOpsPricingTier(v: string): v is OpsPricingTier {
  return v in PRICING_TIER_LABELS;
}
