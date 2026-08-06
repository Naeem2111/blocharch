"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OverviewData = {
  stats: {
    activePrivateProjects: number;
    athletesOnPrivate: number;
    revenueThisMonthZar: number;
    blendedMarginPercent: number | null;
    inCouncilReview: number;
  };
  needsAttention: Array<{ id: string; name: string; reason: string }>;
  upcomingMoves: Array<{ id: string; name: string; from: string; hint: string }>;
};

function zar(n: number) {
  return `R ${Math.round(n).toLocaleString("en-ZA")}`;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card-tool rounded-xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function PrivateOverviewClient() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/private/overview")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        setData(j);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading overview…</p>;

  const { stats } = data;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active private projects"
          value={stats.activePrivateProjects}
          sub={`Across ${stats.athletesOnPrivate} athlete${stats.athletesOnPrivate === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Revenue this month"
          value={zar(stats.revenueThisMonthZar)}
          sub="Private fees, not lane hours"
        />
        <StatCard
          label="Blended margin"
          value={stats.blendedMarginPercent != null ? `${stats.blendedMarginPercent}%` : "—"}
          sub="Across active private work"
        />
        <StatCard
          label="In council review"
          value={stats.inCouncilReview}
          sub="Waiting on the municipality"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Needs your attention</h2>
          <ul className="mt-4 space-y-3">
            {data.needsAttention.length === 0 ? (
              <li className="text-sm text-slate-500">Nothing flagged.</li>
            ) : (
              data.needsAttention.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <Link
                    href={`/dashboard/private/projects/${item.id}`}
                    className="font-medium text-slate-200 hover:text-brand-300"
                  >
                    {item.name}
                  </Link>
                  <span className="shrink-0 text-slate-500">{item.reason}</span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="card-tool rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white">Upcoming phase moves</h2>
          <ul className="mt-4 space-y-3">
            {data.upcomingMoves.length === 0 ? (
              <li className="text-sm text-slate-500">No active projects.</li>
            ) : (
              data.upcomingMoves.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <Link
                    href={`/dashboard/private/projects/${item.id}`}
                    className="font-medium text-slate-200 hover:text-brand-300"
                  >
                    {item.name}
                  </Link>
                  <span className="shrink-0 text-right text-slate-500">{item.from}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
