"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClientPortalAthleteMark } from "@/components/client-portal/ClientPortalAthleteMark";
import { ClientAvatar } from "@/components/ops/ClientAvatar";
import { OpsProjectCardFrame } from "@/components/ops/OpsProjectCard";
import { PrivateDeleteProjectButton } from "@/components/private/PrivateDeleteProjectButton";
import { ProjectProgressBar } from "@/components/ProjectProgressBar";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";
import { formatHoursCompact } from "@/lib/ops-project-hours";
import { daysUntilDueFromIso, projectDueColor } from "@/lib/project-color-scale";
import { computeProjectTimeline } from "@/lib/project-timeline";

type AssignedAthlete = { id?: string; initials: string; fullName: string; isPrimary?: boolean };

type ProjectRow = {
  id: string;
  name: string;
  address: string | null;
  projectTypeLabel: string;
  status: string;
  designStage: string;
  designStageLabel: string;
  currentDesignPhaseId?: string | null;
  progressPercent: number;
  completedAt: string | null;
  briefReceivedAt: string | null;
  dueDate: string | null;
  stageStartedAt: string;
  hoursLifeToDate: number | null;
  client: { id: string; name: string };
  athlete: AssignedAthlete | null;
  athletes?: AssignedAthlete[];
  phases?: PhaseOption[];
  phaseGroups?: PhaseGroupOption[];
};

type PhaseOption = { phaseId: string; label: string; stage?: string };
type PhaseGroupOption = { id: string; name: string; stages: PhaseOption[] };

function stageChoices(project: ProjectRow): PhaseGroupOption[] {
  const groups = (project.phaseGroups ?? []).filter((group) => group.stages.length > 0);
  if (groups.length > 0) return groups;
  if (project.phases && project.phases.length > 0) {
    return [{ id: "phases", name: "", stages: project.phases }];
  }
  return [
    {
      id: "builtin",
      name: "",
      stages: PRIVATE_STAGE_ORDER.map((key) => ({
        phaseId: key,
        label: PRIVATE_STAGE_LABELS[key],
      })),
    },
  ];
}

function projectAthletes(p: ProjectRow): AssignedAthlete[] {
  if (p.athletes && p.athletes.length > 0) return p.athletes;
  return p.athlete ? [p.athlete] : [];
}

function formatAssignedAthletes(athletes: AssignedAthlete[]) {
  if (athletes.length === 0) return "Unassigned";
  return athletes.map((a) => (a.isPrimary ? `${a.fullName} (primary)` : a.fullName)).join(", ");
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusPresentation(status: string): { label: string; color: string } {
  if (status === "completed") return { label: "Completed", color: "#22c55e" };
  if (status === "on_hold") return { label: "On hold", color: "#eab308" };
  return { label: "Active", color: "#38bdf8" };
}

export function PrivateProjectsClient({
  canDelete = false,
  scope = "active",
}: {
  canDelete?: boolean;
  scope?: "active" | "completed";
}) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stageOpenId, setStageOpenId] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stageMenuRef = useRef<HTMLDivElement>(null);
  const stageTriggerRef = useRef<HTMLButtonElement>(null);
  const completed = scope === "completed";

  const load = useCallback(async () => {
    const r = await fetch(`/api/private/projects?scope=${scope}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setProjects(j.projects || []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    if (!stageOpenId) {
      setMenuBox(null);
      return;
    }
    function place() {
      const trigger = stageTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const width = 256;
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;
      const openBelow = spaceBelow >= 180 || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(140, Math.min(360, openBelow ? spaceBelow : spaceAbove));
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
      setMenuBox({
        left,
        maxHeight,
        top: openBelow ? rect.bottom + 4 : Math.max(margin, rect.top - maxHeight - 4),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [stageOpenId]);

  useEffect(() => {
    if (!stageOpenId) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (stageMenuRef.current?.contains(target)) return;
      if (stageTriggerRef.current?.contains(target)) return;
      setStageOpenId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setStageOpenId(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [stageOpenId]);

  async function setStage(projectId: string, phaseId: string) {
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentDesignPhaseId: phaseId }),
    });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) {
      setError(j.error || "Could not update phase");
      return;
    }
    setStageOpenId(null);
    void load();
  }

  async function reactivate(project: { id: string; name: string }) {
    if (
      !confirm(
        `Bring “${project.name}” back to active projects from archives? Progress will be set to 85%.`,
      )
    ) {
      return;
    }
    setReactivatingId(project.id);
    setError("");
    const r = await fetch(`/api/private/projects/${project.id}/reactivate`, {
      method: "POST",
    });
    const j = await r.json().catch(() => ({}));
    setReactivatingId(null);
    if (!r.ok) {
      setError(j.error || "Could not reactivate");
      return;
    }
    void load();
  }

  const projectsByClient = useMemo(() => {
    const groups = new Map<string, { clientId: string; clientName: string; projects: ProjectRow[] }>();
    for (const project of projects) {
      const existing = groups.get(project.client.id);
      if (existing) existing.projects.push(project);
      else {
        groups.set(project.client.id, {
          clientId: project.client.id,
          clientName: project.client.name,
          projects: [project],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [projects]);

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {projects.length === 0 ? (
        <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-sm text-slate-500">
          {completed ? (
            "No archived private projects yet."
          ) : (
            <>
              No active private projects.{" "}
              <Link href="/dashboard/private/onboarding" className="text-brand-300 hover:underline">
                Onboard one
              </Link>
            </>
          )}
        </p>
      ) : (
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
                {group.projects.map((p) => {
                  const athletes = projectAthletes(p);
                  const status = statusPresentation(p.status);
                  const startDate = p.briefReceivedAt || p.stageStartedAt;
                  const timeline = computeProjectTimeline({ startDate, dueDate: p.dueDate });
                  const accent = projectDueColor(daysUntilDueFromIso(p.dueDate));
                  return (
                    <OpsProjectCardFrame key={p.id} dueDate={p.dueDate}>
                      <div className="pl-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/private/projects/${p.id}`}
                              className="font-semibold text-white hover:text-brand-200"
                            >
                              {p.name}
                            </Link>
                            {p.address && p.address !== p.name ? (
                              <p className="mt-0.5 text-xs text-slate-500">{p.address}</p>
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
                              {p.projectTypeLabel}
                            </span>
                            <Link
                              href={`/dashboard/private/projects/${p.id}/edit`}
                              className="text-xs font-medium text-brand-300 hover:text-brand-200"
                            >
                              Edit
                            </Link>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
                          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
                            {completed ? (
                              <span className="text-slate-300">{p.completedAt ?? p.designStageLabel}</span>
                            ) : (
                              <button
                                type="button"
                                ref={stageOpenId === p.id ? stageTriggerRef : undefined}
                                disabled={saving}
                                onClick={() => setStageOpenId(stageOpenId === p.id ? null : p.id)}
                                className="text-left hover:text-slate-200"
                              >
                                Stage <span className="text-slate-300">{p.designStageLabel}</span> ▾
                              </button>
                            )}
                            {timeline.daysActive != null ? (
                              <>
                                <span className="text-slate-600">·</span>
                                <span>{timeline.daysActive} days active</span>
                              </>
                            ) : null}
                            {stageOpenId === p.id && menuBox
                              ? createPortal(
                                  <div
                                    ref={stageMenuRef}
                                    style={{ top: menuBox.top, left: menuBox.left, maxHeight: menuBox.maxHeight }}
                                    className="fixed z-[80] w-64 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#0f131a] py-1 shadow-xl"
                                  >
                                    {stageChoices(p).map((stageGroup) => (
                                      <div key={stageGroup.id}>
                                        {stageGroup.name ? (
                                          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            {stageGroup.name}
                                          </p>
                                        ) : null}
                                        {stageGroup.stages.map((row) => {
                                          const selected = p.currentDesignPhaseId
                                            ? row.phaseId === p.currentDesignPhaseId
                                            : row.phaseId === p.designStage || row.stage === p.designStage;
                                          return (
                                            <button
                                              key={row.phaseId}
                                              type="button"
                                              className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/[0.06] ${
                                                selected ? "text-brand-300" : "text-slate-300"
                                              }`}
                                              onClick={() => void setStage(p.id, row.phaseId)}
                                            >
                                              {selected ? "✓ " : ""}
                                              {row.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>,
                                  document.body,
                                )
                              : null}
                          </div>
                          <p className="text-center text-xs tabular-nums text-slate-400">
                            {startDate || p.dueDate ? (
                              <>
                                {startDate ? formatShortDate(startDate) : "TBC"}
                                {" — "}
                                <span className="font-semibold" style={{ color: accent }}>
                                  {p.dueDate ? formatShortDate(p.dueDate) : "TBC"}
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
                            <ProjectProgressBar percent={p.progressPercent} showLabel={false} />
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-slate-400">{p.progressPercent}%</span>
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
                                  {athletes.slice(0, 4).map((a, i) => (
                                    <span
                                      key={a.id ?? `${a.fullName}-${a.initials}`}
                                      title={a.fullName}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-[#0f131a] ${
                                        a.isPrimary || i === 0
                                          ? "bg-sky-500/25 text-sky-200"
                                          : "bg-white/[0.08] text-slate-300"
                                      }`}
                                    >
                                      {a.initials}
                                    </span>
                                  ))}
                                </div>
                                <p className="min-w-0 truncate text-xs text-slate-400">{formatAssignedAthletes(athletes)}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <Link
                                href={`/dashboard/private/projects/${p.id}/expenses`}
                                className="text-xs text-brand-300 hover:underline"
                              >
                                Expenses
                              </Link>
                              {completed && canDelete ? (
                                <button
                                  type="button"
                                  disabled={reactivatingId === p.id}
                                  onClick={() => void reactivate(p)}
                                  className="text-xs text-emerald-300/90 hover:text-emerald-200 disabled:opacity-50"
                                >
                                  {reactivatingId === p.id ? "Moving…" : "Bring back to active"}
                                </button>
                              ) : null}
                              {canDelete ? (
                                <PrivateDeleteProjectButton
                                  projectId={p.id}
                                  projectName={p.name}
                                  onDeleted={() => void load()}
                                />
                              ) : null}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Hours to date / total
                              </p>
                              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
                                {formatHoursCompact(p.hoursLifeToDate ?? 0)}h
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </OpsProjectCardFrame>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
