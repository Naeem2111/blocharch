"use client";

type AthleteOption = { id: string; fullName: string; athleteCode?: string };

export function AthleteAssignmentsEditor({
  athleteIds,
  primaryAthleteId,
  athleteTitles,
  athletes,
  onChange,
  className = "",
  radioName = "project-primary-athlete",
  hint = "Select one or more athletes. Primary is shown first on the project.",
  showTitles = false,
}: {
  athleteIds: string[];
  primaryAthleteId: string;
  athleteTitles?: Record<string, string>;
  athletes: AthleteOption[];
  onChange: (next: {
    assignedAthleteIds: string[];
    primaryAthleteId: string;
    athleteTitles: Record<string, string>;
  }) => void;
  className?: string;
  radioName?: string;
  hint?: string;
  showTitles?: boolean;
}) {
  const titles = athleteTitles ?? {};

  function emit(nextIds: string[], nextPrimary: string, nextTitles: Record<string, string> = titles) {
    onChange({ assignedAthleteIds: nextIds, primaryAthleteId: nextPrimary, athleteTitles: nextTitles });
  }

  function toggleAthlete(athleteId: string, checked: boolean) {
    const nextIds = checked
      ? Array.from(new Set([...athleteIds, athleteId]))
      : athleteIds.filter((id) => id !== athleteId);
    let nextPrimary = primaryAthleteId;
    if (!checked && primaryAthleteId === athleteId) {
      nextPrimary = nextIds[0] ?? "";
    }
    if (checked && nextIds.length === 1) {
      nextPrimary = athleteId;
    }
    emit(nextIds, nextPrimary);
  }

  return (
    <div className={className}>
      <p className="text-xs text-slate-400">Assigned athletes</p>
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-md border border-white/[0.08] bg-white/[0.02] p-2">
        {athletes.length === 0 ? (
          <p className="px-1 py-1 text-xs text-slate-500">No athletes available.</p>
        ) : (
          athletes.map((a) => {
            const checked = athleteIds.includes(a.id);
            return (
              <div key={a.id} className="rounded px-1 py-1 hover:bg-white/[0.04]">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleAthlete(a.id, e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span className="min-w-0 flex-1 truncate">{a.fullName}</span>
                  {checked ? (
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="radio"
                        name={radioName}
                        checked={primaryAthleteId === a.id}
                        onChange={() => emit(athleteIds, a.id)}
                      />
                      Primary
                    </span>
                  ) : null}
                </label>
                {showTitles && checked ? (
                  <label className="mt-1 flex items-center gap-2 pl-6 text-[11px] text-slate-500">
                    Portal title
                    <input
                      value={titles[a.id] ?? ""}
                      onChange={(e) => emit(athleteIds, primaryAthleteId, { ...titles, [a.id]: e.target.value })}
                      placeholder="Shown on the client portal"
                      className="min-w-0 flex-1 rounded border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-white placeholder:text-slate-600"
                    />
                  </label>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>
    </div>
  );
}
