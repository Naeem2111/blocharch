"use client";

import { useMemo } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";

export const DUE_DATE_LEGEND = [
  { label: "Overdue", color: "#ef4444" },
  { label: "1–3 days", color: "#f97316" },
  { label: "4–7 days", color: "#eab308" },
  { label: "8–14 days", color: "#3b82f6" },
  { label: "14+ days", color: "#22c55e" },
] as const;

type CalendarProject = {
  id: string;
  name: string;
  clientName: string;
  clientLogoUrl?: string | null;
  clientLogoBgColor?: string | null;
  clientLogoTextTone?: string | null;
  dueDate: string;
  dueAt?: string | null;
  progressPercent: number;
  assignedAthleteName: string | null;
};

function parseMonth(month: string): { year: number; monthIndex: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y ?? new Date().getFullYear(), monthIndex: (m ?? 1) - 1 };
}

function projectDueIso(p: CalendarProject): string {
  return p.dueAt ?? p.dueDate;
}

function urgencyColor(p: CalendarProject): string {
  return projectDueColor(daysUntilDueFromIso(projectDueIso(p)));
}

export function DueDateCalendar({
  month,
  projects,
  showLegend = true,
}: {
  month: string;
  projects: CalendarProject[];
  showLegend?: boolean;
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
    <div className="due-date-calendar">
      <h3 className="text-base font-semibold text-white">{monthLabel}</h3>
      <div className="mt-4 overflow-x-auto">
        <div className="due-date-calendar-grid grid min-w-[42rem] grid-cols-7 gap-1 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm sm:min-w-0">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="due-date-calendar-head px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 sm:text-sm sm:normal-case sm:tracking-normal"
            >
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            const items = cell.day ? byDay.get(cell.day) ?? [] : [];

            return (
              <div
                key={i}
                className={`due-date-calendar-cell min-h-[7.5rem] p-2 sm:min-h-[8.5rem] sm:p-2.5 ${
                  cell.day ? "" : "due-date-calendar-cell-empty"
                }`}
              >
                {cell.day ? (
                  <>
                    <span className="due-date-calendar-day-num text-sm font-semibold tabular-nums">
                      {cell.day}
                    </span>
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((p) => {
                        const accent = urgencyColor(p);

                        return (
                          <li
                            key={p.id}
                            className="due-date-calendar-event due-date-calendar-event-urgency rounded-md border border-white/[0.08] border-l-[3px] bg-white/[0.06] px-1.5 py-1 text-slate-200"
                            style={{ borderLeftColor: accent }}
                            title={`${p.name} · ${p.clientName}`}
                          >
                            <p className="due-date-calendar-event-title text-xs font-semibold leading-snug text-white">
                              <span className="line-clamp-2">{p.name}</span>
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium leading-snug text-slate-400">
                              {p.clientLogoUrl || p.clientLogoBgColor ? (
                                <ClientAvatar
                                  name={p.clientName}
                                  logoUrl={p.clientLogoUrl}
                                  backgroundColor={p.clientLogoBgColor}
                                  textTone={asAvatarTextTone(p.clientLogoTextTone)}
                                  size={16}
                                />
                              ) : null}
                              <span className="line-clamp-1 min-w-0">{p.clientName}</span>
                            </p>
                            <div className="mt-1 [&_.progress-track]:h-2">
                              <ProjectProgressBar percent={p.progressPercent} showLabel={false} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {showLegend ? (
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
          {DUE_DATE_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm border-2 bg-white/[0.06]"
                style={{ borderColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
