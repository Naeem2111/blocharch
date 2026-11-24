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

/** Column titles from Architecture Athlete Recruitment Form (Responses), in sheet order. */
export const RECRUITMENT_FORM_COLUMNS = [
  "Timestamp",
  "Full name",
  "Email Address",
  "Phone Number",
  "Physical Address",
  "City & Country",
  "Linkedin Handle",
  "Instagram Handle",
  "Please upload your portfolio",
  "Please upload a copy of your ID/Passport",
  "Please upload your CV",
  "Do you have at least 3-5 years of experience in architectural documentation, design, drafting, modelling and rending?",
  "How many years of experience do you have?",
  "What services can you confidently deliver?",
  "What software are you proficient in?",
  "Specify Other",
  "Have you worked remotely before?",
  "What motivates you to do your best work—even when no one is watching?",
  "Describe a moment in your career where you went above and beyond.",
  "How do you handle a situation where a client changes direction halfway through a project?",
  "What kind of architectural work makes you feel alive?",
  "What is your typical monthly availability?",
  "Are you available fulltime 160hrs per month? 8hrs per day",
  "When could you realistically start if contacted?",
  "Do you have your own computer, software licenses, and stable internet and wifi?",
  "What computer are you currently using? Please provide spec.",
  "Are you comfortable receiving markups, coaching notes, and ongoing feedback?",
  "Email address",
  "How proficient are you in the above-mentioned software?",
  "Reference",
  "What AI software are you proficient in?",
  "Your Current Professional Position",
  "Do you own a tablet (e.g. iPad or similar)? If yes, please state the make and model.",
  "Age",
  "Note:",
] as const;

export function formAnswersInSheetOrder(answers: RecruitmentAnswer[]): RecruitmentAnswer[] {
  const byQuestion = new Map(answers.map((answer) => [answer.question.trim(), answer.answer]));
  const known = new Set<string>(RECRUITMENT_FORM_COLUMNS);
  const ordered: RecruitmentAnswer[] = RECRUITMENT_FORM_COLUMNS.map((question) => ({
    question,
    answer: byQuestion.get(question) ?? "",
  }));
  for (const answer of answers) {
    const question = answer.question.trim();
    if (!question || known.has(question) || question.toLowerCase() === "application id") continue;
    ordered.push({ question, answer: answer.answer });
  }
  return ordered;
}

export type RecruitmentAnswer = { question: string; answer: string };

export type RecruitmentDocument = {
  label: string;
  url: string;
  fileId: string | null;
  kind: "portfolio" | "cv" | "identity" | "other";
  restricted: boolean;
};
