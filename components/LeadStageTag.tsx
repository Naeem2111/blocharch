import type { LeadStage } from "@/lib/leads";
import { LEAD_STAGE_COLORS, LEAD_STAGE_LABELS, tagTextColorFromBackground } from "@/lib/lead-stage-ui";

function normalizeStage(stage: string): LeadStage {
  return stage in LEAD_STAGE_COLORS ? (stage as LeadStage) : "cold";
}

export function leadStageTagStyle(stage: string): { backgroundColor: string; color: string } {
  const key = normalizeStage(stage);
  const backgroundColor = LEAD_STAGE_COLORS[key];
  return { backgroundColor, color: tagTextColorFromBackground(backgroundColor) };
}

type LeadStageTagProps = {
  stage: string;
  className?: string;
  compact?: boolean;
};

/** Gmail-style solid label pill for pipeline stage. */
export function LeadStageTag({ stage, className = "", compact = false }: LeadStageTagProps) {
  const key = normalizeStage(stage);
  const label = LEAD_STAGE_LABELS[key];
  const style = leadStageTagStyle(key);

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-semibold leading-none ${compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${className}`}
      style={style}
      title={label}
    >
      {label}
    </span>
  );
}
