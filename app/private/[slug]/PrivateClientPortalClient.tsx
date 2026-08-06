"use client";

import { useState } from "react";
import { PRIVATE_STAGE_DONE_COPY } from "@/lib/private-constants";

type PortalData = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/private-public-portal").getPublicPrivateProjectBySlug>>
>;

type ActionItem = { id: string; title: string };
type CompletedActionItem = { id: string; title: string; completedAt: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PrivateClientPortalClient({
  slug,
  data,
}: {
  slug: string;
  data: PortalData;
}) {
  const { project, stages, updates } = data;
  const [actionItems, setActionItems] = useState<ActionItem[]>(data.actionItems);
  const [completedActionItems, setCompletedActionItems] = useState<CompletedActionItem[]>(
    data.completedActionItems,
  );
  const [completing, setCompleting] = useState<string | null>(null);
  const current = stages.find((s) => s.state === "current");

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
    } finally {
      setCompleting(null);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-slate-100">
      <div className="app-main min-h-screen px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Your project
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {project.address}
          </h1>

          <section className="mt-8 card-tool rounded-2xl p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Overall progress
            </p>
            <p className="mt-3 text-5xl font-semibold tabular-nums text-white">
              {project.progressPercent}%
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Currently in {project.designStageLabel}
              {project.councilSubmittedAt
                ? ` · submitted ${formatDate(project.councilSubmittedAt)}`
                : ""}
              {project.stageMeta.typicalDays
                ? ` · typically ${
                    project.designStage === "council_review" ? "6–8 weeks" : `${project.stageMeta.typicalDays} days`
                  }`
                : ""}
              .
            </p>

            {project.quietExplanation ? (
              <div className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Why this hasn&apos;t moved much this week
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {project.quietExplanation}
                </p>
              </div>
            ) : null}

            {actionItems.length > 0 ? (
              <div className="mt-5 rounded-xl bg-amber-500/10 p-4 ring-1 ring-amber-500/25">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                    Action needed from you
                  </p>
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-100">
                    {actionItems.length}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {actionItems.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg bg-amber-500/5 px-3 py-2.5 ring-1 ring-amber-500/15"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled={completing === item.id}
                          onChange={() => void completeAction(item.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400/40 bg-transparent accent-amber-400"
                          aria-label={`Mark "${item.title}" as done`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-amber-200/60">
                            Item {index + 1}
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-amber-50">
                            {item.title}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-amber-200/50">
                  Tick each item when you&apos;ve completed it — it will disappear from this list.
                </p>
              </div>
            ) : null}

            {completedActionItems.length > 0 ? (
              <details className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200">
                  Completed actions ({completedActionItems.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {completedActionItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-start gap-2 text-slate-400">
                        <span className="mt-0.5 text-emerald-400" aria-hidden>
                          ✓
                        </span>
                        <span className="line-through decoration-slate-600">{item.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        {formatDate(item.completedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            {project.outOfScopeFlag ? (
              <div className="mt-5 rounded-xl bg-rose-500/10 p-4 ring-1 ring-rose-500/25">
                <p className="text-sm text-rose-100">
                  Out-of-scope work has been flagged on this project. Blocharch will confirm details
                  with you separately.
                </p>
              </div>
            ) : null}

            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Brief received</dt>
                <dd className="mt-1 text-sm text-slate-200">{formatDate(project.briefReceivedAt)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Council submitted</dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {formatDate(project.councilSubmittedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                  Est. council decision
                </dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {project.estCouncilDecision ?? "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-white">Where you are in the process</h2>
            <ol className="mt-4 space-y-2">
              {stages.map((s) => (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2 text-sm ${
                    s.state === "current"
                      ? "bg-brand-500/10 ring-1 ring-brand-500/25"
                      : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      s.state === "done"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : s.state === "current"
                          ? "bg-brand-500/30 text-brand-200"
                          : "bg-white/[0.06] text-slate-500"
                    }`}
                  >
                    {s.state === "done" ? "✓" : s.number}
                  </span>
                  <div>
                    <p
                      className={
                        s.state === "upcoming"
                          ? "text-slate-500"
                          : s.state === "current"
                            ? "font-medium text-brand-100"
                            : "text-slate-300"
                      }
                    >
                      {s.label}
                      {s.state === "current" ? (
                        <span className="ml-2 text-xs font-normal text-brand-300">
                          You are here
                        </span>
                      ) : null}
                    </p>
                    {s.state === "current" && s.key === "council_approved" ? (
                      <p className="mt-1 text-xs text-slate-400">{PRIVATE_STAGE_DONE_COPY}</p>
                    ) : null}
                    {s.key === "council_approved" && current?.key === "council_review" ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Design approved — construction is the next, separate phase
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {project.doneCopy ? (
              <p className="mt-3 text-sm text-slate-400">{project.doneCopy}</p>
            ) : project.designStage !== "council_approved" ? (
              <p className="mt-3 text-xs text-slate-500">
                Design approved — construction is the next, separate phase
              </p>
            ) : null}
          </section>

          <section className="mt-10">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">Recent updates</h2>
              {updates.length > 0 ? (
                <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-300">
                  New
                </span>
              ) : null}
            </div>
            <ul className="mt-4 space-y-3">
              {updates.length === 0 ? (
                <li className="text-sm text-slate-500">No updates yet.</li>
              ) : (
                updates.map((u, i) => (
                  <li
                    key={`${u.occurredAt}-${i}`}
                    className="flex justify-between gap-4 border-b border-white/[0.05] pb-3 text-sm"
                  >
                    <span className="text-slate-200">{u.title}</span>
                    <span className="shrink-0 text-slate-500">{formatDate(u.occurredAt)}</span>
                  </li>
                ))
              )}
            </ul>
            <p className="mt-4 text-xs text-slate-600">
              Last updated {formatDate(project.updatedAt)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
