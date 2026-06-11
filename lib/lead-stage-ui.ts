import type { LeadStage } from "@/lib/leads";

export const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  cold: "#0ea5e9",
  no_reply: "#f59e0b",
  positive_reply: "#22c55e",
  follow_up_interested: "#10b981",
  negative_reply: "#ef4444",
  follow_up_not_interested: "#f97316",
};

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  cold: "Cold",
  no_reply: "No reply",
  positive_reply: "Positive reply",
  follow_up_interested: "Follow-up (interested)",
  negative_reply: "Negative reply",
  follow_up_not_interested: "Follow-up (not interested)",
};
