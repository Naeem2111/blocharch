export const PRACTICE_TYPES = [
  { value: "architecture_firm", label: "Architecture Firm" },
  { value: "interior_design", label: "Interior Design" },
  { value: "development", label: "Development" },
] as const;

export type PracticeTypeValue = (typeof PRACTICE_TYPES)[number]["value"];

export function isPracticeType(value: string): value is PracticeTypeValue {
  return PRACTICE_TYPES.some((option) => option.value === value);
}

export function practiceTypeLabel(value: string | null | undefined): string {
  return PRACTICE_TYPES.find((option) => option.value === value)?.label ?? "Architecture Firm";
}
