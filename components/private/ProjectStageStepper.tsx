import type { PrivateStageStep } from "@/lib/private-constants";
import { PRIVATE_STAGE_DONE_COPY } from "@/lib/private-constants";

function stepTone(state: PrivateStageStep["state"]) {
  if (state === "done") return "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30";
  if (state === "current") return "bg-brand-500/20 text-brand-200 ring-brand-500/40";
  return "bg-white/[0.06] text-slate-500 ring-white/[0.08]";
}

function stepLabelClass(state: PrivateStageStep["state"]) {
  if (state === "current") return "font-medium text-brand-100";
  if (state === "done") return "text-slate-300";
  return "text-slate-500";
}

export function ProjectStageStepper({
  stages,
  constructionNote = true,
  onSelect,
}: {
  stages: PrivateStageStep[];
  constructionNote?: boolean;
  onSelect?: (key: PrivateStageStep["key"]) => void;
}) {
  const current = stages.find((s) => s.state === "current");

  return (
    <ol className="space-y-1">
      {stages.map((s) => {
        const interactive = Boolean(onSelect);
        const inner = (
          <>
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${stepTone(s.state)}`}
            >
              {s.state === "done" ? "✓" : s.number}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm leading-snug ${stepLabelClass(s.state)}`}>
                {s.label}
                {s.state === "current" ? (
                  <span className="ml-2 text-xs font-medium text-brand-300">You are here</span>
                ) : null}
              </p>
              {s.state === "current" && s.key === "council_approved" ? (
                <p className="mt-1 text-xs text-slate-400">{PRIVATE_STAGE_DONE_COPY}</p>
              ) : null}
              {s.key === "council_approved" &&
              constructionNote &&
              current?.key !== "council_approved" ? (
                <p className="mt-1 text-xs text-slate-500">{PRIVATE_STAGE_DONE_COPY}</p>
              ) : null}
            </div>
          </>
        );

        return (
          <li key={s.key}>
            {interactive ? (
              <button
                type="button"
                onClick={() => onSelect?.(s.key)}
                className={`flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left ${
                  s.state === "current" ? "bg-brand-500/10 ring-1 ring-brand-500/25" : "hover:bg-white/[0.04]"
                }`}
              >
                {inner}
              </button>
            ) : (
              <div
                className={`flex items-start gap-3 rounded-lg px-2.5 py-2 ${
                  s.state === "current" ? "bg-brand-500/10 ring-1 ring-brand-500/25" : ""
                }`}
              >
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
