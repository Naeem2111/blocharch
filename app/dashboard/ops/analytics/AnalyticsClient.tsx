"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SimpleBarChart } from "@/components/ops/SimpleBarChart";
import {
  PROJECT_PHASE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/ops-constants";

type AnalyticsData = {
  month: string;
  hoursByPhase: Array<{ phase: string; hours: number }>;
  hoursByClient: Array<{ clientId: string; clientName: string; hours: number }>;
  hoursByAthlete: Array<{ athleteId: string; athleteName: string; hours: number }>;
  dueDateRisk: Array<{
    id: string;
    name: string;
    clientName: string;
    dueDate: string;
    daysUntilDue: number;
    currentStatus: string;
    assignedAthleteName: string | null;
  }>;
  profitabilityByClient: Array<{
    clientId: string;
    clientName: string;
    revenueGbp: number;
    costGbp: number;
    marginGbp: number;
    marginPercent: number;
  }>;
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AnalyticsClient() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/ops/analytics?month=${month}`);
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Failed to load");
      setLoading(false);
      return;
    }
    setData(j);
    setError("");
    setLoading(false);
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const phaseBars = useMemo(
    () =>
      (data?.hoursByPhase ?? []).map((p) => ({
        label: PROJECT_PHASE_LABELS[p.phase as keyof typeof PROJECT_PHASE_LABELS] ?? p.phase,
        value: p.hours,
        sublabel: `${p.hours}h`,
      })),
    [data]
  );

  const clientBars = useMemo(
    () =>
      (data?.hoursByClient ?? []).slice(0, 8).map((c) => ({
        label: c.clientName,
        value: c.hours,
      })),
    [data]
  );

  const athleteBars = useMemo(
    () =>
      (data?.hoursByAthlete ?? []).map((a) => ({
        label: a.athleteName,
        value: a.hours,
      })),
    [data]
  );

  if (loading && !data) return <p className="text-sm text-slate-500">Loading analytics…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <label className="inline-block text-xs text-slate-400">
        Month
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="mt-1 block rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
        />
      </label>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Hours by phase</h2>
          <div className="mt-4">
            <SimpleBarChart items={phaseBars} valueSuffix="h" />
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Hours by client</h2>
          <div className="mt-4">
            <SimpleBarChart items={clientBars} valueSuffix="h" />
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Hours by athlete</h2>
          <div className="mt-4">
            <SimpleBarChart items={athleteBars} valueSuffix="h" />
          </div>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Profitability by client</h2>
          <div className="mt-4">
            <SimpleBarChart
              items={data.profitabilityByClient.slice(0, 8).map((c) => ({
                label: c.clientName,
                value: c.marginGbp,
                sublabel: `${c.marginPercent}% margin · £${c.revenueGbp} rev`,
              }))}
              valueSuffix=""
            />
          </div>
        </div>
      </div>

      <div className="card-tool rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white">Due date risk</h2>
        <p className="mt-1 text-xs text-slate-500">Projects due within 14 days that are not complete.</p>
        {data.dueDateRisk.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No at-risk projects.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Athlete</th>
                </tr>
              </thead>
              <tbody>
                {data.dueDateRisk.map((p) => (
                  <tr key={p.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.clientName}</td>
                    <td className="px-3 py-2">{p.dueDate}</td>
                    <td
                      className={`px-3 py-2 tabular-nums ${p.daysUntilDue < 0 ? "text-red-300" : p.daysUntilDue <= 3 ? "text-amber-300" : ""}`}
                    >
                      {p.daysUntilDue < 0 ? `${Math.abs(p.daysUntilDue)}d overdue` : `${p.daysUntilDue}d`}
                    </td>
                    <td className="px-3 py-2">
                      {PROJECT_STATUS_LABELS[p.currentStatus as keyof typeof PROJECT_STATUS_LABELS] ?? p.currentStatus}
                    </td>
                    <td className="px-3 py-2">{p.assignedAthleteName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
