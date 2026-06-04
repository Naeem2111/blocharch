"use client";

import { useEffect, useState } from "react";
import {
  COMPLEXITY_LABELS,
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";

type ProjectRow = {
  id: string;
  name: string;
  projectNumber: string;
  complexity: keyof typeof COMPLEXITY_LABELS;
  currentStage: keyof typeof PROJECT_PHASE_LABELS;
  currentStatus: keyof typeof PROJECT_STATUS_LABELS;
  startDate: string | null;
  dueDate: string | null;
  handoverDate: string | null;
  progressPercent: number | null;
  client: { name: string };
};

export function CompletedProjectsClient() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/athlete/projects/completed")
      .then(async (r) => {
        const j = await r.json();
        if (r.ok) setProjects(j.projects || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading completed projects…</p>;

  if (projects.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No completed projects yet. When admin marks a project as completed or handed over, it appears here.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {projects.map((p) => (
        <li key={p.id} className="card-tool rounded-xl p-5">
          <h2 className="font-semibold text-white">{p.name}</h2>
          <p className="text-xs text-slate-500">
            {p.client.name} · {p.projectNumber}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="text-slate-200">{PROJECT_STATUS_LABELS[p.currentStatus]}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Stage</dt>
              <dd className="text-slate-200">{PROJECT_PHASE_LABELS[p.currentStage]}</dd>
            </div>
            {p.handoverDate ? (
              <div>
                <dt className="text-slate-500">Handover</dt>
                <dd className="text-slate-200">{p.handoverDate}</dd>
              </div>
            ) : null}
            {p.progressPercent != null ? (
              <div>
                <dt className="text-slate-500">Final progress</dt>
                <dd className="text-slate-200">{p.progressPercent}%</dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}
