"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  profile: { fullName: string; athleteCode: string; blocharchStartDate: string; monthlyHourCap: number };
  summary: {
    lifetimeHours: number;
    monthHours: number;
    monthOvertimeHours: number;
    hoursRemaining: number;
    totalEarningsZar: number;
  };
  activeProjects: number;
  openBlockers: number;
  recentSubmissions: Array<{ submissionDate: string; totalHours: number }>;
};

export function AthleteDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/athlete/dashboard")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load dashboard");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading dashboard…</p>;

  const { profile, summary } = data;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">This month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {summary.monthHours.toFixed(1)} / {profile.monthlyHourCap}h
          </p>
          <p className="mt-1 text-xs text-slate-500">{summary.hoursRemaining.toFixed(1)}h remaining</p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Overtime</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400/90">
            {summary.monthOvertimeHours.toFixed(1)}h
          </p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Est. earnings</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-400">
            R {summary.totalEarningsZar.toLocaleString()}
          </p>
        </div>
        <div className="card-tool rounded-xl p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Lifetime hours</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-200">
            {summary.lifetimeHours.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/dashboard/athlete/submissions"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-brand-500"
        >
          Log today&apos;s work
        </Link>
        <Link
          href="/dashboard/athlete/projects"
          className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm text-slate-200 ring-1 ring-white/[0.08] hover:bg-white/[0.12]"
        >
          View my projects ({data.activeProjects})
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Profile</h2>
          <p className="mt-2 text-sm text-slate-400">
            {profile.fullName} · {profile.athleteCode}
          </p>
          <p className="text-xs text-slate-500">Started {profile.blocharchStartDate}</p>
        </div>
        <div className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Alerts</h2>
          <p className="mt-2 text-sm text-slate-400">{data.openBlockers} open blocker(s)</p>
        </div>
        <div className="card-tool rounded-xl p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-white">Recent submissions</h2>
          {data.recentSubmissions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.recentSubmissions.map((s) => (
                <li key={s.submissionDate} className="flex justify-between text-sm text-slate-300">
                  <span>{s.submissionDate}</span>
                  <span>{s.totalHours}h</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
