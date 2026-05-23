"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";

type ProjectRow = {
  id: string;
  name: string;
  projectNumber: string;
  address: string | null;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  dueDate: string | null;
  handoverDate: string | null;
  blockerFlag: boolean;
  client: { name: string };
};

export function AthleteProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/athlete/projects");
    const j = await r.json();
    if (r.ok) setProjects(j.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  return (
    <div className="space-y-4">
      {projects.map((p) => (
        <article key={p.id} className="card-tool rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-white">
                {p.name}
                {p.blockerFlag ? (
                  <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-300">Blocker</span>
                ) : null}
              </h2>
              <p className="text-xs text-slate-500">
                {p.client.name} · {p.projectNumber}
              </p>
            </div>
            <span className="rounded-md bg-white/[0.06] px-2 py-1 text-[10px] uppercase text-slate-400">
              {COMPLEXITY_LABELS[p.complexity]}
            </span>
          </div>
          {p.address ? <p className="mt-2 text-sm text-slate-400">{p.address}</p> : null}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div>
              <dt className="text-slate-500">Stage</dt>
              <dd className="text-slate-200">{PROJECT_PHASE_LABELS[p.currentStage]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-200">{PROJECT_STATUS_LABELS[p.currentStatus]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Due</dt>
              <dd className="text-slate-200">{p.dueDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Handover</dt>
              <dd className="text-slate-200">{p.handoverDate ?? "—"}</dd>
            </div>
          </dl>
        </article>
      ))}
      {projects.length === 0 ? (
        <p className="text-sm text-slate-500">No projects assigned yet. Ask your admin to assign projects to you.</p>
      ) : null}
    </div>
  );
}
