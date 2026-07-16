"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MiniMonthCalendar, type CalendarMark } from "@/components/MiniMonthCalendar";
import { FollowUpTimeTag } from "@/components/FollowUpTimeTag";
import { LeadStageTag } from "@/components/LeadStageTag";
import type { MarketingDueDateItem } from "@/lib/lead-outreach";
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

const DUE_DATE_LEGEND = [
  { label: "Overdue", color: "#ef4444" },
  { label: "1–3 days", color: "#f97316" },
  { label: "4–7 days", color: "#eab308" },
  { label: "8–14 days", color: "#3b82f6" },
  { label: "14+ days", color: "#22c55e" },
] as const;

function practiceHref(slug: string) {
  return `/dashboard/practices/${encodeURIComponent(slug)}`;
}

function FollowUpRow({
  item,
  showDate = false,
  variant = "default",
}: {
  item: MarketingDueDateItem;
  showDate?: boolean;
  variant?: "default" | "attention";
}) {
  const isAttention = item.followUpStatus === "overdue" || item.followUpStatus === "due_today";
  const accent = projectDueColor(daysUntilDueFromIso(toDateOnly(item.followUpDueAt)));
  const dateClass =
    item.followUpStatus === "overdue"
      ? "text-red-300 font-medium"
      : item.followUpStatus === "due_today"
        ? "text-amber-300 font-medium"
        : "text-slate-300";

  return (
    <li
      className={`relative overflow-hidden rounded-xl border px-4 py-3 ${
        variant === "attention"
          ? "border-white/[0.1] bg-white/[0.04]"
          : "border-white/[0.08] bg-white/[0.02]"
      }`}
    >
      <span
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-1 rounded-l-xl sm:w-1.5"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={practiceHref(item.practiceSlug)}
              className="font-medium text-white hover:text-brand-300"
            >
              {item.practiceName}
            </Link>
            <LeadStageTag stage={item.effectiveStage} compact />
            <FollowUpTimeTag followUpDueAt={item.followUpDueAt} compact />
          </div>
          {item.nextAction ? (
            <p className="mt-1 text-xs text-slate-300">Next: {item.nextAction}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showDate ? (
            <span className={`text-xs ${dateClass}`}>{formatShortDate(toDateOnly(item.followUpDueAt))}</span>
          ) : null}
          {isAttention && variant === "attention" ? (
            <span
              className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{
                color: item.followUpStatus === "overdue" ? "#fca5a5" : "#fcd34d",
                backgroundColor: item.followUpStatus === "overdue" ? "#dc262622" : "#f59e0b22",
              }}
            >
              {item.followUpStatus === "overdue" ? "Overdue" : "Due today"}
            </span>
          ) : null}
          <Link href={practiceHref(item.practiceSlug)} className="btn-brand-primary rounded-lg px-3 py-1.5 text-xs">
            View
          </Link>
        </div>
      </div>
    </li>
  );
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

  const attentionItems = useMemo(
    () =>
      items
        .filter((item) => item.followUpStatus === "overdue" || item.followUpStatus === "due_today")
        .sort((a, b) => new Date(a.followUpDueAt).getTime() - new Date(b.followUpDueAt).getTime()),
    [items]
  );

  const upcomingItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return items
      .filter(
        (item) =>
          item.followUpStatus !== "overdue" &&
          item.followUpStatus !== "due_today" &&
          new Date(toDateOnly(item.followUpDueAt)) > today
      )
      .slice(0, 8);
  }, [items]);

  return (
    <section className="card-tool rounded-2xl p-5 ring-1 ring-white/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Marketing follow-ups</h2>
          <p className="mt-1 text-sm text-slate-300">Upcoming outreach due dates from Lead nurturing</p>
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
            All notifications
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] xl:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
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
            size="lg"
            markStyle="fill"
            month={calendarMonth}
            marks={marks}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setCalendarMonth(date.slice(0, 7));
            }}
          />
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
            {DUE_DATE_LEGEND.map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm shadow-[inset_0_0_0_1px_rgba(15,23,42,0.14)]"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {monthItems.length} follow-up{monthItems.length === 1 ? "" : "s"} this month
            {attentionItems.length > 0 ? (
              <span className="text-amber-300"> · {attentionItems.length} need attention</span>
            ) : null}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              Due today / overdue
            </h3>
            {attentionItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No follow-ups need attention right now.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attentionItems.map((item) => (
                  <FollowUpRow
                    key={`attention-${item.practiceUrl}`}
                    item={item}
                    showDate
                    variant="attention"
                  />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {formatShortDate(selectedDate)}
            </h3>
            {selectedItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No follow-ups due on this date.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {selectedItems.map((item) => (
                  <FollowUpRow
                    key={`${item.practiceUrl}-${item.followUpDueAt}`}
                    item={item}
                    showDate
                  />
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Upcoming</h3>
            {upcomingItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No scheduled follow-ups ahead.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {upcomingItems.map((item) => (
                  <FollowUpRow key={`upcoming-${item.practiceUrl}`} item={item} showDate />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
