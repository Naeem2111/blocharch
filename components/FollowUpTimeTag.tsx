import {
  followUpTimeLeftColor,
  formatFollowUpTimeLeft,
  tagTextColorFromBackground,
} from "@/lib/lead-stage-ui";

type FollowUpTimeTagProps = {
  followUpDueAt?: string | null;
  className?: string;
  compact?: boolean;
};

/** Gmail-style pill showing time until follow-up (or overdue). */
export function FollowUpTimeTag({ followUpDueAt, className = "", compact = false }: FollowUpTimeTagProps) {
  const label = formatFollowUpTimeLeft(followUpDueAt);
  if (!label) return null;

  const backgroundColor = followUpTimeLeftColor(followUpDueAt);
  const color = tagTextColorFromBackground(backgroundColor);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold leading-none ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${className}`}
      style={{ backgroundColor, color }}
      title={followUpDueAt ? `Follow-up due ${new Date(followUpDueAt).toLocaleDateString()}` : undefined}
    >
      {label}
    </span>
  );
}
