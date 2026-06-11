"use client";

import { useMemo } from "react";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";

type CalendarProject = {
  id: string;
  name: string;
  clientName: string;
  dueDate: string;
  progressPercent: number;
  assignedAthleteName: string | null;
};

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y ?? new Date().getFullYear(), monthIndex: (m ?? 1) - 1 };
}

export function DueDateCalendar({
  month,
  projects,
}: {
  month: string;
  projects: CalendarProject[];
}) {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarProject[]>();
    for (const p of projects) {
      const d = new Date(`${p.dueDate}T12:00:00`);
      if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
      const day = d.getDate();
      const list = map.get(day) ?? [];
      list.push(p);
      map.set(day, list);
    }
    return map;
  }, [projects, year, monthIndex]);

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const monthLabel = firstDay.toLocaleString("en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{monthLabel}</h3>
      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="bg-slate-900/80 px-2 py-1.5 text-center font-medium text-slate-500">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          const items = cell.day ? byDay.get(cell.day) ?? [] : [];
          return (
            <div
              key={i}
              className={`min-h-[88px] bg-slate-900/50 p-1.5 ${cell.day ? "" : "opacity-40"}`}
            >
              {cell.day ? (
                <>
                  <span className="tabular-nums text-slate-400">{cell.day}</span>
                  <ul className="mt-1 space-y-1">
                    {items.map((p) => (
                      <li
                        key={p.id}
                        className="rounded bg-white/[0.04] px-1 py-0.5"
                        title={`${p.name} · ${p.clientName}`}
                      >
                        <p className="truncate text-[10px] font-medium text-slate-200">{p.name}</p>
                        <ProjectProgressBar percent={p.progressPercent} showLabel={false} />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
