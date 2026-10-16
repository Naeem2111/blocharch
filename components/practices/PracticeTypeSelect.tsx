"use client";

import { isPracticeType, PRACTICE_TYPES, type PracticeTypeValue } from "@/lib/practice-types";

export function PracticeTypeSelect({
  value,
  disabled,
  onChange,
  className,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: PracticeTypeValue) => void;
  className?: string;
}) {
  const current = isPracticeType(value) ? value : "architecture_firm";
  return (
    <select
      aria-label="Practice type"
      value={current}
      disabled={disabled}
      onChange={(e) => {
        if (isPracticeType(e.target.value)) onChange(e.target.value);
      }}
      className={className ?? "select-console w-full min-w-[10.5rem] rounded-md px-2 py-1.5 text-sm"}
    >
      {PRACTICE_TYPES.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
