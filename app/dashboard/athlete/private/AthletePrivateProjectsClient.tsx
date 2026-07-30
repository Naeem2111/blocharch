"use client";

import { useEffect, useState } from "react";

type ProjectRow = {
  id: string;
  name: string;
  designStageLabel: string;
  progressPercent: number;
  status: string;
  completedAt: string | null;
  handoverOutcome: string | null;
};

export function AthletePrivateProjectsClient({ scope }: { scope: "active" | "completed" }) {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/athlete/private/projects?scope=${scope}`)
      .then((r) => r.json())
      .then((j) => {
        setProjects(j.projects || []);
        setLoading(false);
      });
  }, [scope]);

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <div className="card-tool overflow-x-auto rounded-xl">
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-4 py-3 font-semibold">Project</th>
            {scope === "active" ? (
              <>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
              </>
            ) : (
              <>
                <th className="px-4 py-3 font-semibold">Completed</th>
                <th className="px-4 py-3 font-semibold">Outcome</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-slate-500">
                No {scope === "active" ? "active" : "completed"} private projects assigned to you.
              </td>
            </tr>
          ) : (
            projects.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.04]">
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                {scope === "active" ? (
                  <>
                    <td className="px-4 py-3 text-slate-300">{p.designStageLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${p.progressPercent}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-slate-400">{p.progressPercent}%</span>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-slate-300">{p.completedAt ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{p.handoverOutcome ?? "—"}</td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
