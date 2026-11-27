function leadInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function LeadBlock({
  name,
  title,
  showLabel = true,
}: {
  name: string | null;
  title?: string | null;
  showLabel?: boolean;
}) {
  if (!name) {
    return <span className="text-xs text-slate-500">Lead assigned soon</span>;
  }
  return (
    <div className="min-w-0">
      {showLabel ? (
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Your lead</p>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`client-portal-lead-avatar inline-flex shrink-0 items-center justify-center rounded-full bg-white/[0.08] font-semibold text-slate-300 ${
            title ? "h-12 w-12 text-xs" : "h-8 w-8 text-[11px]"
          }`}
        >
          {leadInitials(name)}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span className="max-w-full truncate rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-1 text-sm text-slate-100">
            {name}
          </span>
          {title ? (
            <span className="max-w-full truncate rounded-full border border-white/[0.1] bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-slate-300">
              {title}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
