"use client";

import { useMemo, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { AthleteAvatar } from "@/components/ops/AthleteAvatar";
import { MiniMonthCalendar } from "@/components/MiniMonthCalendar";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { asAvatarTextTone } from "@/lib/avatar-text-tone";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";
import type { PublicClientPortalData } from "@/lib/public-client-portal";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function ClientPortalClient({ data }: { data: PublicClientPortalData }) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const dueMarks = useMemo(
    () =>
      data.projects
        .filter((p) => p.dueDate)
        .map((p) => ({
          date: p.dueDate!,
          label: `${p.name} due`,
          color: projectDueColor(daysUntilDueFromIso(p.dueDate)),
        })),
    [data.projects]
  );

  const openTaskCount = data.projects.reduce((n, p) => n + p.openTasks.length, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <ClientAvatar
            name={data.client.name}
            logoUrl={data.client.logoUrl}
            backgroundColor={data.client.logoBgColor}
            textTone={asAvatarTextTone(data.client.logoTextTone)}
            size={52}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Blocharch client portal</p>
            <h1 className="text-2xl font-semibold text-white">{data.client.name}</h1>
            <p className="mt-1 text-sm text-slate-400">Active projects and open tasks</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-300">
            Active lanes {data.client.activeLaneCount}
          </span>
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-200">
            {data.projects.length} project{data.projects.length === 1 ? "" : "s"} · {openTaskCount} open task
            {openTaskCount === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <section className="card-tool rounded-2xl p-4 ring-1 ring-white/[0.06]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project due dates</h2>
          <div className="mt-3">
            <MiniMonthCalendar
              month={calendarMonth}
              marks={dueMarks}
              onSelectDate={(date) => setCalendarMonth(date.slice(0, 7))}
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-white">Active projects</h2>
          {data.projects.length === 0 ? (
            <p className="text-sm text-slate-500">No active projects right now.</p>
          ) : (
            data.projects.map((project) => {
              const timeline = computeProjectTimeline({
                startDate: project.startDate,
                dueDate: project.dueDate,
              });
              const accent = projectDueColor(daysUntilDueFromIso(project.dueDate));

              return (
                <article
                  key={project.id}
                  className="card-tool rounded-2xl p-5 ring-1 ring-white/[0.06]"
                  style={{ borderLeftWidth: 4, borderLeftColor: accent }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      {project.address ? <p className="text-sm text-slate-400">{project.address}</p> : null}
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ backgroundColor: `${project.statusBadge.color}22`, color: project.statusBadge.color }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: project.statusBadge.color }}
                      />
                      {project.statusBadge.label}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Stage: {project.currentStageLabel}
                    {project.dueDate ? ` · Due ${formatShortDate(project.dueDate)}` : ""}
                    {timeline.label ? ` · ${timeline.label}` : ""}
                  </p>

                  <div className="mt-4 max-w-md">
                    <ProjectProgressBar percent={project.progressPercent} />
                  </div>

                  {project.leadName ? (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Your lead
                      </span>
                      <AthleteAvatar
                        name={project.leadName}
                        photoUrl={project.leadPhotoUrl}
                        backgroundColor={project.leadPhotoBgColor}
                        textTone={asAvatarTextTone(project.leadPhotoTextTone)}
                        size={24}
                      />
                      <span className="text-sm text-slate-300">{project.leadName}</span>
                    </div>
                  ) : null}

                  {project.openTasks.length > 0 ? (
                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Open tasks ({project.openTasks.length})
                      </p>
                      <ul className="mt-2 space-y-2">
                        {project.openTasks.map((task) => (
                          <li
                            key={task.id}
                            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-100">{task.title}</p>
                              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                {task.columnTitle}
                              </span>
                            </div>
                            {task.summary ? (
                              <p className="mt-1 text-xs text-slate-400 line-clamp-2">{task.summary}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {task.dueAt ? (
                                <span className="text-[11px] text-slate-500">
                                  Due {formatShortDate(task.dueAt.slice(0, 10))}
                                </span>
                              ) : null}
                              {task.labels.map((label) => (
                                <span
                                  key={label.name}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset"
                                  style={{
                                    color: label.color,
                                    backgroundColor: `${label.color}18`,
                                    borderColor: `${label.color}40`,
                                  }}
                                >
                                  {label.name}
                                </span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">No open kanban tasks on this project.</p>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>

      <footer className="border-t border-white/[0.06] pt-6 text-center text-xs text-slate-600">
        Powered by Blocharch · Read-only project tracker
      </footer>
    </div>
  );
}
