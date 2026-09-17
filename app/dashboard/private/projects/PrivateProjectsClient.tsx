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
  progressPercent: number;
  completedAt: string | null;
  feeZar: number;
  marginPercent: number | null;
  client: { id: string; name: string };
  athlete: AssignedAthlete | null;
  athletes?: AssignedAthlete[];
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

const tabClass = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors ${
    active
      ? "bg-brand-500/20 text-brand-200 ring-brand-500/30"
      : "bg-white/[0.04] text-slate-400 ring-white/[0.08] hover:bg-white/[0.07]"
  }`;

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

  async function setStage(projectId: string, designStage: string) {
    setSaving(true);
    setError("");
    const r = await fetch(`/api/private/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designStage }),
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

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link href="/dashboard/private/projects" className={tabClass(!completed)}>
          Active
        </Link>
        <Link href="/dashboard/private/projects/completed" className={tabClass(completed)}>
          Completed
        </Link>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <div className="card-tool overflow-x-auto rounded-xl">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-semibold">Project</th>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">Athletes</th>
              <th className="px-4 py-3 font-semibold">{completed ? "Completed" : "Phase"}</th>
              {!completed ? <th className="px-4 py-3 font-semibold">Progress</th> : null}
              <th className="px-4 py-3 font-semibold">Fee</th>
              <th className="px-4 py-3 font-semibold">Margin</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={completed ? 7 : 8} className="px-4 py-8 text-slate-500">
                  {completed ? (
                    "No completed private projects yet."
                  ) : (
                    <>
                      No active private projects.{" "}
                      <Link href="/dashboard/private/onboarding" className="text-brand-300 hover:underline">
                        Onboard one
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.04] align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/private/projects/${p.id}`}
                      className="font-medium text-white hover:text-brand-300"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.client.name}</td>
                  <td className="px-4 py-3">
                    <AthleteAvatars athletes={projectAthletes(p)} />
                  </td>
                  <td className="px-4 py-3">
                    {completed ? (
                      <span className="text-slate-300">{p.completedAt ?? p.designStageLabel}</span>
                    ) : (
                      <div ref={stageOpenId === p.id ? stageMenuRef : undefined} className="inline-flex flex-col items-start">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setStageOpenId(stageOpenId === p.id ? null : p.id)}
                          className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-left text-xs text-slate-200 ring-1 ring-white/[0.08] hover:bg-white/[0.07]"
                        >
                          {p.designStageLabel} ▾
                        </button>
                        {stageOpenId === p.id ? (
                          <div className="mt-1 w-64 rounded-lg border border-white/[0.1] bg-[#0f131a] py-1">
                            {PRIVATE_STAGE_ORDER.map((key) => (
                              <button
                                key={key}
                                type="button"
                                className={`block w-full px-3 py-2 text-left text-xs hover:bg-white/[0.06] ${
                                  key === p.designStage ? "text-brand-300" : "text-slate-300"
                                }`}
                                onClick={() => void setStage(p.id, key)}
                              >
                                {key === p.designStage ? "✓ " : ""}
                                {PRIVATE_STAGE_LABELS[key]}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                  {!completed ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${p.progressPercent}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-slate-400">{p.progressPercent}%</span>
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-3 tabular-nums text-slate-300">{zar(p.feeZar)}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">
                    {p.marginPercent != null ? `${p.marginPercent}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/dashboard/private/projects/${p.id}/edit`}
                        className="text-xs text-slate-400 hover:text-brand-300"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/dashboard/private/projects/${p.id}/expenses`}
                        className="text-xs text-brand-300 hover:underline"
                      >
                        Expenses
                      </Link>
                      {canDelete ? (
                        <PrivateDeleteProjectButton
                          projectId={p.id}
                          projectName={p.name}
                          onDeleted={() => void load()}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
