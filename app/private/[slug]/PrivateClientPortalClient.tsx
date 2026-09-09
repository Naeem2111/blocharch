"use client";

import { useRef, useState } from "react";
import { ClientPortalBrandMark } from "@/components/client-portal/ClientPortalBrandMark";
import { PublicThemeToggle } from "@/components/client-portal/PublicThemeToggle";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { ProjectStageStepper } from "@/components/private/ProjectStageStepper";
import { PlannerDoneToggle } from "@/components/planner/PlannerDoneToggle";
import { buildPrivateStageSteps } from "@/lib/private-constants";

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

function currentStageLine(project: PortalData["project"]): string {
  const parts = [`Currently in ${project.designStageLabel.toLowerCase()}`];
  if (project.councilSubmittedAt) {
    parts.push(`submitted ${formatDate(project.councilSubmittedAt)}`);
  }
  if (project.designStage === "council_review") {
    parts.push("typically 6–8 weeks");
  } else if (project.stageMeta.typicalDays) {
    parts.push(`typically ${project.stageMeta.typicalDays} days`);
  }
  return `${parts.join(" · ")}.`;
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

  function markRecentlyCompleted(id: string) {
    setRecentlyCompleted((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setRecentlyCompleted((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
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

  const timeline = [
    { label: "Brief received", value: formatDate(project.briefReceivedAt) },
    { label: "Council submitted", value: formatDate(project.councilSubmittedAt) },
    ...(project.estCouncilDecision
      ? [{ label: "Est. council decision", value: project.estCouncilDecision }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-slate-100">
      <header className="client-portal-header border-b border-white/[0.06] px-4 py-5 sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <ClientPortalBrandMark />
          <PublicThemeToggle />
        </div>
      </header>

      <div className="client-portal-main min-h-screen px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-400">
            Your project
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {project.address}
          </h1>
          {project.clientDescription ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
              {project.clientDescription}
            </p>
          ) : null}

          {(project.briefReceivedAt || project.dueDate || project.councilSubmittedAt) ? (
            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              {project.briefReceivedAt ? (
                <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Brief received
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">{formatDate(project.briefReceivedAt)}</dd>
                </div>
              ) : null}
              {project.dueDate ? (
                <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Target completion
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">{formatDate(project.dueDate)}</dd>
                </div>
              ) : null}
              {project.councilSubmittedAt ? (
                <div className="rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Council submitted
                  </dt>
                  <dd className="mt-1 text-sm text-slate-200">
                    {formatDate(project.councilSubmittedAt)}
                    {project.estCouncilDecision ? ` · decision ~ ${project.estCouncilDecision}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <section className="client-portal-card mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Overall progress
            </p>
            <p className="mt-3 text-5xl font-semibold tabular-nums text-white">{project.progressPercent}%</p>
            <ProjectProgressBar
              percent={project.progressPercent}
              showLabel={false}
              className="mt-4 max-w-md"
            />
            <p className="mt-3 text-sm text-slate-400">{currentStageLine(project)}</p>

            {project.quietExplanation ? (
              <div className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Why this hasn&apos;t moved much this week
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{project.quietExplanation}</p>
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
                      className={`flex items-start gap-3 rounded-lg bg-amber-500/5 px-3 py-2.5 ring-1 ring-amber-500/15 transition-shadow duration-200 ${
                        completing === item.id ? "ring-emerald-500/30 shadow-[0_0_0_2px_rgb(34_197_94_/_0.28)]" : ""
                      }`}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <PlannerDoneToggle
                          checked={false}
                          disabled={completing === item.id}
                          title={`Mark "${item.title}" as done`}
                          onCompletingStart={() => setCompleting(item.id)}
                          onToggle={(next) => {
                            if (next) void completeAction(item.id);
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-amber-200/60">
                            Item {index + 1}
                          </span>
                          <span className="mt-0.5 block text-sm leading-snug text-amber-50">{item.title}</span>
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
              <details
                ref={completedDetailsRef}
                className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]"
              >
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200">
                  Completed actions ({completedActionItems.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {completedActionItems.map((item) => {
                    const isNew = recentlyCompleted.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className={`flex items-start justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 text-sm transition-colors duration-300 ${
                          isNew ? "bg-emerald-500/10 ring-1 ring-emerald-500/20" : ""
                        }`}
                      >
                        <span className="flex min-w-0 items-start gap-2 text-slate-400">
                          <span
                            className={`planner-done-toggle mt-0.5 shrink-0 planner-done-toggle-checked ${
                              isNew ? "planner-done-toggle-animating" : ""
                            }`}
                            aria-hidden
                          >
                            <svg viewBox="0 0 12 12" className="planner-done-check planner-done-check-visible" aria-hidden>
                              <path
                                className="planner-done-check-path"
                                d="M2 6l3 3 5-5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span className="line-through decoration-slate-600">{item.title}</span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">{formatDate(item.completedAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            ) : null}

            {project.outOfScopeFlag ? (
              <div className="mt-5 rounded-xl bg-rose-500/10 p-4 ring-1 ring-rose-500/25">
                <p className="text-sm text-rose-100">
                  Out-of-scope work has been flagged on this project. Blocharch will confirm details with you
                  separately.
                </p>
              </div>
            ) : null}

            <div className="mt-6 border-t border-white/[0.06] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timeline</p>
              <dl className="mt-3 space-y-2 text-sm">
                {timeline.map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="shrink-0 tabular-nums text-slate-200">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
            <section>
              <h2 className="text-sm font-semibold text-white">Where you are in the process</h2>
              <p className="mt-1 text-xs text-slate-500 lg:hidden">Full process</p>
              <div className="mt-4">
                <ProjectStageStepper stages={stages} />
              </div>
            </section>

            <section>
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
                      <div>
                        <p className="text-slate-200">{u.title}</p>
                        {u.body ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{u.body}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-slate-500">{formatDate(u.occurredAt)}</span>
                    </li>
                  ))
                )}
              </ul>
              <p className="mt-4 text-xs text-slate-600">Last updated {formatDate(project.updatedAt)}</p>
            </section>
          </div>

          {documents.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-white">Documents</h2>
              <ul className="mt-4 space-y-2">
                {documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-4 py-3 text-sm text-slate-200 ring-1 ring-white/[0.06] hover:bg-white/[0.05] hover:text-brand-200"
                    >
                      <span>{d.title}</span>
                      <span className="shrink-0 text-xs text-slate-500">Open</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
