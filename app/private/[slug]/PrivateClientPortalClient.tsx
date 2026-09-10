"use client";

import { useRef, useState } from "react";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { PublicThemeToggle } from "@/components/client-portal/PublicThemeToggle";
import { PlannerDoneToggle } from "@/components/planner/PlannerDoneToggle";
import {
  PRIVATE_STAGE_CLIENT_COPY,
  PRIVATE_STAGE_DONE_COPY,
  buildPrivateStageSteps,
  type PrivateStageStep,
} from "@/lib/private-constants";
import type { PrivateDesignStage } from "@prisma/client";

type PortalData = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/private-public-portal").getPublicPrivateProjectBySlug>>
>;

type ActionItem = { id: string; title: string };
type CompletedActionItem = { id: string; title: string; completedAt: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/\bSep\b/, "Sept");
}

function stageCopy(key: PrivateDesignStage) {
  return PRIVATE_STAGE_CLIENT_COPY[key];
}

function HorizontalStageRail({ stages }: { stages: PrivateStageStep[] }) {
  return (
    <div className="mt-8" aria-hidden>
      <div className="flex items-center">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1] : null;
          const lineClass =
            prev?.state === "done" && (s.state === "done" || s.state === "current")
              ? "private-portal-rail-line-done"
              : "private-portal-rail-line";
          return (
            <div key={s.key} className={`flex items-center ${i === 0 ? "shrink-0" : "min-w-0 flex-1"}`}>
              {i > 0 ? <div className={`h-[2px] min-w-[8px] flex-1 ${lineClass}`} /> : null}
              <div
                className={
                  s.state === "current"
                    ? "private-portal-rail-current"
                    : s.state === "done"
                      ? "private-portal-rail-done"
                      : "private-portal-rail-upcoming"
                }
              >
                {s.state === "done" ? (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                    <path
                      d="M2 6.2l2.6 2.6L10 3.4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PrivateClientPortalClient({
  slug,
  data,
}: {
  slug: string;
  data: PortalData;
}) {
  const { project, updates, documents = [] } = data;
  const [actionItems, setActionItems] = useState<ActionItem[]>(data.actionItems);
  const [completedActionItems, setCompletedActionItems] = useState<CompletedActionItem[]>(
    data.completedActionItems,
  );
  const [completing, setCompleting] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const completedDetailsRef = useRef<HTMLDetailsElement>(null);
  const stages = buildPrivateStageSteps(project.designStage);
  const current = stages.find((s) => s.state === "current") ?? stages[0]!;
  const next = stages.find((s) => s.number === current.number + 1) ?? null;
  const doneCount = stages.filter((s) => s.state === "done").length;
  const copy = stageCopy(project.designStage);
  const currentComplete = project.designStage === "council_approved";

  function markRecentlyCompleted(id: string) {
    setRecentlyCompleted((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setRecentlyCompleted((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(id);
        return nextSet;
      });
    }, 700);
  }

  async function completeAction(actionItemId: string) {
    setCompleting(actionItemId);
    try {
      const r = await fetch(`/api/private/portal/${slug}/actions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItemId }),
      });
      if (!r.ok) return;
      const j = (await r.json()) as {
        actionItem: { id: string; title: string; completedAt: string };
      };
      setActionItems((prev) => prev.filter((a) => a.id !== actionItemId));
      setCompletedActionItems((prev) => [
        {
          id: j.actionItem.id,
          title: j.actionItem.title,
          completedAt: j.actionItem.completedAt.slice(0, 10),
        },
        ...prev,
      ]);
      markRecentlyCompleted(j.actionItem.id);
      if (completedDetailsRef.current) completedDetailsRef.current.open = true;
    } finally {
      setCompleting(null);
    }
  }

  const updateDots = ["bg-brand-400", "bg-violet-400", "bg-emerald-400", "bg-sky-400"];

  return (
    <div className="private-portal min-h-screen bg-[var(--bg-page)] text-slate-100">
      <header className="client-portal-header border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <ClientPortalBrandMark />
          <PublicThemeToggle />
        </div>
      </header>

      <main className="client-portal-main px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-400">
            Your project
          </p>
          <h1 className="private-portal-title mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.address}
          </h1>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            {project.briefReceivedAt ? (
              <div className="private-portal-chip">
                <span className="private-portal-chip-icon" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6M7.5 4.5h9A1.5 1.5 0 0118 6v13.5A1.5 1.5 0 0116.5 21h-9A1.5 1.5 0 016 19.5V6A1.5 1.5 0 017.5 4.5z"
                    />
                  </svg>
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Brief received
                  </p>
                  <p className="private-portal-chip-value mt-0.5 text-sm">{formatDate(project.briefReceivedAt)}</p>
                </div>
              </div>
            ) : (
              <div />
            )}
            <div className="private-portal-chip">
              <span className="private-portal-chip-icon" aria-hidden>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15A.75.75 0 0120.25 7.5v12a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75v-12a.75.75 0 01.75-.75z"
                  />
                </svg>
              </span>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Updated</p>
                <p className="private-portal-chip-value mt-0.5 text-sm">{formatDate(project.updatedAt)}</p>
              </div>
            </div>
          </div>

          <section className="private-portal-hero mt-8 rounded-2xl p-5 sm:p-7">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-400">
                  Current stage
                </p>
                <h2 className="private-portal-title mt-2 text-3xl font-semibold tracking-tight">
                  {project.designStageLabel}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                      currentComplete
                        ? "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30"
                        : "bg-brand-500/15 text-brand-200 ring-brand-400/35"
                    }`}
                  >
                    {currentComplete ? "Complete" : "In progress"}
                  </span>
                  <span className="text-sm text-slate-400">
                    Step {current.number} of {stages.length}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">{copy.current}</p>
                {project.quietExplanation ? (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                    {project.quietExplanation}
                  </p>
                ) : null}
              </div>

              <div className="lg:border-l lg:border-white/[0.08] lg:pl-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Up next
                </p>
                {next ? (
                  <>
                    <p className="private-portal-title mt-2 text-lg font-semibold leading-snug">
                      {next.label}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      Target date:{" "}
                      <span className="text-slate-300">
                        {project.dueDate ? formatDate(project.dueDate) : "To be confirmed"}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="private-portal-title mt-2 text-lg font-semibold leading-snug">
                      Construction
                    </p>
                    <p className="mt-3 text-sm text-slate-500">{PRIVATE_STAGE_DONE_COPY}</p>
                  </>
                )}
              </div>
            </div>

            <HorizontalStageRail stages={stages} />
            <p className="mt-4 text-xs text-slate-500">
              {currentComplete
                ? `${stages.length} stages completed`
                : `${doneCount} stage${doneCount === 1 ? "" : "s"} completed · Stage ${current.number} in progress`}
            </p>
          </section>

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className="client-portal-card rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
              <h2 className="private-portal-title text-lg font-semibold">Your project timeline</h2>
              <p className="mt-1 text-sm text-slate-500">A step-by-step guide to your project journey.</p>

              <ol className="private-portal-timeline relative mt-6 space-y-1">
                <span className="private-portal-timeline-line" aria-hidden />
                {stages.map((s) => {
                  const isNext = next?.key === s.key;
                  const hint = s.state === "current" ? stageCopy(s.key).nextHint : null;
                  return (
                    <li
                      key={s.key}
                      className={`relative flex gap-3 rounded-xl px-2 py-2.5 ${
                        s.state === "current" ? "private-portal-timeline-current" : ""
                      }`}
                    >
                      <span
                        className={
                          s.state === "current"
                            ? "private-portal-rail-current relative z-10 mt-0.5"
                            : s.state === "done"
                              ? "private-portal-rail-done relative z-10 mt-0.5"
                              : isNext
                                ? "private-portal-rail-next relative z-10 mt-0.5"
                                : "private-portal-rail-upcoming relative z-10 mt-0.5"
                        }
                      >
                        {s.state === "done" ? (
                          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                            <path
                              d="M2 6.2l2.6 2.6L10 3.4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          s.number
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={`text-sm font-medium ${
                                s.state === "current"
                                  ? "private-portal-title"
                                  : s.state === "done"
                                    ? "text-slate-200"
                                    : isNext
                                      ? "text-slate-200"
                                      : "text-slate-400"
                              }`}
                            >
                              {s.label}
                            </p>
                            {s.state === "done" ? (
                              <p className="mt-0.5 text-xs font-medium text-emerald-400">Completed</p>
                            ) : s.state === "current" ? (
                              <p className="mt-0.5 text-xs font-medium text-brand-300">In progress</p>
                            ) : isNext ? (
                              <p className="mt-0.5 text-xs font-medium text-violet-300">Up next</p>
                            ) : s.key === "council_approved" ? (
                              <p className="mt-0.5 text-xs text-slate-500">Final milestone</p>
                            ) : (
                              <p className="mt-0.5 text-xs text-slate-500">Upcoming</p>
                            )}
                            {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
                          </div>
                          {s.state === "current" && project.stageStartedAt ? (
                            <p className="shrink-0 pt-0.5 text-xs text-slate-500">
                              Started {formatDate(project.stageStartedAt)}
                            </p>
                          ) : isNext ? (
                            <p className="shrink-0 pt-0.5 text-xs text-slate-500">
                              {project.dueDate ? formatDate(project.dueDate) : "Date to be confirmed"}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
                Construction follows as a separate phase.
              </p>
            </section>

            <div className="space-y-5">
              <section className="private-portal-required rounded-2xl p-5 sm:p-6">
                <h2 className="private-portal-title text-lg font-semibold">Required from you</h2>
                <p className="mt-1 text-sm text-slate-500">Actions and information we need from you.</p>

                {actionItems.length > 0 ? (
                  <ul className="mt-5 space-y-2">
                    {actionItems.map((item) => (
                      <li
                        key={item.id}
                        className={`rounded-xl bg-amber-500/[0.06] px-3 py-2.5 ring-1 ring-amber-500/20 ${
                          completing === item.id ? "ring-emerald-500/30" : ""
                        }`}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <PlannerDoneToggle
                            checked={false}
                            disabled={completing === item.id}
                            title={`Mark "${item.title}" as done`}
                            onCompletingStart={() => setCompleting(item.id)}
                            onToggle={(checked) => {
                              if (checked) void completeAction(item.id);
                            }}
                          />
                          <span className="min-w-0 flex-1 text-sm leading-snug text-amber-50">{item.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-8 flex flex-col items-center px-4 pb-4 pt-2 text-center">
                    <span className="private-portal-required-icon" aria-hidden>
                      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </span>
                    <p className="private-portal-title mt-4 text-sm font-semibold">
                      Client actions to be confirmed
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Requests and due dates will appear here.</p>
                  </div>
                )}
                {project.outOfScopeFlag ? (
                  <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-100 ring-1 ring-rose-500/25">
                    Out-of-scope work has been flagged. Blocharch will confirm details with you separately.
                  </p>
                ) : null}
              </section>

              <section className="client-portal-card rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
                <h2 className="private-portal-title text-lg font-semibold">Recent updates</h2>
                <p className="mt-1 text-sm text-slate-500">The latest activity on your project.</p>
                <ul className="mt-5 space-y-4">
                  {updates.length === 0 ? (
                    <li className="text-sm text-slate-500">No updates yet.</li>
                  ) : (
                    updates.map((u, i) => (
                      <li key={`${u.occurredAt}-${i}`} className="flex gap-3">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${updateDots[i % updateDots.length]}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="private-portal-title text-sm font-medium">{u.title}</p>
                            <span className="shrink-0 text-xs text-slate-500">{formatDate(u.occurredAt)}</span>
                          </div>
                          {u.body ? (
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{u.body}</p>
                          ) : null}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {completedActionItems.length > 0 ? (
                <details
                  ref={completedDetailsRef}
                  className="client-portal-card group rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.08]">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 12 12" aria-hidden>
                        <path d="M3.2 1.6v8.8L10.4 6 3.2 1.6z" />
                      </svg>
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-400/30">
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                        <path
                          d="M2 6.2l2.6 2.6L10 3.4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="private-portal-title min-w-0 flex-1 text-sm font-medium">
                      Completed actions ({completedActionItems.length})
                    </span>
                    <svg
                      className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.8}
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </summary>
                  <ul className="space-y-2 border-t border-white/[0.06] px-5 py-4">
                    {completedActionItems.map((item) => {
                      const isNew = recentlyCompleted.has(item.id);
                      return (
                        <li
                          key={item.id}
                          className={`flex items-start justify-between gap-3 text-sm ${
                            isNew ? "rounded-lg bg-emerald-500/10 px-2 py-1 ring-1 ring-emerald-500/20" : ""
                          }`}
                        >
                          <span className="text-slate-400 line-through decoration-slate-600">{item.title}</span>
                          <span className="shrink-0 text-xs text-slate-500">{formatDate(item.completedAt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>

          {documents.length > 0 ? (
            <section className="client-portal-card mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
              <h2 className="private-portal-title text-lg font-semibold">Documents</h2>
              <ul className="mt-4 space-y-2">
                {documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06] hover:bg-white/[0.05] hover:text-brand-200"
                    >
                      <span>{d.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">Open</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="client-portal-footer mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] py-5 text-[11px] text-slate-600">
            <span>Your project, updated as we progress.</span>
            <span>Blocharch. Private Client Portal</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
