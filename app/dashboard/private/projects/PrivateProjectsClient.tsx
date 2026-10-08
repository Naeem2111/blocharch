"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PrivateDeleteProjectButton } from "@/components/private/PrivateDeleteProjectButton";
import { PRIVATE_STAGE_LABELS, PRIVATE_STAGE_ORDER } from "@/lib/private-constants";

type AssignedAthlete = { initials: string; fullName: string; isPrimary?: boolean };

type ProjectRow = {
  id: string;
  name: string;
  designStage: string;
  designStageLabel: string;
  currentDesignPhaseId?: string | null;
  progressPercent: number;
  completedAt: string | null;
  feeZar: number;
  marginPercent: number | null;
  client: { id: string; name: string };
  athlete: AssignedAthlete | null;
  athletes?: AssignedAthlete[];
  phases?: Array<{ phaseId: string; label: string; stage?: string }>;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function projectAthletes(p: ProjectRow): AssignedAthlete[] {
  if (p.athletes && p.athletes.length > 0) return p.athletes;
  return p.athlete ? [p.athlete] : [];
}

function AthleteAvatars({ athletes }: { athletes: AssignedAthlete[] }) {
  if (athletes.length === 0) return <span className="text-slate-500">—</span>;
  const title = athletes
    .map((a) => (a.isPrimary ? `${a.fullName} (primary)` : a.fullName))
    .join(", ");
  return (
    <div className="flex -space-x-1.5" title={title}>
      {athletes.slice(0, 4).map((a) => (
        <span
          key={`${a.fullName}-${a.initials}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/20 text-[10px] font-bold text-brand-200 ring-2 ring-[#0f131a]"
        >
          {a.initials}
        </span>
      ))}
      {athletes.length > 4 ? (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-slate-300 ring-2 ring-[#0f131a]">
          +{athletes.length - 4}
        </span>
      ) : null}
    </div>
  );
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
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const stageMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!stageOpenId) return;
    function onPointerDown(event: PointerEvent) {
      if (stageMenuRef.current?.contains(event.target as Node)) return;
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
        <div className="grid gap-3 lg:grid-cols-2">
          {projects.map((p) => {
            const athletes = projectAthletes(p);
            return (
              <article
                key={p.id}
                className="client-portal-card relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
              >
                <span
                  className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] rounded-l-xl bg-brand-400"
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{p.client.name}</p>
                    <Link
                      href={`/dashboard/private/projects/${p.id}/edit`}
                      className="mt-1 block truncate text-base font-semibold text-white hover:text-brand-300"
                    >
                      {p.name}
                    </Link>
                  </div>
                  <AthleteAvatars athletes={athletes} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {completed ? (
                    <span className="text-xs text-slate-300">{p.completedAt ?? p.designStageLabel}</span>
                  ) : (
                    <div ref={stageOpenId === p.id ? stageMenuRef : undefined} className="relative">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setStageOpenId(stageOpenId === p.id ? null : p.id)}
                        className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left text-xs text-slate-200 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
                      >
                        {p.designStageLabel} ▾
                      </button>
                      {stageOpenId === p.id ? (
                        <div className="absolute z-20 mt-1 w-64 rounded-lg border border-white/[0.1] bg-[#0f131a] py-1 shadow-xl">
                          {(p.phases && p.phases.length > 0
                            ? p.phases
                            : PRIVATE_STAGE_ORDER.map((key) => ({
                                phaseId: key,
                                label: PRIVATE_STAGE_LABELS[key],
                              }))
                          ).map((row) => {
                            const selected =
                              row.phaseId === p.currentDesignPhaseId ||
                              row.phaseId === p.designStage ||
                              ("stage" in row && row.stage === p.designStage);
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
                      ) : null}
                    </div>
                  )}
                  {!completed ? (
                    <div className="flex min-w-[8rem] flex-1 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${p.progressPercent}%` }} />
                      </div>
                      <span className="tabular-nums text-xs text-slate-400">{p.progressPercent}%</span>
                    </div>
                  ) : null}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3 text-xs">
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Fee</dt>
                    <dd className="mt-0.5 tabular-nums text-slate-200">{zar(p.feeZar)}</dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wide text-slate-500">Margin</dt>
                    <dd className="mt-0.5 tabular-nums text-slate-200">
                      {p.marginPercent != null ? `${p.marginPercent}%` : "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link href={`/dashboard/private/projects/${p.id}`} className="text-xs text-slate-400 hover:text-brand-300">
                    View
                  </Link>
                  <Link href={`/dashboard/private/projects/${p.id}/expenses`} className="text-xs text-brand-300 hover:underline">
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
                    <PrivateDeleteProjectButton projectId={p.id} projectName={p.name} onDeleted={() => void load()} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
