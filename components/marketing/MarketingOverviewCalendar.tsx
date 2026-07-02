"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MiniMonthCalendar, type CalendarMark } from "@/components/MiniMonthCalendar";
import type { MarketingDueDateItem } from "@/lib/lead-outreach";
import { followUpStatusColor, followUpStatusLabel } from "@/lib/lead-stage-ui";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function MarketingOverviewCalendar({ items }: { items: MarketingDueDateItem[] }) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const marks: CalendarMark[] = useMemo(
    () =>
      items.map((item) => ({
        date: toDateOnly(item.followUpDueAt),
        label: `${item.practiceName} follow-up`,
        color: projectDueColor(daysUntilDueFromIso(toDateOnly(item.followUpDueAt))),
      })),
    [items]
  );

  const monthItems = useMemo(
    () =>
      items.filter((item) => toDateOnly(item.followUpDueAt).startsWith(calendarMonth)),
    [items, calendarMonth]
  );

  const selectedItems = useMemo(
    () => items.filter((item) => toDateOnly(item.followUpDueAt) === selectedDate),
    [items, selectedDate]
  );

  const upcomingItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return items
      .filter((item) => new Date(toDateOnly(item.followUpDueAt)) >= today)
      .slice(0, 8);
  }, [items]);

  return (
    <section className="card-tool rounded-2xl p-5 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Marketing follow-ups</h2>
          <p className="mt-1 text-sm text-slate-400">Upcoming outreach due dates from Lead nurturing</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/automation"
            className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.04]"
          >
            Lead nurturing
          </Link>
          <Link
            href="/dashboard/marketing/notifications"
            className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-1.5 text-xs font-medium text-brand-200 hover:bg-brand-500/15"
          >
            Due today / overdue
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => shiftMonth(m, -1))}
              className="rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-slate-400 hover:bg-white/[0.04]"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date().toISOString().slice(0, 7);
                setCalendarMonth(now);
                setSelectedDate(new Date().toISOString().slice(0, 10));
              }}
              className="rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-slate-400 hover:bg-white/[0.04]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth((m) => shiftMonth(m, 1))}
              className="rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-slate-400 hover:bg-white/[0.04]"
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <MiniMonthCalendar
            month={calendarMonth}
            marks={marks}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setCalendarMonth(date.slice(0, 7));
            }}
          />
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Overdue
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> 1–3 days
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-400" /> 4–7 days
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> 8–14 days
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> 14+ days
            </span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {monthItems.length} follow-up{monthItems.length === 1 ? "" : "s"} this month
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {formatShortDate(selectedDate)}
            </h3>
            {selectedItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No follow-ups due on this date.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedItems.map((item) => (
                  <li
                    key={`${item.practiceUrl}-${item.followUpDueAt}`}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        href={`/dashboard/practices/${encodeURIComponent(item.practiceSlug)}`}
                        className="font-medium text-white hover:text-brand-300"
                      >
                        {item.practiceName}
                      </Link>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          color: followUpStatusColor(item.followUpStatus),
                          backgroundColor: `${followUpStatusColor(item.followUpStatus)}18`,
                        }}
                      >
                        {followUpStatusLabel(item.followUpStatus)}
                      </span>
                    </div>
                    {item.nextAction ? (
                      <p className="mt-1 text-xs text-slate-400">Next: {item.nextAction}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Upcoming</h3>
            {upcomingItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No scheduled follow-ups ahead.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingItems.map((item) => (
                  <li
                    key={`upcoming-${item.practiceUrl}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-sm"
                  >
                    <Link
                      href={`/dashboard/practices/${encodeURIComponent(item.practiceSlug)}`}
                      className="min-w-0 truncate text-slate-200 hover:text-brand-300"
                    >
                      {item.practiceName}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatShortDate(toDateOnly(item.followUpDueAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
