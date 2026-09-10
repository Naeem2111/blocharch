import type { PrivateDesignStage, PrivateProjectType } from "@prisma/client";

/** Typical duration (days) per design stage — drives duration-weighted progress %. */
export const PRIVATE_STAGE_DURATIONS: Record<PrivateDesignStage, number> = {
  site_measure_up: 3,
  existing_drawings: 7,
  concept_design: 14,
  design_review: 7,
  design_development: 21,
  council_submission_docs: 10,
  council_review: 45,
  council_approved: 2,
};

export const PRIVATE_STAGE_ORDER: PrivateDesignStage[] = [
  "site_measure_up",
  "existing_drawings",
  "concept_design",
  "design_review",
  "design_development",
  "council_submission_docs",
  "council_review",
  "council_approved",
];

export const PRIVATE_STAGE_LABELS: Record<PrivateDesignStage, string> = {
  site_measure_up: "Site measure-up",
  existing_drawings: "Existing / as-built drawings",
  concept_design: "Concept design",
  design_review: "Design review & refinement",
  design_development: "Design development",
  council_submission_docs: "Council submission documentation",
  council_review: "Council submission review",
  council_approved: "Council approval granted",
};

/** Honest label when stage 8 is current — design approved, construction is next. */
export const PRIVATE_STAGE_DONE_COPY =
  "Design approved — construction is the next, separate phase";

/** Expenses with no design phase — one-off project costs, like housekeeping on daily logs. */
export const PRIVATE_FIXED_FEE_EXPENSE_LABEL = "Fixed fee";

export const PRIVATE_STAGE_TYPICAL_COPY: Partial<Record<PrivateDesignStage, string>> = {
  council_review:
    "Council review typically takes 6–8 weeks and moves in one step once a decision is made — there's nothing for you to do, and nothing's gone wrong.",
};

/** Client-facing copy for the private portal hero + timeline. */
export const PRIVATE_STAGE_CLIENT_COPY: Record<
  PrivateDesignStage,
  { current: string; nextHint: string }
> = {
  site_measure_up: {
    current: "We're measuring the site so the design is based on what's actually there.",
    nextHint: "Next: we'll draw the existing building from this survey.",
  },
  existing_drawings: {
    current: "We're drawing the existing building as it stands today.",
    nextHint: "Next: we'll start the concept design from these drawings.",
  },
  concept_design: {
    current: "Developing your initial design for review.",
    nextHint: "Next: present the concept for your feedback.",
  },
  design_review: {
    current: "Refining the concept with your feedback.",
    nextHint: "Next: we'll develop the design in more detail.",
  },
  design_development: {
    current: "Developing the design in detail for submission.",
    nextHint: "Next: we'll prepare the council submission documents.",
  },
  council_submission_docs: {
    current: "Preparing the drawings and documents for council.",
    nextHint: "Next: the application goes to council for review.",
  },
  council_review: {
    current: "Council is reviewing the submission — there's nothing for you to do while we wait.",
    nextHint: "Next: we'll share the decision as soon as it arrives.",
  },
  council_approved: {
    current: "Design approved — construction is the next, separate phase.",
    nextHint: "Construction follows as a separate phase.",
  },
};

export const PRIVATE_PROJECT_TYPE_LABELS: Record<PrivateProjectType, string> = {
  residential_extension: "Residential extension",
  commercial: "Commercial",
  other: "Other",
};

export const TOTAL_PRIVATE_STAGE_DAYS = PRIVATE_STAGE_ORDER.reduce(
  (sum, stage) => sum + PRIVATE_STAGE_DURATIONS[stage],
  0,
);

export function isPrivateDesignStage(value: string): value is PrivateDesignStage {
  return (PRIVATE_STAGE_ORDER as string[]).includes(value);
}

export function isPrivateProjectType(value: string): value is PrivateProjectType {
  return value in PRIVATE_PROJECT_TYPE_LABELS;
}

export function stageIndex(stage: PrivateDesignStage): number {
  return PRIVATE_STAGE_ORDER.indexOf(stage);
}

export type PrivateStageStep = {
  key: PrivateDesignStage;
  label: string;
  number: number;
  state: "done" | "current" | "upcoming";
};

export function buildPrivateStageSteps(current: PrivateDesignStage): PrivateStageStep[] {
  const currentIdx = stageIndex(current);
  return PRIVATE_STAGE_ORDER.map((key, i) => ({
    key,
    label: PRIVATE_STAGE_LABELS[key],
    number: i + 1,
    state: (i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming") as PrivateStageStep["state"],
  }));
}

export function athleteInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
