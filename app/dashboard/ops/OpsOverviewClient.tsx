"use client";

import { useEffect, useState } from "react";

type OverviewData = {
  activeAthletes: number;
  activeProjects: number;
  openBlockers: number;
  checkInRequests: number;
  monthlyRevenueGbp: number;
  grossMarginGbp: number;
  grossMarginPercent: number;
  alertCounts: { daily12Count: number; daily14Count: number; capExceededCount: number };
};

function StatCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${
        alert
          ? "animate-pulse border border-red-500/40 bg-red-500/[0.06] ring-1 ring-red-500/35"
          : "card-tool"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${alert ? "text-red-300" : "text-slate-500"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${alert ? "text-red-100" : "text-white"}`}>
        {value}
      </p>
      {sub ? <p className={`mt-1 text-xs ${alert ? "text-red-200/80" : "text-slate-500"}`}>{sub}</p> : null}
    </div>
  );
}

export function OpsOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/ops/overview")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        setData(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading overview…</p>;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Active athletes" value={data.activeAthletes} />
      <StatCard label="Active projects" value={data.activeProjects} />
      <StatCard
        label="Pending check-ins"
        value={data.checkInRequests}
        sub="Athletes waiting for a response"
        alert={data.checkInRequests > 0}
      />
      <StatCard
        label="Monthly revenue (GBP)"
        value={`£${data.monthlyRevenueGbp.toLocaleString()}`}
        sub="From lane hours this month"
      />
      <StatCard
        label="Gross margin"
        value={`£${data.grossMarginGbp.toLocaleString()}`}
        sub={`${data.grossMarginPercent}% of revenue`}
      />
      <div className="card-tool rounded-xl p-5 md:col-span-2 lg:col-span-3">
        <h2 className="text-sm font-semibold text-white">Hour alerts this month</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">12h+ daily logs</dt>
            <dd className="text-lg font-semibold text-amber-300">{data.alertCounts.daily12Count}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">14h+ daily logs</dt>
            <dd className="text-lg font-semibold text-red-300">{data.alertCounts.daily14Count}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Athletes over cap</dt>
            <dd className="text-lg font-semibold text-orange-300">{data.alertCounts.capExceededCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
