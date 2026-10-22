"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { DueDateCalendar } from "@/components/ops/DueDateCalendar";
import { OpsProjectCardFrame } from "@/components/ops/OpsProjectCard";
import { PrivateProjectDocuments } from "@/components/private/PrivateProjectDocuments";
import { ClientPortalAthleteMark } from "@/components/client-portal/ClientPortalAthleteMark";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { formatHoursCompact } from "@/lib/ops-project-hours";
import { clientMetaFromNestedClient, groupProjectsByClient } from "@/lib/ops-project-groups";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";

type AssignedAthlete = {
  id?: string;
  fullName: string;
  initials: string;
  isPrimary?: boolean;
};

type ProjectRow = {
  id: string;
  name: string;
  address: string | null;
  projectTypeLabel: string;
  designStageLabel: string;
  progressPercent: number;
  status: string;
  completedAt: string | null;
  briefReceivedAt: string | null;
  stageStartedAt: string;
  dueDate: string | null;
  hoursLifeToDate: number | null;
  client: { id: string; name: string };
  athlete: AssignedAthlete | null;
  athletes?: AssignedAthlete[];
};

function projectAthletes(project: ProjectRow): AssignedAthlete[] {
  if (project.athletes && project.athletes.length > 0) return project.athletes;
  return project.athlete ? [project.athlete] : [];
}

function formatAssignedAthletes(athletes: AssignedAthlete[]) {
  if (athletes.length === 0) return "Unassigned";
  return athletes.map((athlete) => (athlete.isPrimary ? `${athlete.fullName} (primary)` : athlete.fullName)).join(", ");
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusPresentation(status: string): { label: string; color: string } {
  if (status === "completed") return { label: "Completed", color: "#22c55e" };
  if (status === "on_hold") return { label: "On hold", color: "#eab308" };
  return { label: "Active", color: "#38bdf8" };
}

export function AthletePrivateProjectsClient({ scope }: { scope: "active" | "completed" }) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [clientFilterId, setClientFilterId] = useState("");
  const completed = scope === "completed";

  const load = useCallback(async () => {
    const response = await fetch(`/api/athlete/private/projects?scope=${scope}`);
    const body = await response.json();
    if (response.ok) setProjects(body.projects || []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientOptions = useMemo(() => {
    const map = new Map<string, ProjectRow["client"]>();
    for (const project of projects) {
      if (!map.has(project.client.id)) map.set(project.client.id, project.client);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (!clientFilterId) return projects;
    return projects.filter((project) => project.client.id === clientFilterId);
  }, [projects, clientFilterId]);

  const projectsByClient = useMemo(
    () => groupProjectsByClient(filteredProjects, (project) => clientMetaFromNestedClient(project.client)),
    [filteredProjects],
  );

  const calendarProjects = useMemo(
    () =>
      filteredProjects
        .filter((project) => project.dueDate)
        .map((project) => ({
          id: project.id,
          name: project.name,
          clientName: project.client.name,
          dueDate: project.dueDate!,
          progressPercent: project.progressPercent,
          assignedAthleteName: project.athlete?.fullName ?? project.athletes?.[0]?.fullName ?? null,
        })),
    [filteredProjects],
  );

  const selectedFilterClient = clientOptions.find((client) => client.id === clientFilterId) ?? null;

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-6">
      {completed ? null : (
        <div className="card-tool rounded-xl p-5 md:p-6">
          <h2 className="text-base font-semibold text-white">Due date calendar</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Active projects with due dates — browse by month. Respects the client filter below.
          </p>
          <div className="mt-5">
            <label className="mb-4 block text-xs text-slate-400">
              Calendar month
              <input
                type="month"
                value={calendarMonth}
                onChange={(event) => setCalendarMonth(event.target.value)}
                className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>
            <DueDateCalendar month={calendarMonth} projects={calendarProjects} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <p className="pb-2 text-sm text-slate-400">
            {filteredProjects.length} project{filteredProjects.length === 1 ? "" : "s"}
            {clientFilterId
              ? ` for ${selectedFilterClient?.name ?? "client"}`
              : clientOptions.length > 0
                ? ` · ${projectsByClient.length} client${projectsByClient.length === 1 ? "" : "s"}`
                : ""}
          </p>
          {clientOptions.length > 0 ? (
            <label className="text-xs text-slate-400">
              Client
              <select
                value={clientFilterId}
                onChange={(event) => setClientFilterId(event.target.value)}
                className="select-console mt-1 block min-w-[14rem] rounded-md px-3 py-2 text-sm"
              >
                <option value="">All clients</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="space-y-8">
          {projectsByClient.map((group) => (
            <section key={group.clientId} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] pb-2">
                <ClientAvatar name={group.clientName} size={36} />
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.clientName}</h2>
                  <p className="text-xs text-slate-500">
                    {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {group.projects.map((project) => {
                  const athletes = projectAthletes(project);
                  const status = statusPresentation(project.status);
                  const startDate = project.briefReceivedAt || project.stageStartedAt;
                  const timeline = computeProjectTimeline({ startDate, dueDate: project.dueDate });
                  const accent = projectDueColor(daysUntilDueFromIso(project.dueDate));
                  return (
                    <OpsProjectCardFrame key={project.id} dueDate={project.dueDate}>
                      <div className="pl-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white">{project.name}</h3>
                            {project.address && project.address !== project.name ? (
                              <p className="mt-0.5 text-xs text-slate-500">{project.address}</p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: `${status.color}22`,
                                color: status.color,
                                borderColor: `${status.color}44`,
                              }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                              {status.label}
                            </span>
                            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {project.projectTypeLabel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span>
                              Stage <span className="text-slate-300">{project.designStageLabel}</span>
                            </span>
                            {timeline.daysActive != null ? (
                              <>
                                <span className="text-slate-600">·</span>
                                <span>{timeline.daysActive} days active</span>
                              </>
                            ) : null}
                          </div>
                          <p className="text-center text-xs tabular-nums text-slate-400">
                            {completed && project.completedAt ? (
                              <span>Completed {formatShortDate(project.completedAt)}</span>
                            ) : startDate || project.dueDate ? (
                              <>
                                {startDate ? formatShortDate(startDate) : "TBC"}
                                {" — "}
                                <span className="font-semibold" style={{ color: accent }}>
                                  {project.dueDate ? formatShortDate(project.dueDate) : "TBC"}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-500">Dates to be confirmed</span>
                            )}
                          </p>
                          <span className="hidden sm:block" aria-hidden />
                        </div>

                        <div className="mt-3 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <ProjectProgressBar percent={project.progressPercent} showLabel={false} />
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">{project.progressPercent}%</span>
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                          {athletes.length === 0 ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              Athlete to be assigned
                            </span>
                          ) : (
                            <div className="min-w-0">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                                <ClientPortalAthleteMark />
                                Athlete assigned
                              </span>
                              <div className="mt-1.5 flex min-w-0 items-center gap-2">
                                <div className="flex shrink-0 -space-x-1.5">
                                  {athletes.slice(0, 4).map((athlete, index) => (
                                    <span
                                      key={athlete.id ?? `${athlete.fullName}-${index}`}
                                      title={athlete.fullName}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[#0f131a] ${
                                        athlete.isPrimary || index === 0
                                          ? "bg-sky-500/25 text-sky-200"
                                          : "bg-white/[0.08] text-slate-300"
                                      }`}
                                    >
                                      {athlete.initials}
                                    </span>
                                  ))}
                                </div>
                                <p className="min-w-0 truncate text-xs text-slate-400">{formatAssignedAthletes(athletes)}</p>
                              </div>
                            </div>
                          )}
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hours to date</p>
                            <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                              {formatHoursCompact(project.hoursLifeToDate ?? 0)}h
                            </p>
                          </div>
                        </div>
                      </div>
                      {completed ? null : (
                        <div className="mt-4 border-t border-white/[0.06] pt-4">
                          <PrivateProjectDocuments projectId={project.id} variant="athlete" />
                        </div>
                      )}
                    </OpsProjectCardFrame>
                  );
                })}
              </div>
            </section>
          ))}
          {filteredProjects.length === 0 ? (
            <p className="text-sm text-slate-500">
              {clientFilterId
                ? "No projects for this client."
                : completed
                  ? "No completed private projects assigned to you."
                  : "No private projects assigned yet."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
