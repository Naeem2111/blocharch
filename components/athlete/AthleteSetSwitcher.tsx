"use client";

type SetId = "uk" | "private";

export function AthleteSetSwitcher({
  value,
  onChange,
  label,
}: {
  value: SetId;
  onChange: (value: SetId) => void;
  label: string;
}) {
  const options: Array<{ id: SetId; label: string }> = [
    { id: "uk", label: "UK clients" },
    { id: "private", label: "Private projects" },
  ];

  return (
    <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
              selected
                ? option.id === "private"
                  ? "bg-sky-500/20 text-sky-200 ring-sky-400/30"
                  : "bg-brand-500/20 text-brand-200 ring-brand-500/30"
                : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
