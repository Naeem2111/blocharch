import type {
  RecruitmentArchiveReason,
  RecruitmentAvailability,
  RecruitmentExperience,
  RecruitmentStatus,
} from "@prisma/client";

export const RECRUITMENT_STATUSES: { value: RecruitmentStatus; label: string }[] = [
  { value: "to_review", label: "To review" },
  { value: "potential", label: "Potential" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "onboarding", label: "Onboarding" },
  { value: "on_bench", label: "On bench" },
  { value: "live_active", label: "Live / Active" },
  { value: "archived", label: "Archived" },
];

export const ACTIVE_RECRUITMENT_STATUSES: RecruitmentStatus[] = [
  "to_review",
  "potential",
  "shortlisted",
  "onboarding",
  "on_bench",
  "live_active",
];

export const RECRUITMENT_AVAILABILITY: { value: RecruitmentAvailability; label: string }[] = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "after_hours", label: "After hours only" },
  { value: "unavailable", label: "Currently unavailable" },
  { value: "needs_confirmation", label: "Needs confirmation" },
];

export const RECRUITMENT_EXPERIENCE: { value: RecruitmentExperience; label: string }[] = [
  { value: "under_3", label: "Under 3 years" },
  { value: "from_3_under_5", label: "3–under 5 years" },
  { value: "from_5_under_10", label: "5–under 10 years" },
  { value: "ten_plus", label: "10+ years" },
  { value: "not_specified", label: "Not specified" },
];

export const ARCHIVE_REASONS: { value: RecruitmentArchiveReason; label: string }[] = [
  { value: "not_suitable", label: "Not suitable" },
  { value: "withdrew", label: "Withdrew" },
  { value: "no_longer_interested", label: "No longer interested" },
  { value: "duplicate", label: "Duplicate application" },
  { value: "other", label: "Other" },
];

export function recruitmentStatusLabel(value: string): string {
  return RECRUITMENT_STATUSES.find((item) => item.value === value)?.label ?? value;
}

export function recruitmentAvailabilityLabel(value: string): string {
  return RECRUITMENT_AVAILABILITY.find((item) => item.value === value)?.label ?? value;
}

export function recruitmentExperienceLabel(value: string): string {
  return RECRUITMENT_EXPERIENCE.find((item) => item.value === value)?.label ?? value;
}

export function archiveReasonLabel(value: string): string {
  return ARCHIVE_REASONS.find((item) => item.value === value)?.label ?? value;
}

export type RecruitmentAnswer = { question: string; answer: string };

export type RecruitmentDocument = {
  label: string;
  url: string;
  fileId: string | null;
  kind: "portfolio" | "cv" | "identity" | "other";
  restricted: boolean;
};
