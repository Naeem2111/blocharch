type BarItem = {
  label: string;
  value: number;
  sublabel?: string;
};

type SimpleBarChartProps = {
  items: BarItem[];
  valueSuffix?: string;
  maxValue?: number;
};

export function SimpleBarChart({ items, valueSuffix = "", maxValue }: SimpleBarChartProps) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No data for this period.</p>;
  }

  const max = maxValue ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.max(4, (item.value / max) * 100);
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-slate-300">{item.label}</span>
              <span className="shrink-0 tabular-nums text-slate-400">
                {item.value.toFixed(1)}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
                style={{ width: `${pct}%` }}
              />
            </div>
            {item.sublabel ? <p className="mt-0.5 text-[10px] text-slate-500">{item.sublabel}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
