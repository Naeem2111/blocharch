"use client";

import { PRIVATE_STAGE_DONE_COPY } from "@/lib/private-constants";

type PortalData = NonNullable<
  Awaited<ReturnType<typeof import("@/lib/private-public-portal").getPublicPrivateProjectBySlug>>
>;

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

export function PrivateClientPortalClient({ data }: { data: PortalData }) {
  const { project, stages, actionItems, updates } = data;
  const current = stages.find((s) => s.state === "current");

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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
                  Action needed from you
                </p>
                <ul className="mt-2 space-y-1">
                  {actionItems.map((title) => (
                    <li key={title} className="text-sm text-amber-50">
                      {title}
                    </li>
                  ))}
                </ul>
              </div>
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
