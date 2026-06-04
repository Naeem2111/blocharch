"use client";

import { useCallback, useEffect, useState } from "react";
import { PROJECT_PHASE_LABELS, TASK_TYPE_LABELS } from "@/lib/ops-constants";

type LineItem = {
  projectName: string;
  clientName: string;
  projectPhase: string;
  taskType: string;
  hoursWorked: number;
  completionPercent: number | null;
  blockerFlag: boolean;
  blockerNote: string | null;
  completedSummary: string | null;
};

type Submission = {
  id: string;
  athleteName: string;
  athleteCode: string;
  submissionDate: string;
  totalHours: number;
  wellbeingScore: number | null;
  checkInRequested: boolean;
  dailyNote: string | null;
  lockedAt: string | null;
  lineItems: LineItem[];
};

export function OpsSubmissionsClient() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/ops/submissions?limit=200");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setRows(j.submissions || []);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-sm text-slate-500">Loading submissions…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No daily submissions logged yet.</p>
      ) : (
        rows.map((s) => (
          <article key={s.id} className="card-tool rounded-xl p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  {s.athleteName}{" "}
                  <span className="font-normal text-slate-500">({s.athleteCode})</span>
                </h2>
                <p className="text-xs text-slate-500">{s.submissionDate}</p>
              </div>
              <p className="text-sm font-medium tabular-nums text-brand-300">{s.totalHours.toFixed(2)}h total</p>
            </div>
            {s.checkInRequested ? (
              <p className="mt-2 text-xs text-amber-300">Check-in requested</p>
            ) : null}
            {s.dailyNote ? <p className="mt-2 text-sm text-slate-400">{s.dailyNote}</p> : null}
            <ul className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
              {s.lineItems.map((li, i) => (
                <li key={i} className="text-sm">
                  <p className="font-medium text-slate-200">
                    {li.clientName} — {li.projectName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {PROJECT_PHASE_LABELS[li.projectPhase as keyof typeof PROJECT_PHASE_LABELS] ?? li.projectPhase}{" "}
                    · {TASK_TYPE_LABELS[li.taskType as keyof typeof TASK_TYPE_LABELS] ?? li.taskType} ·{" "}
                    {li.hoursWorked}h
                    {li.completionPercent != null ? ` · ${li.completionPercent}% progress` : ""}
                  </p>
                  {li.completedSummary ? (
                    <p className="mt-1 text-xs text-slate-400">{li.completedSummary}</p>
                  ) : null}
                  {li.blockerFlag ? (
                    <p className="mt-1 text-xs text-red-300">
                      Blocker{li.blockerNote ? `: ${li.blockerNote}` : ""}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
    </div>
  );
}
